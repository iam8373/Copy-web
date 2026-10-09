#!/usr/bin/env bash
# Asserts properties of a NORMAL production build (no e2e flag). Used by CI.
#   usage: scripts/verify-build.sh [distDir]   (default .next)
set -euo pipefail
dist="${1:-.next}"
[ -d "$dist" ] || { echo "verify-build: $dist not found; run the build first" >&2; exit 2; }

fail=0
search() { grep -rlE "$1" "$dist" --include=*.js --include=*.html --include=*.rsc --include=*.css --include=*.json 2>/dev/null | grep -v "/cache/" || true; }

# 1. Test-only error trigger must be compiled out (Phase 4, D-012).
hits=$(search 'bp-e2e-throw|E2E_SECRET_INTERNAL_DETAIL')
if [ -n "$hits" ]; then echo "✗ test-only /e2e-error code is present in the build:"; echo "$hits" | sed 's/^/    /'; fail=1
else echo "✓ test-only error trigger compiled out"; fi

# 1b. Test-only UI gallery must be compiled out too (work order 4, Phase 2).
hits=$(search 'ui-gallery|About the order book')
if [ -n "$hits" ]; then echo "✗ test-only /e2e-ui gallery is present in the build:"; echo "$hits" | sed 's/^/    /'; fail=1
else echo "✓ test-only UI gallery compiled out"; fi

# 2. No AI service reachable from shipped code (Phase 6, D-014).
hits=$(search 'api\.openai\.com|OPENAI_API_KEY|generativelanguage\.googleapis\.com|GEMINI_API_KEY')
if [ -n "$hits" ]; then echo "✗ AI provider (OpenAI/Gemini) references in the build:"; echo "$hits" | sed 's/^/    /'; fail=1
else echo "✓ no OpenAI or Gemini references"; fi

# 2b. No server secret reaches the browser (backend Phase B2). Scans the client
#     bundle for secret-key shapes and names. A JWT is allowed only if its
#     payload role is "anon" (a legacy publishable key); anything else fails.
hits=$(grep -rlE 'sb_secret_[A-Za-z0-9_-]{6,}|service_role|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|AUTH_COOKIE_SECRET|TURNSTILE_SECRET|GEMINI_API_KEY|AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9_-]{20,}|0x4[A-Za-z0-9_-]{30,}' "$dist/static" 2>/dev/null || true)
jwt=$(python3 - "$dist/static" <<'PYJWT'
import base64, json, os, re, sys
bad = []
pat = re.compile(rb'eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}')
for root, _, files in os.walk(sys.argv[1]):
    for f in files:
        path = os.path.join(root, f)
        try:
            data = open(path, 'rb').read()
        except OSError:
            continue
        for m in pat.finditer(data):
            seg = m.group(1) + b'=' * (-len(m.group(1)) % 4)
            try:
                role = json.loads(base64.urlsafe_b64decode(seg)).get('role')
            except Exception:
                role = None
            if role != 'anon':
                bad.append(path)
print('\n'.join(sorted(set(bad))))
PYJWT
)
if [ -n "$hits$jwt" ]; then echo "✗ secret-shaped strings or secret names in browser bundles:"; printf '%s\n%s\n' "$hits" "$jwt" | sed '/^$/d; s/^/    /'; fail=1
else echo "✓ no secrets, secret names or non-anon JWTs in browser bundles"; fi

# 3. No Google Fonts in app output (Phase 2, D-010). Next's framework chunks
#    carry an inert GOOGLE_FONT_PROVIDER constant, so only app output is checked.
app_out=$(grep -rlE 'fonts\.(googleapis|gstatic)\.com' "$dist/server/app" "$dist/static/css" 2>/dev/null || true)
if [ -n "$app_out" ]; then echo "✗ Google Fonts URLs in app output:"; echo "$app_out" | sed 's/^/    /'; fail=1
else echo "✓ no Google Fonts URLs in pages or CSS"; fi

exit $fail
