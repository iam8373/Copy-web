#!/usr/bin/env bash
# Copies secrets from the sandbox environment (Alloy secrets screen) into
# .env.local, which Next.js and the scripts read. Idempotent; prints names,
# never values. Run before `docker compose -f docker-compose.alloy.yaml up`
# (or restart the web service afterwards).
#
# Rules:
# - A value is written only if it is set in the environment.
# - An existing .env.local value is replaced only if it is blank, a
#   placeholder, or points at the sandbox's local Supabase stand-in
#   (127.0.0.1:54321), so hosted keys from the secrets screen take over from
#   local-dev defaults but never from something you typed yourself.
# - Real Supabase mode is switched on only when the URL and the publishable
#   key are both present, unless NEXT_PUBLIC_AUTH_MODE is set explicitly.
set -euo pipefail
cd "$(dirname "$0")/.."
FILE=.env.local
[ -f "$FILE" ] || { : > "$FILE"; }
chmod 600 "$FILE"

current() { grep -E "^$1=" "$FILE" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true; }
replaceable() {
  local v="$1"
  [ -z "$v" ] && return 0
  case "$v" in
    placeholder*|changeme*|your-*|your_*|*"<"*) return 0 ;;
    http://127.0.0.1:54321*|http://localhost:54321*) return 0 ;;
  esac
  return 1
}
put() { # name value
  local name="$1" value="$2" tmp
  tmp=$(mktemp)
  grep -vE "^$name=" "$FILE" > "$tmp" || true
  printf '%s=%s\n' "$name" "$value" >> "$tmp"
  cat "$tmp" > "$FILE"; rm -f "$tmp"
}

changed=()
# Supabase URL/keys travel together: replacing the URL also replaces keys
# that belonged to the local stand-in.
local_url=false
case "$(current NEXT_PUBLIC_SUPABASE_URL)" in http://127.0.0.1:54321*|http://localhost:54321*) local_url=true ;; esac

for name in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY NEXT_PUBLIC_SUPABASE_ANON_KEY \
            SUPABASE_SERVICE_ROLE_KEY NEXT_PUBLIC_TURNSTILE_SITE_KEY NEXT_PUBLIC_SITE_URL \
            GEMINI_API_KEY GEMINI_MODEL; do
  value="${!name:-}"
  [ -n "$value" ] || continue
  existing="$(current "$name")"
  if replaceable "$existing" || { $local_url && [[ "$name" == *SUPABASE* ]]; }; then
    if [ "$existing" != "$value" ]; then put "$name" "$value"; changed+=("$name"); fi
  fi
done

url="$(current NEXT_PUBLIC_SUPABASE_URL)"
key="$(current NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)"; [ -n "$key" ] || key="$(current NEXT_PUBLIC_SUPABASE_ANON_KEY)"
if [ -n "${NEXT_PUBLIC_AUTH_MODE:-}" ]; then
  [ "$(current NEXT_PUBLIC_AUTH_MODE)" = "$NEXT_PUBLIC_AUTH_MODE" ] || { put NEXT_PUBLIC_AUTH_MODE "$NEXT_PUBLIC_AUTH_MODE"; changed+=(NEXT_PUBLIC_AUTH_MODE); }
elif [ -z "$(current NEXT_PUBLIC_AUTH_MODE)" ]; then
  case "$url" in
    https://*) if [ -n "$key" ]; then put NEXT_PUBLIC_AUTH_MODE supabase; changed+=(NEXT_PUBLIC_AUTH_MODE); fi ;;
  esac
fi

if [ ${#changed[@]} -eq 0 ]; then echo "populate-env: .env.local unchanged"; else echo "populate-env: updated ${changed[*]}"; fi
