import { test, expect } from "@playwright/test";
import { resetState, signInWithGoogle, signOut } from "./helpers";

const KEY_A = "bp-positions:v1:arjun.mehta@gmail.com";

/** Places one order on the first cricket market. */
async function placeOneOrder(page: import("@playwright/test").Page) {
  await page.goto("/markets/cricket");
  await page.getByRole("button", { name: /^Trade$/ }).first().click();
  await page.getByRole("button", { name: /place order/i }).click();
  await expect(page.getByRole("status")).toBeVisible();
}

async function storedPositions(page: import("@playwright/test").Page, key = KEY_A) {
  return page.evaluate((k) => {
    try {
      return JSON.parse(window.localStorage.getItem(k) ?? "null");
    } catch {
      return null;
    }
  }, key);
}

test.beforeEach(async ({ page }) => {
  await resetState(page);
});

test("signed-out state shows no positions", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText(/no open positions yet/i)).toBeVisible();
});

test("a placed order survives a reload with an averaged price", async ({ page }) => {
  await signInWithGoogle(page);
  await placeOneOrder(page);

  const before = await storedPositions(page);
  expect(Array.isArray(before)).toBe(true);
  expect(before.length).toBeGreaterThan(0);

  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();
  const visibleRows = page.locator('a[href^="/market/"]:visible');
  await expect(visibleRows).not.toHaveCount(0);
  const rowsBefore = await visibleRows.count();

  await page.reload();
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();
  await expect(visibleRows).toHaveCount(rowsBefore);

  // Averaging: a second order on the same outcome must merge into the existing
  // row rather than appending a new one. The order targets whichever market the
  // first Trade button belongs to, so find the entry that actually changed
  // instead of assuming an index.
  await placeOneOrder(page);
  const after = await storedPositions(page);
  expect(after.length).toBe(before.length);

  type Stored = { marketId: string; outcomeId: string; shares: number; avgPrice: number };
  const changed = (after as Stored[]).filter((a) => {
    const prev = (before as Stored[]).find(
      (b) => b.marketId === a.marketId && b.outcomeId === a.outcomeId
    );
    return prev !== undefined && a.shares > prev.shares;
  });

  expect(changed).toHaveLength(1);
  expect(changed[0].avgPrice).toBeGreaterThan(0);
  expect(changed[0].avgPrice).toBeLessThanOrEqual(1);

  // Total exposure grew, and the dashboard still shows one row per position.
  const totalBefore = (before as Stored[]).reduce((t, p) => t + p.shares, 0);
  const totalAfter = (after as Stored[]).reduce((t, p) => t + p.shares, 0);
  expect(totalAfter).toBeGreaterThan(totalBefore);
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();
  await expect(page.locator('a[href^="/market/"]:visible')).toHaveCount(rowsBefore);
});

test("different accounts keep separate positions", async ({ page }) => {
  await signInWithGoogle(page, 0);
  await placeOneOrder(page);
  const accountA = await storedPositions(page);
  await signOut(page);

  // Signed out: memory is cleared even though storage is retained.
  await page.goto("/dashboard");
  await expect(page.getByText(/no open positions yet/i)).toBeVisible();

  await signInWithGoogle(page, 1);
  const keyB = "bp-positions:v1:priya.sharma@gmail.com";
  const accountB = await storedPositions(page, keyB);

  // B gets its own seeded ledger, not A's post-order ledger.
  expect(accountB).not.toEqual(accountA);
  // A's data is untouched by B signing in.
  expect(await storedPositions(page, KEY_A)).toEqual(accountA);

  // Signing back in as A restores A's positions.
  await signOut(page);
  await signInWithGoogle(page, 0);
  expect(await storedPositions(page, KEY_A)).toEqual(accountA);
});

test("corrupt stored positions do not crash the app", async ({ page }) => {
  await page.evaluate((k) => {
    window.localStorage.setItem(k, "{not json at all");
    window.localStorage.setItem(
      "bp-session",
      JSON.stringify({ method: "google", handle: "arjun.mehta@gmail.com", initial: "A" })
    );
  }, KEY_A);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  await expect(page.getByText(/portfolio value/i)).toBeVisible();
});

test("structurally invalid entries are discarded, valid ones kept", async ({ page }) => {
  await page.evaluate((k) => {
    window.localStorage.setItem(
      k,
      JSON.stringify([
        { marketId: "mkt_002", outcomeId: "mumbai-indians", shares: 100, avgPrice: 0.2 },
        { marketId: "does_not_exist", outcomeId: "yes", shares: 10, avgPrice: 0.5 },
        { marketId: "mkt_002", outcomeId: "no-such-outcome", shares: 10, avgPrice: 0.5 },
        { marketId: "mkt_002", outcomeId: "mumbai-indians", shares: -5, avgPrice: 0.2 },
        { marketId: "mkt_002", outcomeId: "mumbai-indians", shares: 10, avgPrice: 9 },
        "nonsense",
      ])
    );
    window.localStorage.setItem(
      "bp-session",
      JSON.stringify({ method: "google", handle: "arjun.mehta@gmail.com", initial: "A" })
    );
  }, KEY_A);

  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();
  // Only the single valid entry should survive the validator.
  await expect(page.locator('a[href^="/market/"]:visible')).toHaveCount(1);
});
