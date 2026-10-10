import { test, expect, type Page } from "@playwright/test";
import { localRest, localUserId, openMarket, resetState, signInWithEmail, signOut, uniqueEmail } from "./helpers";

/**
 * Portfolio from the database (B4/B5): orders go through place_order(), and
 * the dashboard reads the user's own positions, orders and ledger back.
 */

async function placeOneOrder(page: Page, amount = "500") {
  const m = await openMarket(true);
  await page.goto(`/market/${m.slug}`);
  const panel = (await page.getByTestId("trade-panel").isVisible())
    ? page.getByTestId("trade-panel")
    : (await page.getByTestId("mobile-trade-bar").getByRole("button").first().click(), page.getByTestId("trade-modal"));
  await panel.locator('[data-testid="amount-input"]').fill(amount);
  await panel.getByRole("button", { name: /place order/i }).click();
  await expect(page.getByText(/order placed successfully/i).first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await resetState(page);
});

test("signed out: no portfolio, and the API refuses", async ({ page, request }) => {
  await page.goto("/dashboard");
  await expect(page.getByText(/no open positions yet/i)).toBeVisible();
  await expect(page.getByTestId("orders-section")).toHaveCount(0);
  const res = await request.get("/api/portfolio");
  expect(res.status()).toBe(401);
  expect(res.headers()["cache-control"]).toMatch(/no-store/);
});

test("an order is written to the database and survives a reload", async ({ page }) => {
  const email = await signInWithEmail(page);
  await placeOneOrder(page, "500");

  const id = await localUserId(email);
  const orders = await localRest<Array<{ amount: number; shares: number; avg_price: number }>>(
    `orders?user_id=eq.${id}&select=amount,shares,avg_price`
  );
  expect(orders).toHaveLength(1);
  expect(Number(orders[0].amount)).toBe(500);
  // LMSR: a ₹500 order pays slightly more than the starting price per share.
  expect(Number(orders[0].shares)).toBeGreaterThan(0);
  const [wallet] = await localRest<Array<{ balance: number }>>(`wallets?user_id=eq.${id}&select=balance`);
  expect(Number(wallet.balance)).toBe(9500);

  await page.goto("/dashboard");
  await expect(page.getByTestId("order-row")).toHaveCount(1);
  await expect(page.locator('a[href^="/market/"]:visible').first()).toBeVisible();
  const rowsBefore = await page.locator('a[href^="/market/"]:visible').count();
  await page.reload();
  await expect(page.getByTestId("order-row")).toHaveCount(1);
  await expect(page.locator('a[href^="/market/"]:visible')).toHaveCount(rowsBefore);
  // Ledger shows the welcome credit and the order.
  await expect(page.getByTestId("ledger-row")).toHaveCount(2);
  // Header menu shows the real balance.
  await page.getByRole("button", { name: /account menu/i }).click();
  await expect(page.getByTestId("menu-balance")).toContainText("9,500");
});

test("a second order on the same outcome merges into one position", async ({ page }) => {
  const email = await signInWithEmail(page);
  await placeOneOrder(page, "300");
  await placeOneOrder(page, "200");
  const id = await localUserId(email);
  const positions = await localRest<Array<{ shares: number; avg_price: number }>>(
    `positions?user_id=eq.${id}&select=shares,avg_price`
  );
  expect(positions).toHaveLength(1);
  const orders = await localRest<Array<{ shares: number }>>(`orders?user_id=eq.${id}&select=shares`);
  const total = orders.reduce((s, o) => s + Number(o.shares), 0);
  expect(Number(positions[0].shares)).toBeCloseTo(total, 6);
  expect(Number(positions[0].avg_price)).toBeCloseTo(500 / total, 6);
});

test("two accounts never see each other's portfolio", async ({ page }) => {
  const a = uniqueEmail("a");
  await signInWithEmail(page, a);
  await placeOneOrder(page, "400");
  await page.goto("/dashboard");
  await expect(page.getByTestId("order-row")).toHaveCount(1);
  await signOut(page);

  await signInWithEmail(page, uniqueEmail("b"));
  await page.goto("/dashboard");
  await expect(page.getByText(/no open positions yet/i)).toBeVisible();
  await expect(page.getByTestId("order-row")).toHaveCount(0);
  const res = await page.request.get("/api/portfolio");
  const body = (await res.json()) as { balance: number; orders: { total: number }; positions: unknown[] };
  expect(body.balance).toBe(10000);
  expect(body.orders.total).toBe(0);
  expect(body.positions).toEqual([]);
});

test("old localStorage positions are ignored", async ({ page }) => {
  const email = await signInWithEmail(page);
  await page.evaluate(
    (k) => window.localStorage.setItem(k, JSON.stringify([{ marketId: "x", outcomeId: "y", shares: 100, avgPrice: 0.2 }])),
    `bp-positions:v1:${email}`
  );
  await page.goto("/dashboard");
  await expect(page.getByText(/no open positions yet/i)).toBeVisible();
});
