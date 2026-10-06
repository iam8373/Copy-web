#!/usr/bin/env bash
# Fails if a hard-coded hex colour or px value appears in src/ outside the
# token files (docs/DESIGN.md). Token files: src/app/globals.css,
# src/lib/tokens.ts, tailwind.config.ts (outside src), src/fonts/.
#   usage: scripts/check-tokens.sh [--list]
set -uo pipefail

files=$(git ls-files 'src/**/*.ts' 'src/**/*.tsx' 'src/**/*.css' 2>/dev/null ||
        find src -name '*.ts' -o -name '*.tsx' -o -name '*.css')
files=$(echo "$files" | grep -vE '^src/(app/globals\.css|lib/tokens\.ts|fonts/)' )

# Hex colours: #rgb, #rrggbb, #rrggbbaa as a standalone token.
hex='(^|[^A-Za-z0-9_/&])#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})\b'
# px values: arbitrary Tailwind values like [13px] and CSS-like 12px.
px='\b[0-9]+(\.[0-9]+)?px\b'

hits=$(echo "$files" | xargs grep -nHE "$hex|$px" 2>/dev/null || true)
if [ -n "$hits" ]; then
  count=$(echo "$hits" | wc -l | tr -d ' ')
  if [ "${1:-}" = "--list" ]; then echo "$hits"; fi
  echo "check:tokens: $count hard-coded hex/px value(s) outside the token files:"
  echo "$hits" | cut -d: -f1 | sort | uniq -c | sort -rn | sed 's/^/  /'
  exit 1
fi
echo "check:tokens: no hard-coded hex/px values outside the token files."
