#!/usr/bin/env bash
# Fails if anything that looks like a secret appears in a tracked file:
#   - OpenAI-style:          sk-…            (20+ key characters)
#   - Google API key:        AIza…           (35 key characters)
#   - Google AI Studio:      AQ.…            (30+ key characters)
#   - Supabase secret key:   sb_secret_…     (10+ key characters)
#   - Turnstile secret key:  0x4…            (33+ characters; site keys are 24)
#   - Any JWT (eyJ….eyJ….sig): Supabase legacy anon/service_role keys and
#     local stand-in keys are JWTs and must never be committed.
# The literal "service_role" is allowed in tracked files (SQL grants, docs);
# it is banned from browser bundles by scripts/verify-build.sh.
# Runs in CI with no secrets.
#
# Fails CLOSED: if git itself errors (not a repo, ownership check, etc.) the
# script exits non-zero instead of reporting a clean scan it never ran.
set -uo pipefail

pattern='sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}|AQ\.[A-Za-z0-9_-]{30,}|sb_secret_[A-Za-z0-9_-]{10,}|0x4[A-Za-z0-9_-]{30,}|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'

# git grep: exit 0 = matches, 1 = no matches, >1 = error. -I skips binaries.
matches=$(git grep -nIE "$pattern" -- . ':!scripts/check-secrets.sh' 2>/tmp/check-secrets.err)
status=$?

if [ "$status" -gt 1 ]; then
  echo "check-secrets: git grep failed (exit $status); refusing to report a clean scan:" >&2
  cat /tmp/check-secrets.err >&2
  exit 2
fi

if [ "$status" -eq 0 ]; then
  # Print file:line only, never the matched value itself.
  echo "Possible API key committed in:"
  echo "$matches" | cut -d: -f1,2 | sort -u | sed 's/^/  /'
  exit 1
fi

echo "No API-key-like strings in tracked files ($(git ls-files | wc -l | tr -d ' ') files scanned)."
