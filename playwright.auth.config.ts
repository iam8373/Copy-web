import { defineConfig, devices } from "@playwright/test";
import { testAppEnv } from "./tests/support/local-supabase";

/**
 * The production sign-in configuration: EMAIL_OTP_ENABLED=false (no custom
 * SMTP yet), so the sheet offers Google only. Built separately from the main
 * suite, which enables email codes to exercise that path against the local
 * mail catcher. Uses the LOCAL Supabase stack only.
 *
 *   npm run test:e2e:auth
 */
const PORT = Number(process.env.E2E_AUTH_PORT ?? 3200);
const APP_ENV = testAppEnv({ EMAIL_OTP_ENABLED: "false" });

export default defineConfig({
  globalSetup: "./tests/support/global-setup.ts",
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
      `${APP_ENV} NEXT_DIST_DIR=.next-auth npx next build && ` +
      `${APP_ENV} NEXT_DIST_DIR=.next-auth npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
