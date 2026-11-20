#!/usr/bin/env bash
# Smoke-test a running API. Authenticates first so the protected stock
# endpoints are exercised rather than rejected with 401.
#
# Usage:
#   API_URL=https://... scripts/smoke.sh
#
# The script uses the first available credential source:
#   1. TOKEN              - an existing bearer token
#   2. SMOKE_EMAIL + SMOKE_PASSWORD - an existing account
#   3. register a throwaway smoke+<timestamp>@example.com account
set -euo pipefail

: "${API_URL:?Set API_URL, e.g. https://mikledez--stock-predictor-api-fastapi-app.us-east.modal.run}"
API_URL="${API_URL%/}"

HTTP_TIMEOUT="${HTTP_TIMEOUT:-30}"
PREDICT_TIMEOUT="${PREDICT_TIMEOUT:-300}"
TOKEN="${TOKEN:-}"
EMAIL="${SMOKE_EMAIL:-}"
PASSWORD="${SMOKE_PASSWORD:-}"

body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

# call METHOD PATH [curl args...]
# Sets HTTP_STATUS and HTTP_BODY.
call() {
  local method="$1" path="$2"
  shift 2
  HTTP_STATUS="$(curl -sS --max-time "$HTTP_TIMEOUT" -X "$method" \
    -o "$body_file" -w '%{http_code}' "$@" "${API_URL}${path}")" \
    || fail "$method $path: could not reach $API_URL"
  HTTP_BODY="$(cat "$body_file")"
  printf '%s %s -> %s\n' "$method" "$path" "$HTTP_STATUS"
}

expect() {
  local want="$1"
  [[ "$HTTP_STATUS" == "$want" ]] \
    || fail "expected $want for $2, got $HTTP_STATUS: ${HTTP_BODY:-<empty body>}"
}

# Extract a top-level string field from a JSON response. The access token is a
# JWT, so it never contains quotes or escapes that would need unescaping.
json_string_field() {
  printf '%s' "$HTTP_BODY" \
    | sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p" \
    | head -n 1
}

for path in /api/health /api/health/db; do
  call GET "$path"
  expect 200 "$path"
  printf '  %s\n' "$HTTP_BODY"
done

if [[ -n "$TOKEN" ]]; then
  printf 'auth -> using TOKEN\n'
elif [[ -n "$EMAIL" || -n "$PASSWORD" ]]; then
  [[ -n "$EMAIL" && -n "$PASSWORD" ]] \
    || fail "set both SMOKE_EMAIL and SMOKE_PASSWORD (or TOKEN)"
  call POST /api/auth/login \
    -H 'Content-Type: application/json' \
    --data "$(printf '{"email":"%s","password":"%s"}' "$EMAIL" "$PASSWORD")"
  expect 200 "login"
  TOKEN="$(json_string_field access_token)"
else
  EMAIL="smoke+$(date +%s)-$$@example.com"
  PASSWORD="smoke-test-password"
  printf 'auth -> no TOKEN or SMOKE_EMAIL; registering %s\n' "$EMAIL"
  call POST /api/auth/register \
    -H 'Content-Type: application/json' \
    --data "$(printf '{"email":"%s","password":"%s"}' "$EMAIL" "$PASSWORD")"
  expect 201 "register"
  TOKEN="$(json_string_field access_token)"
fi

[[ -n "$TOKEN" ]] || fail "no access_token returned by the auth endpoint"
AUTH_HEADER="Authorization: Bearer ${TOKEN}"

call GET /api/auth/me -H "$AUTH_HEADER"
expect 200 "GET /api/auth/me"

call GET "/api/stocks/NVDA/history?period=1mo" -H "$AUTH_HEADER"
expect 200 "GET /api/stocks/NVDA/history"

call POST /api/stocks/SPY/predict -H "$AUTH_HEADER" --max-time "$PREDICT_TIMEOUT"
expect 200 "POST /api/stocks/SPY/predict"

printf 'ALL CHECKS PASSED\n'
