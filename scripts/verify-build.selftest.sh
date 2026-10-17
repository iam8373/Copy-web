#!/usr/bin/env bash
# Self-tests for scripts/verify-build.py: a clean fixture build must pass, and
# each fixture with one planted leak must fail with the right pattern name and
# without printing the planted secret value.
#   usage: scripts/verify-build.selftest.sh
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fails=0

# A fake "secret" assembled at runtime so this file holds no secret-shaped literal.
FAKE_SB="sb_""secret_""$(printf 'x%.0s' {1..24})"

clean() {
  local d="$1"
  mkdir -p "$d/static/chunks" "$d/static/css" "$d/server/app/admin/translations" "$d/server/chunks"
  # Content that used to trip the old patterns and is legitimate:
  #  - the order book tooltip string (old gallery marker, real i18n text)
  #  - AI market content words in category chips
  printf 'const t={aboutOrderBook:"About the order book",chips:["OpenAI","Google Gemini"]};' > "$d/static/chunks/app.js"
  printf 'body{color:red}' > "$d/static/css/app.css"
  # A provider chunk (77) loaded only by an admin page; a public page loads 12.
  printf 'g="https://generativelanguage.googleapis.com/v1beta/models";k=e.GEMINI_API_KEY;' > "$d/server/chunks/77.js"
  printf 'module.exports={x:1}' > "$d/server/chunks/12.js"
  printf 'a.X(0,[12,77],()=>a(1));' > "$d/server/app/admin/translations/page.js"
  printf 'a.X(0,[12],()=>a(1));' > "$d/server/app/page.js"
  printf '{"/page":"/"}' > "$d/server/app-paths-manifest.json"
  # An anon JWT (legacy publishable key) is allowed.
  local anon; anon="eyJhbGciOiJIUzI1NiJ9.$(printf '{"role":"anon","iss":"x"}' | base64 | tr -d '=\n' | tr '/+' '_-').c2lnbmF0dXJlc2lnbmF0dXJl"
  printf 'k="%s";' "$anon" >> "$d/static/chunks/app.js"
}

expect() { # name, expected exit (0|1), pattern name to find (or -), [forbidden text]
  local name="$1" want="$2" pat="$3" forbid="${4:-}"
  local out code
  out="$(python3 "$here/verify-build.py" "$tmp/$name" 2>&1)"; code=$?
  local ok=1
  [ "$code" -eq "$want" ] || ok=0
  if [ "$pat" != "-" ] && ! grep -qF -- ":: $pat ::" <<<"$out"; then ok=0; fi
  if [ -n "$forbid" ] && grep -qF -- "$forbid" <<<"$out"; then ok=0; echo "    leaked into output: $name"; fi
  if [ "$ok" -eq 1 ]; then echo "✓ $name"; else echo "✗ $name (exit $code, want $want, pattern $pat)"; echo "$out" | sed 's/^/      /'; fails=1; fi
}

case_dir() { rm -rf "${tmp:?}/$1"; clean "$tmp/$1"; echo "$tmp/$1"; }

case_dir clean >/dev/null
expect clean 0 -

d=$(case_dir leak-secret-value); printf 'x="%s";' "$FAKE_SB" >> "$d/static/chunks/app.js"
expect leak-secret-value 1 supabase-secret-key "$FAKE_SB"

d=$(case_dir leak-secret-name); printf 'e.GEMINI_API_KEY;' >> "$d/static/chunks/app.js"
expect leak-secret-name 1 secret-name

d=$(case_dir leak-provider-in-browser); printf 'u="https://generativelanguage.googleapis.com";' >> "$d/static/chunks/app.js"
expect leak-provider-in-browser 1 gemini-endpoint

d=$(case_dir leak-provider-public-route); printf 'a.X(0,[12,77],()=>a(1));' > "$d/server/app/page.js"
expect leak-provider-public-route 1 provider-chunk-loaded-by-non-admin-route

d=$(case_dir leak-provider-unowned); printf 'a.X(0,[12],()=>a(1));' > "$d/server/app/admin/translations/page.js"
expect leak-provider-unowned 1 provider-chunk-without-admin-loader

d=$(case_dir leak-openai); printf 'u="https://api.openai.com/v1";' >> "$d/server/chunks/12.js"
expect leak-openai 1 openai-endpoint

d=$(case_dir leak-gallery); printf 'x={"data-testid":"ui-gallery"};' >> "$d/static/chunks/app.js"
expect leak-gallery 1 e2e-ui-gallery-marker

d=$(case_dir leak-test-route); printf '{"/e2e-ui/page":"/e2e-ui"}' > "$d/server/app-paths-manifest.json"
expect leak-test-route 1 test-only-route

d=$(case_dir leak-e2e-error); printf 'throw new Error("E2E_SECRET_INTERNAL_DETAIL")' >> "$d/server/chunks/12.js"
expect leak-e2e-error 1 e2e-error-marker

d=$(case_dir leak-jwt); jwt="eyJhbGciOiJIUzI1NiJ9.$(printf '{"role":"service_role","iss":"x"}' | base64 | tr -d '=\n' | tr '/+' '_-').c2lnbmF0dXJlc2lnbmF0dXJl"
printf 'k="%s";' "$jwt" >> "$d/static/chunks/app.js"
expect leak-jwt 1 jwt-role-service_role "$jwt"

d=$(case_dir leak-catalogue); printf 'd="holds the office of Prime Minister of India continuously";' >> "$d/static/chunks/app.js"
expect leak-catalogue 1 catalogue-text

d=$(case_dir leak-fonts); printf '@import url(https://fonts.googleapis.com/css2);' >> "$d/static/css/app.css"
expect leak-fonts 1 google-fonts-url

exit $fails
