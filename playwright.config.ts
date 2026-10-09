import { defineConfig, devices } from "@playwright/test";
import { testAppEnv } from "./tests/support/local-supabase";

/**
 * Runs the tests against a production build so the suite exercises the same
 * output that ships, not the dev server with Fast Refresh in the way.
 */
/**
 * Port defaults to 3000 as specified. In the Alloy sandbox the dev server
 * already owns :3000, so run with E2E_PORT=3100 to test a real production
 * build instead of silently reusing the dev server.
 */
const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = `http://localhost:${PORT}`;
const DIST = process.env.E2E_PORT ? ".next-e2e" : ".next";
const APP_ENV = testAppEnv({
  EMAIL_OTP_ENABLED: "true",
  AUTH_RATE_LIMIT_PER_IP: "100000",
  AUTH_RATE_LIMIT_PER_EMAIL: "4",
});

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // CI also writes the HTML report, uploaded as an artifact when a run fails.
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: "off",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      // Mobile viewport so BottomNav (sm:hidden) is exercised.
      name: "mobile-pixel5",
      use: { ...devices["Pixel 5"] },
    },
  ],

  webServer: {
    // NEXT_PUBLIC_E2E_ERROR_TRIGGER=1 bundles the test-only /e2e-error route;
    // a normal `npm run build` compiles it out (see src/app/e2e-error).
    // NEXT_PUBLIC_E2E_UI_GALLERY=1 does the same for /e2e-ui (src/app/e2e-ui).
    // Real Supabase Auth against the LOCAL stack (tests/support/local-supabase.ts):
    // email codes on (read from the local mail catcher), generous per-IP limit,
    // a low per-email limit so the limiter itself is testable.
    command:
      `${APP_ENV} NEXT_PUBLIC_E2E_ERROR_TRIGGER=1 NEXT_PUBLIC_E2E_UI_GALLERY=1 NEXT_DIST_DIR=${DIST} npx next build && ` +
      `${APP_ENV} NEXT_DIST_DIR=${DIST} npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
