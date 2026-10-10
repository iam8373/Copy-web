import { existsSync, readFileSync } from "node:fs";

/**
 * Test builds always talk to a LOCAL Supabase (never the hosted project):
 * `supabase start` in CI, `.scratch/localstack/up.sh` in the sandbox.
 * Values come from E2E_* variables (env first, then .env.local).
 */
export function env(name: string): string {
  if (process.env[name]) return process.env[name]!;
  if (!existsSync(".env.local")) return "";
  const m = readFileSync(".env.local", "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
  return m ? m[1].replace(/^["']|["']$/g, "").trim() : "";
}

export const LOCAL = {
  url: env("E2E_SUPABASE_URL") || "http://127.0.0.1:54321",
  publishableKey: env("E2E_SUPABASE_PUBLISHABLE_KEY"),
  secretKey: env("E2E_SUPABASE_SECRET_KEY"),
  mailUrl: env("E2E_MAILPIT_URL") || "http://127.0.0.1:54324",
};

/** Test-only shared secret for POST /api/cron. */
export const TEST_CRON_SECRET = "test-only-cron-secret-not-for-production-0001";

/**
 * Environment for `next build`/`next start` in tests. Every hosted value that
 * .env.local may hold is overridden explicitly, so a test build can never
 * point at production. Turnstile is off (a placeholder counts as unset).
 */
export function testAppEnv(extra: Record<string, string> = {}): string {
  const vars: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL: LOCAL.url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: LOCAL.publishableKey,
    SUPABASE_SECRET_KEY: LOCAL.secretKey,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "placeholder",
    // The local stacks run without Realtime; live prices use the poll.
    NEXT_PUBLIC_SUPABASE_REALTIME: "off",
    NEXT_PUBLIC_SITE_URL: "placeholder",
    AUTH_COOKIE_SECRET: "test-only-cookie-secret-not-for-production-use-0001",
    CRON_SECRET: TEST_CRON_SECRET,
    GEMINI_API_KEY: "",
    ...extra,
  };
  if (!vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !vars.SUPABASE_SECRET_KEY) {
    throw new Error("Local Supabase keys missing: set E2E_SUPABASE_PUBLISHABLE_KEY and E2E_SUPABASE_SECRET_KEY");
  }
  return Object.entries(vars)
    .map(([k, v]) => `${k}='${v.replace(/'/g, "")}'`)
    .join(" ");
}
