[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$environmentFile = Join-Path $repositoryRoot 'e2e.env'
$backendLogDirectory = Join-Path $repositoryRoot 'tmp'
$backendOutputLog = Join-Path $backendLogDirectory 'web-e2e-backend.stdout.log'
$backendErrorLog = Join-Path $backendLogDirectory 'web-e2e-backend.stderr.log'

function Import-EnvironmentFile([string]$path) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Missing $path. Copy e2e.env.example to e2e.env and provide the local test database settings."
    }

    foreach ($line in Get-Content -LiteralPath $path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }

        $separator = $trimmed.IndexOf('=')
        if ($separator -lt 1) { throw "Invalid environment entry in ${path}: $line" }

        $name = $trimmed.Substring(0, $separator).Trim()
        $value = $trimmed.Substring($separator + 1).Trim()
        if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
            $value = $value.Substring(1, $value.Length -2)
        }
        Set-Item -Path "Env:$name" -Value $value
    }
}

function Require-EnvironmentValue([string]$name) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if ([string]::IsNullOrWhiteSpace($value)) { throw "e2e.env must set $name." }
    return $value
}

function Remove-E2EFixtures([string]$jdbcUrl, [string]$databaseUser) {
    $connection = [uri]($jdbcUrl -replace '^jdbc:', '')
    $databaseName = $connection.AbsolutePath.Trim('/')
    $databasePort = if ($connection.IsDefaultPort) { 5432 } else { $connection.Port }
    $psql = Get-Command psql -ErrorAction SilentlyContinue
    if ($null -eq $psql) {
        $fallbackPsql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
        if (-not (Test-Path -LiteralPath $fallbackPsql -PathType Leaf)) {
            throw 'Could not find psql required to remove E2E fixtures from forgeboard_test.'
        }
        $psqlPath = $fallbackPsql
    } else {
        $psqlPath = $psql.Source
    }

    $cleanupSql = @'
BEGIN;
CREATE TEMP TABLE e2e_firm_ids ON COMMIT DROP AS
  SELECT id FROM firms WHERE name ILIKE 'e2e %' OR slug LIKE 'e2e-%';
DELETE FROM saved_workflow_views WHERE firm_id IN (SELECT id FROM e2e_firm_ids);
DELETE FROM engagements WHERE firm_id IN (SELECT id FROM e2e_firm_ids);
DELETE FROM work_items WHERE firm_id IN (SELECT id FROM e2e_firm_ids);
DELETE FROM document_requests WHERE firm_id IN (SELECT id FROM e2e_firm_ids);
DELETE FROM firms WHERE id IN (SELECT id FROM e2e_firm_ids);
DELETE FROM users u
WHERE u.email LIKE 'e2e-%@forgeboard.test'
  AND NOT EXISTS (SELECT 1 FROM firm_memberships fm WHERE fm.user_id = u.id);
COMMIT;
'@

    $previousPgPassword = $env:PGPASSWORD
    $env:PGPASSWORD = $env:DB_PASSWORD
    try {
        & $psqlPath -h $connection.Host -p $databasePort -U $databaseUser -d $databaseName -w -v ON_ERROR_STOP=1 -q -c $cleanupSql
        if ($LASTEXITCODE -ne 0) { throw 'E2E fixture cleanup failed; forgeboard_test was not left in a known clean state.' }
    }
    finally {
        $env:PGPASSWORD = $previousPgPassword
    }
}

Import-EnvironmentFile $environmentFile

$databaseUrl = Require-EnvironmentValue 'DB_URL'
$null = Require-EnvironmentValue 'DB_USER'
$null = Require-EnvironmentValue 'DB_PASSWORD'
$port = Require-EnvironmentValue 'APP_PORT'
$apiTokenSecret = Require-EnvironmentValue 'FORGEBOARD_API_TOKEN_SECRET'

if ($databaseUrl -notmatch '/forgeboard_test(?:[?]|$)') {
    throw 'Refusing to run E2E against a database other than forgeboard_test. Check DB_URL in e2e.env.'
}
if ($port -notmatch '^\d+$') { throw 'APP_PORT in e2e.env must be a numeric port.' }
try {
    $apiTokenSecretBytes = [Convert]::FromBase64String($apiTokenSecret)
} catch {
    throw 'FORGEBOARD_API_TOKEN_SECRET in e2e.env must be valid Base64 for at least 32 random bytes.'
}
if ($apiTokenSecretBytes.Length -lt 32) {
    throw 'FORGEBOARD_API_TOKEN_SECRET in e2e.env must encode at least 32 random bytes.'
}
if (Get-NetTCPConnection -LocalPort ([int]$port) -State Listen -ErrorAction SilentlyContinue) {
    throw "Port $port is already in use. Refusing to reuse an existing backend for E2E."
}

New-Item -ItemType Directory -Path $backendLogDirectory -Force | Out-Null
Remove-Item -LiteralPath $backendOutputLog, $backendErrorLog -Force -ErrorAction SilentlyContinue

$apiBaseUrl = "http://127.0.0.1:$port"
$backendProcess = $null
$shouldCleanFixtures = $true

try {
    Push-Location $repositoryRoot
    $maven = (Get-Command mvn -ErrorAction Stop).Source
    $backendProcess = Start-Process -FilePath $maven -ArgumentList '-f', 'backend/pom.xml', 'spring-boot:run' -WorkingDirectory $repositoryRoot -RedirectStandardOutput $backendOutputLog -RedirectStandardError $backendErrorLog -PassThru

    $deadline = (Get-Date).AddSeconds(90)
    do {
        Start-Sleep -Seconds 1
        $backendProcess.Refresh()
        if ($backendProcess.HasExited) {
            throw "The E2E backend stopped before becoming healthy. See $backendOutputLog and $backendErrorLog."
        }

        try {
            $health = Invoke-WebRequest -Uri "$apiBaseUrl/actuator/health" -UseBasicParsing -TimeoutSec 2
        } catch {
            $health = $null
        }
    } until ($health.StatusCode -eq 200 -or (Get-Date) -ge $deadline)

    if ($health.StatusCode -ne 200) {
        throw "The E2E backend did not become healthy within 90 seconds. See $backendOutputLog and $backendErrorLog."
    }

    $env:FORGEBOARD_E2E_API_BASE_URL = $apiBaseUrl
    $env:CI = 'true'
    & pnpm --filter @forgeboard/web test:e2e
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    Pop-Location -ErrorAction SilentlyContinue
    try {
        if ($shouldCleanFixtures) {
            Remove-E2EFixtures $databaseUrl $env:DB_USER
        }
    }
    finally {
        if ($null -ne $backendProcess -and -not $backendProcess.HasExited) {
            & taskkill /PID $backendProcess.Id /T /F | Out-Null
        }
    }
}
