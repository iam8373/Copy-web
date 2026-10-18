import { test, expect } from "@playwright/test";
import { localRest, resetState } from "./helpers";

/**
 * Live markets come from the database: the scheduled job closes a live market
 * (is_live = false) once its end time passes, so the static catalogue's flag
 * goes stale during the day.
 */
let LIVE_TITLES: string[] = [];
test.beforeAll(async () => {
  const rows = await localRest<Array<{ title: string }>>("markets?is_live=eq.true&status=neq.draft&select=title");
  LIVE_TITLES = rows.map((r) => r.title);
});

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
