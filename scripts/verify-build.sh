#!/usr/bin/env bash
# Asserts properties of a NORMAL production build (no e2e flags). Used by CI.
#   usage: scripts/verify-build.sh [distDir]   (default .next)
# The checks live in verify-build.py (named patterns, masked context on
# failure); scripts/verify-build.selftest.sh proves they catch leaks.
set -euo pipefail
exec python3 "$(dirname "$0")/verify-build.py" "${1:-.next}"
