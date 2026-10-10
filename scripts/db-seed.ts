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
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { seedDatabase } from "./seed-db";
import { secretKeyTarget } from "./script-env";

async function main() {
  // Safety: .env.local may hold a hosted project's keys (populate-env.sh).
  // Seeding a hosted database must be a deliberate choice.
  const { url, key } = secretKeyTarget("npm run db:seed --");
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
