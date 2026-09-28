import { test, expect } from "@playwright/test";
import { MARKETS } from "../../src/data/markets";
import { resetState } from "./helpers";

const LIVE_TITLES = MARKETS.filter((m) => m.isLive).map((m) => m.title);

test.beforeEach(async ({ page }) => {
  await resetState(page);
});

test("live page renders the pulsing live section", async ({ page }) => {
  await page.goto("/markets/live");
  await expect(page.locator('[data-testid="live-section"]')).toBeVisible();
  await expect(page.locator('[data-testid="live-pulse"]').first()).toBeVisible();
});

test("live page shows only live markets, and all of them", async ({ page }) => {
  await page.goto("/markets/live");

  const cards = page.locator('a[href^="/market/"]');
  await expect(cards).toHaveCount(LIVE_TITLES.length);

  // Every rendered card must be one of the isLive markets from the data.
  const rendered = await cards.evaluateAll((els) =>
    els.map((el) => el.querySelector("h3")?.textContent?.trim() ?? "")
  );
  for (const title of rendered) {
    expect(LIVE_TITLES).toContain(title);
  }
});

test("the header count matches the number of live markets in data", async ({ page }) => {
  await page.goto("/markets/live");
  await expect(page.locator("main")).toContainText(`${LIVE_TITLES.length} markets`);
  const shown = page.locator('[data-testid="shown-count"]');
  expect(Number((await shown.innerText()).replace(/[^\d]/g, ""))).toBe(LIVE_TITLES.length);
});

test("live cards show a running countdown rather than Closed", async ({ page }) => {
  await page.goto("/markets/live");
  // Countdowns hydrate on the client; give the first tick time to land.
  await page.waitForTimeout(1500);
  await expect(page.locator('a[href^="/market/"]').first()).not.toContainText("Closed");
});
