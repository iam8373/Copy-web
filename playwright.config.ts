import { defineConfig, devices } from "@playwright/test";

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

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
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
    command: `NEXT_DIST_DIR=${DIST} npx next build && NEXT_DIST_DIR=${DIST} npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
