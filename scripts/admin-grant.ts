/**
 * npm run admin:grant -- <email> [--remote] [--yes-production]
 *
 * Makes an existing account (it must have signed in once) an admin, and
 * reinstates it if suspended. The only way to create the first admin; later
 * admins are promoted in /admin/users. Audited as "user.role_cli". Uses the
 * secret key: run it on a trusted machine only. The key is never printed.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { secretKeyTarget } from "./script-env";

async function main() {
  const email = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error("usage: npm run admin:grant -- <email> [--remote] [--yes-production]");
    process.exit(1);
  }
  const { url, key } = secretKeyTarget(`npm run admin:grant -- ${email}`);
  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc("admin_grant_by_email", { p_email: email });
  if (error) {
    const notFound = /BP_NOT_FOUND/.test(error.message ?? "");
    console.error(notFound
      ? `error: no account for ${email}. Sign in once with that Google account, then re-run.`
      : "error: admin:grant failed (is the R1 migration applied?).");
    process.exit(1);
  }
  console.log(`${email} is now an admin (user ${data}). Next: sign in, enrol MFA at /admin/mfa, open /admin.`);
}

main().catch(() => {
  console.error("error: admin:grant failed");
  process.exit(1);
});
