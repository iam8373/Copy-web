import { defineConfig, devices } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";

/**
 * Real Supabase Auth end-to-end tests (backend Phase 2), separate from the
 * main suite, which always runs in demo mode with no network.
 *
 * Needs a local Supabase with the mail catcher:
 *   - normal machine / CI: `supabase start` (API :54321, Mailpit/Inbucket :54324)
 *   - this sandbox: `.scratch/localstack/up.sh`
 * and the local URL + keys in .env.local (or the environment).
 *
 *   npm run test:e2e:auth
 */
function env(name: string): string {
  if (process.env[name]) return process.env[name]!;
  if (!existsSync(".env.local")) return "";
  const m = readFileSync(".env.local", "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
  return m ? m[1].replace(/^["']|["']$/g, "").trim() : "";
}

const PORT = Number(process.env.E2E_AUTH_PORT ?? 3200);
const URL = env("E2E_SUPABASE_URL") || "http://127.0.0.1:54321";
const KEY = env("E2E_SUPABASE_ANON_KEY") || env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

export default defineConfig({
  testDir: "./tests/e2e-auth",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", screenshot: "only-on-failure" },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-pixel5", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command:
      `NEXT_PUBLIC_AUTH_MODE=supabase NEXT_PUBLIC_SUPABASE_URL=${URL} NEXT_PUBLIC_SUPABASE_ANON_KEY=${KEY} ` +
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= NEXT_PUBLIC_TURNSTILE_SITE_KEY= NEXT_DIST_DIR=.next-auth npx next build && ` +
      `NEXT_DIST_DIR=.next-auth npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
