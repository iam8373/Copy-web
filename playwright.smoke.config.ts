import { defineConfig, devices } from "@playwright/test";

/**
 * Launch smoke (S6): read-only checks against ANY running deployment, with no
 * secrets and no test accounts. Default: the local dev server.
 *
 *   SMOKE_BASE_URL=https://<railway-domain> npm run test:smoke
 *
 * It never signs in, never places an order and never writes data.
 */
const BASE_URL = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");

export default defineConfig({
  testDir: "./tests/smoke",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 45_000,
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [
    { name: "smoke-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "smoke-mobile", use: { ...devices["Pixel 5"] } },
  ],
});
