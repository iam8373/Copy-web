/**
 * Shared by the secret-key scripts (db:seed, admin:grant): reads .env.local
 * plus the environment, and refuses a non-local database unless the caller
 * passed --remote (and --yes-production when NODE_ENV=production).
 * Keys are never printed.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

/** URL + secret key, or exits with a message naming the re-run command. */
export function secretKeyTarget(command: string): { url: string; key: string } {
  const env = { ...loadEnvFile(resolve(".env.local")), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (see .env.example).");
    process.exit(1);
  }
  const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url);
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--yes-production")) {
    console.error(`error: NODE_ENV=production. Re-run with \`${command} --remote --yes-production\` to do it on purpose.`);
    process.exit(1);
  }
  if (!local && !process.argv.includes("--remote")) {
    console.error(`error: NEXT_PUBLIC_SUPABASE_URL is not a local database. Re-run with \`${command} --remote\` to do it on purpose.`);
    process.exit(1);
  }
  return { url, key };
}
