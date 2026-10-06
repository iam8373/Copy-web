import { test, expect } from "@playwright/test";
import { MARKETS } from "../../src/data/markets";
import { STORAGE_KEY } from "../../src/i18n";
import { en } from "../../src/i18n/en";
import { hi } from "../../src/i18n/hi";
import { getMarketActivity, getOrderBook, getPriceHistory, LADDER_SIZES } from "../../src/services/markets/market-data";
import { resetState, signInWithPhone } from "./helpers";

/** Work order 4, Phase 4: market page. */

const BINARY = "/market/will-india-win-the-2026-t20-world-cup";
const MULTI = "/market/ipl-2026-winner";
const bySlug = (slug: string) => MARKETS.find((m) => m.slug === slug)!;

test.describe("market data service", () => {
  test("price history ends at the live price and is deterministic", () => {
    const m = bySlug("ipl-2026-winner");
    const now = Date.UTC(2026, 9, 6, 12);
    const a = getPriceHistory(m, "1W", now);
    const b = getPriceHistory(m, "1W", now);
    expect(a).toEqual(b);
    expect(a.isDemo).toBe(true);
    const last = a.points[a.points.length - 1];
    for (const o of m.outcomes) expect(last[o.id]).toBeCloseTo(o.price * 100, 1);
    for (const p of a.points) for (const o of m.outcomes) {
      expect(p[o.id]).toBeGreaterThanOrEqual(0);
      expect(p[o.id]).toBeLessThanOrEqual(100);
    }
  });

  test("order book ladder starts at the displayed price and costs rise with size", () => {
    for (const slug of ["will-india-win-the-2026-t20-world-cup", "ipl-2026-winner"]) {
      const m = bySlug(slug);
      for (const o of m.outcomes) {
        const book = getOrderBook(m, o.id);
        expect(book.rows.map((r) => r.shares)).toEqual([...LADDER_SIZES]);
        expect(book.price).toBeCloseTo(o.price, 2);
        for (let i = 1; i < book.rows.length; i++) {
          expect(book.rows[i].cost).toBeGreaterThan(book.rows[i - 1].cost);
          expect(book.rows[i].avgPrice).toBeGreaterThanOrEqual(book.rows[i - 1].avgPrice);
          expect(book.rows[i].priceAfter).toBeGreaterThan(book.rows[i - 1].priceAfter);
        }
        // Buying never costs less than the current price per share, nor more than ₹1.
        for (const r of book.rows) {
          expect(r.avgPrice).toBeGreaterThanOrEqual(o.price - 0.005);
          expect(r.avgPrice).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  test("activity is honestly empty until the backend exists", () => {
    expect(getMarketActivity(bySlug("ipl-2026-winner"))).toEqual([]);
  });
});

test.describe("market page", () => {
  test.beforeEach(async ({ page }) => {
    await resetState(page);
  });

  test("chart is labelled as demo data and switches range", async ({ page }) => {
    await page.goto(BINARY);
    const chart = page.getByTestId("price-chart");
    await expect(chart.getByTestId("demo-data-badge")).toHaveText(en.market.demoData);
    await chart.getByRole("button", { name: en.market.aboutDemoData }).click();
    await expect(page.getByRole("tooltip")).toContainText(en.market.demoDataTip);

    const canvas = chart.getByTestId("chart-canvas");
    await expect(canvas.locator("svg.recharts-surface").first()).toBeVisible();
    await expect(canvas).toHaveAttribute("aria-label", /Yes: .* over 1W/);
    await chart.locator('[data-range="1M"]').click();
    await expect(chart.locator('[data-range="1M"]')).toHaveAttribute("aria-pressed", "true");
    await expect(canvas).toHaveAttribute("aria-label", /over 1M/);
  });

  test("multi-outcome chart plots the top four with a legend", async ({ page }) => {
    await page.goto(MULTI);
    const legend = page.getByTestId("chart-legend").locator("li");
    await expect(legend).toHaveCount(4);
    await expect(page.locator('[data-testid="chart-canvas"] .recharts-line')).toHaveCount(4);
    await expect(page.getByTestId("outcome-list").locator("li")).toHaveCount(
      bySlug("ipl-2026-winner").outcomes.length
    );
  });

  test("order book is an AMM ladder in rupees with an explanation", async ({ page }) => {
    await page.goto(BINARY);
    const book = page.getByTestId("order-book");
    await expect(book.getByRole("heading", { name: en.market.orderBook })).toBeVisible();
    await expect(book.getByTestId("order-book-row")).toHaveCount(LADDER_SIZES.length);
    await expect(book).not.toContainText("$");
    await expect(book).toContainText("₹");
    await book.getByRole("button", { name: en.market.aboutOrderBook }).click();
    await expect(page.getByRole("tooltip")).toContainText("automated market maker");

    // Switching to No re-quotes the ladder.
    const before = await book.getByTestId("order-book-cost").first().innerText();
    await book.getByRole("button", { name: "No", exact: true }).click();
    await expect(book.getByRole("button", { name: "No", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(book.getByTestId("order-book-cost").first()).not.toHaveText(before);
  });

  test("activity, holders, positions and comments are empty states, not fake rows", async ({ page }) => {
    await page.goto(BINARY);
    const tabs = page.getByRole("tablist", { name: en.market.details });
    const expected = [
      [en.market.activity, en.market.noActivity],
      [en.market.holders, en.market.noHolders],
      [en.market.positions, en.market.noPositions],
      [en.market.comments, en.market.noComments],
    ];
    for (const [tab, empty] of expected) {
      await tabs.getByRole("tab", { name: tab }).click();
      await expect(page.getByRole("tabpanel")).toContainText(empty);
    }
    // The old generated activity used these handles.
    await expect(page.locator("main")).not.toContainText(/arjun_m|priya\.s|bharat_trades/);
  });

  test("rules accordion is collapsed by default and toggles", async ({ page }) => {
    await page.goto(BINARY);
    const toggle = page.getByRole("button", { name: en.market.rules });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText(en.market.settlement)).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(en.market.settlement)).toBeVisible();
    await expect(page.getByText(bySlug("will-india-win-the-2026-t20-world-cup").resolutionSource)).toBeVisible();
  });

  test("no horizontal overflow at 360px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    for (const path of [BINARY, MULTI]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test("Hindi: page chrome is translated", async ({ page }) => {
    await page.evaluate((k) => window.localStorage.setItem(k, "hi"), STORAGE_KEY);
    await page.goto(BINARY);
    const main = page.locator("main");
    await expect(main.getByRole("heading", { name: hi.market.orderBook })).toBeVisible();
    await expect(main.getByTestId("demo-data-badge")).toHaveText(hi.market.demoData);
    for (const english of ["Order Book", "Back to", "Rules & resolution", "Demo data", "Top holders"]) {
      await expect(main).not.toContainText(english);
    }
  });
});

test.describe("trade panel (lg+)", () => {
  test.skip(({ isMobile }) => isMobile, "desktop layout");

  test.beforeEach(async ({ page }) => {
    await resetState(page);
  });

  test("sticky panel is shown and the mobile bar is hidden", async ({ page }) => {
    await page.goto(BINARY);
    await expect(page.getByTestId("trade-panel")).toBeVisible();
    await expect(page.getByTestId("mobile-trade-bar")).toBeHidden();
    await page.mouse.wheel(0, 900);
    await expect(page.getByTestId("trade-panel")).toBeInViewport();
  });

  test("order book and panel share the selected outcome", async ({ page }) => {
    await page.goto(BINARY);
    await page.getByTestId("order-book").getByRole("button", { name: "No", exact: true }).click();
    await expect(
      page.getByTestId("trade-panel").getByRole("button", { name: /^Buy No/ })
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("multi-outcome Buy selects that outcome in the panel", async ({ page }) => {
    await page.goto(MULTI);
    await page.getByTestId("outcome-list").getByRole("button", { name: "Buy Chennai Super Kings" }).click();
    await expect(
      page.getByTestId("trade-panel").getByRole("button", { name: /^Buy Chennai Super Kings/ })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("trade-modal")).toHaveCount(0);
  });

  test("signed-in order from the panel fills", async ({ page }) => {
    await page.goto(BINARY);
    await signInWithPhone(page);
    await page.getByTestId("trade-panel").getByRole("button", { name: /place order/i }).click();
    await expect(page.getByText(/order placed successfully/i)).toBeVisible();
  });
});

test.describe("mobile trade bar (< lg)", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile layout");

  test.beforeEach(async ({ page }) => {
    await resetState(page);
  });

  test("fixed Yes/No bar sits above the bottom nav and opens the sheet", async ({ page }) => {
    await page.goto(BINARY);
    await expect(page.getByTestId("trade-panel")).toBeHidden();
    const bar = page.getByTestId("mobile-trade-bar");
    await expect(bar).toBeInViewport();
    const barBox = (await bar.boundingBox())!;
    const navBox = (await page.getByRole("navigation", { name: "Main" }).boundingBox())!;
    expect(Math.round(barBox.y + barBox.height)).toBeLessThanOrEqual(Math.round(navBox.y) + 1);

    await bar.getByRole("button", { name: /^Buy No/ }).click();
    const sheet = page.getByTestId("trade-modal");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: /^Buy No/ })).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
  });

  test("multi-outcome Buy opens the sheet on that outcome", async ({ page }) => {
    await page.goto(MULTI);
    await page.getByTestId("outcome-list").getByRole("button", { name: "Buy Chennai Super Kings" }).click();
    await expect(
      page.getByTestId("trade-modal").getByRole("button", { name: /^Buy Chennai Super Kings/ })
    ).toHaveAttribute("aria-pressed", "true");
  });
});
