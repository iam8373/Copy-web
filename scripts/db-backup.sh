#!/usr/bin/env bash
# npm run db:backup — logical backup of a Supabase database (roles, schema,
# data, migration history) with the Supabase CLI (S5; free plan has no managed
# backups). Follows https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
#
#   SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@<pooler-host>:5432/postgres' npm run db:backup
#
# - Reads the connection string from the ENVIRONMENT only (never .env.local,
#   never an argument), and never prints it.
# - Writes to backups/<UTC timestamp>/ (git-ignored), folder 700, files 600.
# - Needs Docker running (the CLI runs pg_dump in a container).
# Dumps contain user emails and the whole ledger: store them privately.
set -euo pipefail
umask 077

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "error: set SUPABASE_DB_URL in your shell (Dashboard → Connect → Session pooler; it is never printed)." >&2
  exit 1
fi
case "$SUPABASE_DB_URL" in
  postgres://*|postgresql://*) ;;
  *) echo "error: SUPABASE_DB_URL must start with postgresql://" >&2; exit 1 ;;
esac

# The CLI command; overridable only so scripts/db-backup.selftest.sh can use a stub.
read -r -a CLI <<< "${SUPABASE_CLI:-npx --yes supabase}"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dir="backups/$stamp"
mkdir -p "$dir"
chmod 700 backups "$dir"

dump() { # label, file, extra flags…
  local label="$1" file="$2"; shift 2
  printf '  %-18s' "$label"
  # The URL goes through the environment of this process only; output is
  # filtered so a failing pg_dump can never echo it.
  if "${CLI[@]}" db dump --db-url "$SUPABASE_DB_URL" -f "$dir/$file" "$@" >"$dir/.log" 2>&1; then
    chmod 600 "$dir/$file"
    printf 'ok (%s)\n' "$(du -h "$dir/$file" | cut -f1)"
  else
    printf 'FAILED\n'
    # Never echo the connection string (it holds the password).
    grep -v '^npm notice' "$dir/.log" | sed -E 's#postgres(ql)?://[^[:space:]"]+#<db-url>#g' | tail -8 >&2
    rm -f "$dir/.log"
    exit 1
  fi
}

echo "Backing up to $dir/"
dump "roles"             roles.sql          --role-only
dump "schema"            schema.sql
dump "data"              data.sql           --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
dump "migration history" history_schema.sql --schema supabase_migrations
dump "history data"      history_data.sql   --use-copy --data-only --schema supabase_migrations
rm -f "$dir/.log"
( cd "$dir" && sha256sum ./*.sql > SHA256SUMS && chmod 600 SHA256SUMS )
echo "Done. Restore steps: docs/DEPLOY_RUNBOOK.md §10. Keep $dir private (user emails)."
