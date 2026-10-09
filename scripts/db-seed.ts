/**
 * npm run db:seed — imports src/data/markets.ts (and the committed market
 * translations) into Supabase. Idempotent: rows that already exist are left
 * untouched (insert-if-missing), so it never clobbers prices, volumes or
 * edits made since. Uses the secret key; run it only on a trusted machine.
 * Refuses a non-local database without --remote, and NODE_ENV=production
 * without --yes-production as well.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from
 * .env.local or the environment. The key is never printed.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { seedDatabase } from "./seed-db";

function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

async function main() {
  const env = { ...loadEnvFile(resolve(".env.local")), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (see .env.example).");
    process.exit(1);
  }
  // Safety: .env.local may hold a hosted project's keys (populate-env.sh).
  // Seeding a hosted database must be a deliberate choice.
  const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url);
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--yes-production")) {
    console.error("error: NODE_ENV=production. Re-run with `npm run db:seed -- --remote --yes-production` to seed it on purpose.");
    process.exit(1);
  }
  if (!local && !process.argv.includes("--remote")) {
    console.error("error: NEXT_PUBLIC_SUPABASE_URL is not a local database. Re-run with `npm run db:seed -- --remote` to seed it on purpose.");
    process.exit(1);
  }
  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const r = await seedDatabase(db);
  console.log(
    `Seed complete: +${r.markets} markets, +${r.outcomes} outcomes, +${r.translations} translations ` +
      "(existing rows left untouched)."
  );
}

main().catch((err) => {
  console.error(`error: db:seed failed: ${err instanceof Error ? err.message : "unknown error"}`);
  process.exit(1);
});
