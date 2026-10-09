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
# - AUTH_COOKIE_SECRET is generated once if missing; EMAIL_OTP_ENABLED
#   defaults to false (no custom SMTP yet).
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

for name in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY \
            NEXT_PUBLIC_TURNSTILE_SITE_KEY NEXT_PUBLIC_SITE_URL EMAIL_OTP_ENABLED \
            GEMINI_API_KEY GEMINI_MODEL; do
  value="${!name:-}"
  [ -n "$value" ] || continue
  existing="$(current "$name")"
  if replaceable "$existing" || { $local_url && [[ "$name" == *SUPABASE* ]]; }; then
    if [ "$existing" != "$value" ]; then put "$name" "$value"; changed+=("$name"); fi
  fi
done

# A signing key for the 18+ consent cookie, generated once (shell-safe hex).
if [ -z "$(current AUTH_COOKIE_SECRET)" ]; then
  put AUTH_COOKIE_SECRET "$(openssl rand -hex 32)"; changed+=(AUTH_COOKIE_SECRET)
fi
[ -n "$(current EMAIL_OTP_ENABLED)" ] || { put EMAIL_OTP_ENABLED false; changed+=(EMAIL_OTP_ENABLED); }

if [ ${#changed[@]} -eq 0 ]; then echo "populate-env: .env.local unchanged"; else echo "populate-env: updated ${changed[*]}"; fi
