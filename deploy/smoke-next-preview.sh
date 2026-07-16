#!/usr/bin/env sh
set -eu

: "${SMOKE_BASE_URL:?Set to the dedicated Next preview HTTPS origin, e.g. https://next-preview.example.com}"
: "${SMOKE_BACKEND_HEALTH_URL:?Set to the existing Spring health endpoint, e.g. https://forgeboard.example.com/actuator/health}"
: "${SMOKE_EMAIL:?Set to a disposable pilot user email}"
: "${SMOKE_PASSWORD:?Set to the disposable pilot password}"
: "${SMOKE_FIRM_SLUG:?Set to an allow-listed disposable pilot firm slug}"

base_url=${SMOKE_BASE_URL%/}
cookie_jar=$(mktemp)
headers=$(mktemp)
trap "rm -f \"$cookie_jar\" \"$headers\"" EXIT

wait_for() {
  name=$1
  url=$2
  attempt=1
  while [ "$attempt" -le 30 ]; do
    if curl --fail --silent --show-error --max-time 5 "$url" >/dev/null; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  echo "Timed out waiting for $name at $url" >&2
  return 1
}

wait_for "Next preview" "$base_url/sign-in"
wait_for "Spring backend" "$SMOKE_BACKEND_HEALTH_URL"

csrf_json=$(curl --fail --silent --show-error -c "$cookie_jar" "$base_url/api/auth/csrf")
csrf_token=$(printf "%s" "$csrf_json" | node -e 'const input = require("fs").readFileSync(0, "utf8"); const token = JSON.parse(input).csrfToken; if (typeof token !== "string" || token.length === 0) process.exit(1); process.stdout.write(token)')
if [ -z "$csrf_token" ]; then
  echo "Auth.js CSRF token was missing" >&2
  exit 1
fi

callback_json=$(curl --fail --silent --show-error -c "$cookie_jar" -b "$cookie_jar" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$csrf_token" \
  --data-urlencode "email=$SMOKE_EMAIL" \
  --data-urlencode "password=$SMOKE_PASSWORD" \
  --data-urlencode "callbackUrl=/sign-in" \
  --data-urlencode "json=true" \
  "$base_url/api/auth/callback/credentials")
if ! printf "%s" "$callback_json" | node -e 'const input = require("fs").readFileSync(0, "utf8"); const url = JSON.parse(input).url; if (typeof url !== "string" || url.includes("error=")) process.exit(1)'; then
  echo "Auth.js credentials sign-in failed" >&2
  exit 1
fi

# A protected firm page initializes the signed, HttpOnly firm-context cookie.
curl --fail --silent --show-error -L -c "$cookie_jar" -b "$cookie_jar" \
  "$base_url/firms/$SMOKE_FIRM_SLUG/my-work" >/dev/null

status=$(curl --silent --show-error -o /dev/null -w "%{http_code}" -D "$headers" \
  -c "$cookie_jar" -b "$cookie_jar" "$base_url/api/forgeboard/identity/firms")
if [ "$status" != 200 ]; then
  echo "BFF identity/firms returned HTTP $status" >&2
  exit 1
fi
if grep -qi "^set-cookie:" "$headers"; then
  echo "BFF leaked an upstream Set-Cookie header" >&2
  exit 1
fi

echo "Next preview smoke check passed: Auth.js session, BFF identity/firms, and cookie filtering verified."
