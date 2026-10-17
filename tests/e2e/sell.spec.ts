import { test, expect, type Page } from "@playwright/test";
import { DICTIONARIES, LOCALES, STORAGE_KEY } from "../../src/i18n";
import { localRest, localUserId, openMarket, resetState, signInWithEmail, uniqueEmail } from "./helpers";

/** Phase S1: sell-back in the trade panel, the trade sheet and the dashboard. */

const en = DICTIONARIES.en;

/** The first outcome on screen (binary markets: "Yes"; the REST embed is unordered). */
const yesOf = (m: { outcomes: Array<{ id: string; label: string }> }) => m.outcomes.find((o) => o.label === "Yes")!.id;

/** Signs in a fresh user and buys ₹500 of the first outcome through the UI. */
async function buyFirst(page: Page, slug: string, sheet = false) {
  await page.goto(`/market/${slug}`);
  if (sheet) {
    await page.getByTestId("mobile-trade-bar").getByRole("button").first().click();
  }
  const scope = page.getByTestId(sheet ? "trade-modal" : "trade-panel");
  await scope.getByTestId("trade-outcome").first().click();
  await scope.getByRole("button", { name: en.trade.placeOrder }).click();
  await expect(page.getByText(en.trade.orderConfirmed, { exact: true })).toBeVisible();
  if (!sheet) await expect(scope.getByTestId("trade-balance")).toContainText("9,500");
}

async function position(email: string, outcomeId: string) {
  const uid = await localUserId(email);
  const [p] = await localRest<Array<{ shares: number; realized_pnl: number }>>(
    `positions?user_id=eq.${uid}&outcome_id=eq.${outcomeId}&select=shares,realized_pnl`
  );
  return { uid, shares: Number(p?.shares ?? 0), realized: Number(p?.realized_pnl ?? 0) };
}

test.describe("sell-back", () => {
  test.skip(({ isMobile }) => isMobile, "desktop panel; the sheet has its own test below");

  test("buy then sell everything: proceeds shown first, credited, recorded as a sale", async ({ page }) => {
    const market = await openMarket(true, 3);
    await resetState(page);
    const email = await signInWithEmail(page, uniqueEmail("seller"));
    await buyFirst(page, market.slug);
    const panel = page.getByTestId("trade-panel");
    await panel.getByTestId("trade-side-sell").click();
    await expect(panel.getByTestId("sell-outcome")).toHaveCount(1);
    await panel.getByTestId("sell-chip-100").click();
    await expect(panel.getByTestId("sell-proceeds")).not.toHaveText("₹0.00");
    await expect(panel.getByTestId("sell-impact")).toContainText("→");
    await expect(panel.getByTestId("sell-realized")).toContainText("₹"); // an estimate; the DB check below is exact
    await panel.getByTestId("sell-submit").click();
    await expect(page.getByText(en.trade.saleConfirmed, { exact: true })).toBeVisible();
    await expect(panel.getByTestId("sell-nothing")).toBeVisible();

    const p = await position(email, yesOf(market));
    expect(p.shares).toBe(0);
    expect(p.realized).toBeLessThanOrEqual(0);
    expect(p.realized).toBeGreaterThan(-0.05);
    const sales = await localRest<Array<{ amount: number }>>(`ledger_entries?user_id=eq.${p.uid}&type=eq.sale&select=amount`);
    expect(sales).toHaveLength(1);
    expect(Number(sales[0].amount)).toBeGreaterThan(499.9);
    expect(Number(sales[0].amount)).toBeLessThanOrEqual(500);

    // Dashboard: the order shows as a sell, the ledger row is a translated "Sale".
    await page.goto("/dashboard");
    await expect(page.getByTestId("order-row").first()).toHaveAttribute("data-side", "sell");
    await expect(page.getByTestId("ledger-row").first()).toContainText(en.dashboard.ledgerSale);
  });

  test("partial sell keeps the rest; dashboard Sell opens the Sell tab on that outcome", async ({ page }) => {
    const market = await openMarket(true, 4);
    await resetState(page);
    const email = await signInWithEmail(page, uniqueEmail("partial"));
    await buyFirst(page, market.slug);
    const before = await position(email, yesOf(market));

    await page.goto("/dashboard");
    await page.getByTestId("position-sell").first().click();
    await expect(page).toHaveURL(new RegExp(`/market/${market.slug}\\?side=sell&outcome=${yesOf(market)}`));
    const panel = page.getByTestId("trade-panel");
    await expect(panel.getByTestId("trade-side-sell")).toHaveAttribute("aria-pressed", "true");
    await expect(panel.getByTestId("sell-outcome").first()).toHaveAttribute("aria-pressed", "true");
    await panel.getByTestId("sell-chip-50").click();
    await panel.getByTestId("sell-submit").click();
    await expect(page.getByText(en.trade.saleConfirmed, { exact: true })).toBeVisible();
    const after = await position(email, yesOf(market));
    expect(after.shares).toBeCloseTo(before.shares / 2, 6);

    // Oversell is refused in the form.
    await panel.getByLabel(en.trade.sharesToSell).fill(String(Math.ceil(after.shares + 1)));
    await expect(panel.getByRole("alert")).toContainText(en.trade.sellTooMany.split("{count}")[0].trim());
    await expect(panel.getByTestId("sell-submit")).toBeDisabled();
  });

  test("selling is blocked on a closed market", async ({ page }) => {
    await resetState(page);
    const email = await signInWithEmail(page, uniqueEmail("closedsell"));
    const uid = await localUserId(email);
    const [m] = await localRest<Array<{ id: string; outcomes: Array<{ id: string }> }>>(
      "markets?slug=eq.will-india-win-the-2026-t20-world-cup&select=id,outcomes!outcomes_market_id_fkey(id)"
    );
    await localRest("positions", {
      method: "POST",
      body: JSON.stringify({ user_id: uid, market_id: m.id, outcome_id: m.outcomes[0].id, shares: 10, avg_price: 0.5 }),
    });
    await page.goto("/market/will-india-win-the-2026-t20-world-cup");
    const panel = page.getByTestId("trade-panel");
    await panel.getByTestId("trade-side-sell").click();
    await panel.getByTestId("sell-chip-100").click();
    await expect(panel.getByTestId("sell-submit")).toBeDisabled();
    await expect(panel.getByTestId("market-closed-note")).toBeVisible();
  });

  test("all six locales label the Buy/Sell tabs and the empty Sell state", async ({ page }) => {
    const market = await openMarket(true, 0);
    await resetState(page);
    for (const code of LOCALES) {
      await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [STORAGE_KEY, code]);
      await page.goto(`/market/${market.slug}`);
      const panel = page.getByTestId("trade-panel");
      await expect(panel.getByTestId("trade-side-buy")).toHaveText(DICTIONARIES[code].trade.buyTab);
      await panel.getByTestId("trade-side-sell").click();
      await expect(panel.getByTestId("trade-side-sell")).toHaveText(DICTIONARIES[code].trade.sellTab);
      await expect(panel.getByTestId("sell-nothing")).toHaveText(DICTIONARIES[code].trade.sellNothing);
    }
    await page.evaluate((k) => window.localStorage.setItem(k, "en"), STORAGE_KEY);
  });
});

test.describe("sell-back on mobile", () => {
  test.skip(({ isMobile }) => !isMobile, "trade sheet layout");

  test("the dashboard Sell action opens the sheet on the Sell tab and sells", async ({ page }) => {
    const market = await openMarket(true, 5);
    await resetState(page);
    const email = await signInWithEmail(page, uniqueEmail("mobsell"));
    await buyFirst(page, market.slug, true);
    await page.goto("/dashboard");
    await page.getByTestId("position-card").first().getByTestId("position-sell").click();
    const sheet = page.getByTestId("trade-modal");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId("trade-side-sell")).toHaveAttribute("aria-pressed", "true");
    await sheet.getByTestId("sell-chip-100").click();
    await sheet.getByTestId("sell-submit").click();
    await expect(page.getByText(en.trade.saleConfirmed, { exact: true })).toBeVisible();
    expect((await position(email, yesOf(market))).shares).toBe(0);
  });
});
