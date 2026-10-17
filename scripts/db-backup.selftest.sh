#!/usr/bin/env bash
# Self-test for scripts/db-backup.sh with a stub Supabase CLI (no database):
# refuses a missing or non-postgres URL, writes private files with checksums,
# and never prints the connection string (also when a dump fails).
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
fails=0
ok() { echo "✓ $1"; }
bad() { echo "✗ $1"; fails=1; }
SECRET_URL="postgresql://postgres.ref:pw-$(date +%s%N)@pooler.example:5432/postgres"

cat > "$tmp/stub" <<'STUB'
#!/usr/bin/env bash
# stub: supabase db dump --db-url URL -f FILE [flags]
while [ $# -gt 0 ]; do case "$1" in -f) out="$2"; shift 2;; --db-url) url="$2"; shift 2;; *) shift;; esac; done
[ -n "${STUB_FAIL:-}" ] && { echo "pg_dump: error: connection to $url failed" >&2; exit 1; }
echo "-- dump" > "$out"
STUB
chmod +x "$tmp/stub"

cd "$tmp"
out=$(env -u SUPABASE_DB_URL bash "$here/db-backup.sh" 2>&1); code=$?
[ $code -ne 0 ] && grep -q "set SUPABASE_DB_URL" <<<"$out" && ok "refuses without SUPABASE_DB_URL" || bad "missing URL"
out=$(SUPABASE_DB_URL="mysql://x" bash "$here/db-backup.sh" 2>&1); code=$?
[ $code -ne 0 ] && ok "refuses a non-postgres URL" || bad "non-postgres URL"

out=$(SUPABASE_CLI="$tmp/stub" SUPABASE_DB_URL="$SECRET_URL" bash "$here/db-backup.sh" 2>&1); code=$?
d=$(ls -d backups/*/ 2>/dev/null | head -1)
[ $code -eq 0 ] && [ -n "$d" ] && ok "writes a backup folder" || bad "backup run (exit $code)"
[ "$(stat -c %a backups)" = 700 ] && [ "$(stat -c %a "$d")" = 700 ] && ok "folders are private (700)" || bad "folder mode"
modes=$(stat -c %a "$d"/*.sql "$d"/SHA256SUMS | sort -u | tr '\n' ' ')
[ "$modes" = "600 " ] && ok "files are private (600)" || bad "file modes: $modes"
[ "$(ls "$d"/*.sql | wc -l)" -eq 5 ] && (cd "$d" && sha256sum -c --quiet SHA256SUMS) && ok "5 dumps with valid checksums" || bad "dumps/checksums"
grep -qF "$SECRET_URL" <<<"$out" && bad "URL printed on success" || ok "URL never printed (success)"

rm -rf backups
out=$(STUB_FAIL=1 SUPABASE_CLI="$tmp/stub" SUPABASE_DB_URL="$SECRET_URL" bash "$here/db-backup.sh" 2>&1); code=$?
[ $code -ne 0 ] && ok "a failed dump fails the run" || bad "failure exit"
grep -qF "pw-" <<<"$out" && bad "password printed on failure" || ok "URL masked on failure"
grep -q "<db-url>" <<<"$out" && ok "failure shows <db-url>" || bad "no masked marker"
exit $fails
