import { test, expect } from "@playwright/test";
import { localRest, resetState, signInWithEmail, signOut, uniqueEmail } from "./helpers";

// Positions are still kept in localStorage per account until backend Phase B5.
const keyFor = (email: string) => `bp-positions:v1:${email}`;

/** Places one order on the first cricket market. */
async function placeOneOrder(page: import("@playwright/test").Page) {
  await page.goto("/markets/cricket");
  await page.getByRole("button", { name: /^Trade$/ }).first().click();
  await page.getByRole("button", { name: /place order/i }).click();
  await expect(page.getByRole("status")).toBeVisible();
}

async function storedPositions(page: import("@playwright/test").Page, key: string) {
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
  const email = await signInWithEmail(page);
  const KEY_A = keyFor(email);
  await placeOneOrder(page);

  const before = await storedPositions(page, KEY_A);
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
  const after = await storedPositions(page, KEY_A);
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
  const emailA = uniqueEmail("a");
  const emailB = uniqueEmail("b");
  await signInWithEmail(page, emailA);
  await placeOneOrder(page);
  const accountA = await storedPositions(page, keyFor(emailA));
  expect(accountA.length).toBeGreaterThan(0);
  await signOut(page);

  // Signed out: memory is cleared even though storage is retained.
  await page.goto("/dashboard");
  await expect(page.getByText(/no open positions yet/i)).toBeVisible();

  // A new account starts empty: no demo seeding any more.
  await signInWithEmail(page, emailB);
  expect(await storedPositions(page, keyFor(emailB))).toBeNull();
  await page.goto("/dashboard");
  await expect(page.getByText(/no open positions yet/i)).toBeVisible();
  expect(await storedPositions(page, keyFor(emailA))).toEqual(accountA);

  await signOut(page);
  await signInWithEmail(page, emailA);
  expect(await storedPositions(page, keyFor(emailA))).toEqual(accountA);
});

test("corrupt stored positions do not crash the app", async ({ page }) => {
  const email = await signInWithEmail(page);
  await page.evaluate((k) => window.localStorage.setItem(k, "{not json at all"), keyFor(email));
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  await expect(page.getByText(/portfolio value/i)).toBeVisible();
});

test("structurally invalid entries are discarded, valid ones kept", async ({ page }) => {
  const email = await signInWithEmail(page);
  // Markets come from the database now, so use real ids.
  const [m] = await localRest<Array<{ id: string; outcomes: Array<{ id: string; label: string }> }>>(
    "markets?slug=eq.ipl-2026-winner&select=id,outcomes!outcomes_market_id_fkey(id,label)"
  );
  const mi = m.outcomes.find((o) => o.label === "Mumbai Indians")!.id;
  await page.evaluate(
    ([k, market, outcome]) => {
      window.localStorage.setItem(
        k,
        JSON.stringify([
          { marketId: market, outcomeId: outcome, shares: 100, avgPrice: 0.2 },
          { marketId: "does_not_exist", outcomeId: "yes", shares: 10, avgPrice: 0.5 },
          { marketId: market, outcomeId: "no-such-outcome", shares: 10, avgPrice: 0.5 },
          { marketId: market, outcomeId: outcome, shares: -5, avgPrice: 0.2 },
          { marketId: market, outcomeId: outcome, shares: 10, avgPrice: 9 },
          "nonsense",
        ])
      );
    },
    [keyFor(email), m.id, mi]
  );
  await page.reload();
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();
  await page.goto("/dashboard");
  // Only the single valid entry should survive the validator.
  await expect(page.locator('a[href^="/market/"]:visible')).toHaveCount(1);
});
