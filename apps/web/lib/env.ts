const requiredKeys = [
  'AUTH_SECRET',
  'AUTH_URL',
  'FORGEBOARD_API_BASE_URL',
  'FORGEBOARD_TOKEN_ISSUER',
  'FORGEBOARD_PUBLIC_ORIGIN',
] as const

export interface ServerEnvironment {
  AUTH_SECRET: string
  AUTH_URL: string
  FORGEBOARD_API_BASE_URL: string
  FORGEBOARD_TOKEN_ISSUER: string
  FORGEBOARD_PUBLIC_ORIGIN: string
}

export function serverEnvironment(source: NodeJS.ProcessEnv = process.env): ServerEnvironment {
  const missing = requiredKeys.filter((key) => !source[key]?.trim())
  if (missing.length > 0) throw new Error(`Missing required server environment: ${missing.join(', ')}`)

  return Object.fromEntries(requiredKeys.map((key) => [key, source[key]!])) as unknown as ServerEnvironment
}
