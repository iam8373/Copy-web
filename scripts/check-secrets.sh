#!/usr/bin/env bash
# Fails if anything that looks like an OpenAI-style API key ("sk-" followed by
# 20+ key characters) appears in a tracked file. Runs in CI with no secrets.
#
# Fails CLOSED: if git itself errors (not a repo, ownership check, etc.) the
# script exits non-zero instead of reporting a clean scan it never ran.
set -uo pipefail

pattern='sk-[A-Za-z0-9_-]{20,}'

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
