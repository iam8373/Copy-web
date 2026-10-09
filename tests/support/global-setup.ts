import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";
import { seedDatabase } from "../../scripts/seed-db";
import { LOCAL } from "./local-supabase";

/**
 * Seeds the LOCAL Supabase before the e2e suites (idempotent). Never the
 * hosted project: LOCAL comes from E2E_* variables only.
 */
export default async function globalSetup() {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(LOCAL.url)) {
    throw new Error("e2e seeding refuses a non-local Supabase URL");
  }
  const db = createClient<Database>(LOCAL.url, LOCAL.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await seedDatabase(db);
}
