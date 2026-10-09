import { test, expect, type Page } from "@playwright/test";
import {
  MAX_TRADE,
  MIN_TRADE,
  TRADE_STEP,
  formatLimit,
  validateAmount,
} from "../../src/lib/trade-limits";
import { useMarketStore } from "../../src/store/useMarketStore";
import { MARKETS } from "../../src/data/markets";
import { resetState, signInWithEmail } from "./helpers";

// ---------------------------------------------------------------- pure logic
test.describe("validateAmount", () => {
  test("rejects 0, negatives, empty, NaN, Infinity and 1e9", () => {
    for (const bad of [0, -5, "", "   ", "abc", NaN, Infinity, -Infinity, 1e9, "1e9", null, undefined]) {
      expect(validateAmount(bad).ok, `accepted ${String(bad)}`).toBe(false);
    }
  });

  test("gives the right reason", () => {
    expect(validateAmount("")).toEqual({ ok: false, reason: "notNumber" });
    expect(validateAmount(0)).toEqual({ ok: false, reason: "belowMin" });
    expect(validateAmount(-5)).toEqual({ ok: false, reason: "belowMin" });
    expect(validateAmount(1e9)).toEqual({ ok: false, reason: "aboveMax" });
  });

  test("accepts the minimum and the maximum exactly", () => {
    expect(validateAmount(MIN_TRADE)).toEqual({ ok: true, value: 1 });
    expect(validateAmount(MAX_TRADE)).toEqual({ ok: true, value: 100_000 });
    expect(validateAmount("1")).toEqual({ ok: true, value: 1 });
    expect(validateAmount(MAX_TRADE + 1).ok).toBe(false);
  });

  test("limits render with en-IN grouping", () => {
    expect(formatLimit(MIN_TRADE)).toBe("₹1");
    expect(formatLimit(MAX_TRADE)).toBe("₹1,00,000");
  });
});

// -------------------------------------------------------- store (no UI at all)
test.describe("placeOrder refuses invalid amounts even if the UI is bypassed", () => {
  const market = MARKETS[0];
  const session = {
    method: "google" as const,
    handle: "store-test@example.com",
    initial: "S",
    ageConfirmedAt: "2026-01-01T00:00:00.000Z",
  };

  test.beforeEach(() => {
    useMarketStore.setState({ session, positions: [], toasts: [], lastFill: null, trade: null });
  });

  for (const bad of [0, -5, NaN, 1e9, Infinity]) {
    test(`amount ${bad} is refused with an error toast`, () => {
      useMarketStore.getState().placeOrder({
        market,
        outcomeId: market.outcomes[0].id,
        amount: bad,
      });
      const s = useMarketStore.getState();
      expect(s.positions).toHaveLength(0);
      expect(s.lastFill).toBeNull();
      expect(s.toasts.at(-1)).toMatchObject({ titleKey: "invalidAmount", tone: "error" });
    });
  }

  for (const good of [MIN_TRADE, MAX_TRADE]) {
    test(`amount ${good} is accepted`, () => {
      useMarketStore.getState().placeOrder({
        market,
        outcomeId: market.outcomes[0].id,
        amount: good,
      });
      const s = useMarketStore.getState();
      expect(s.positions).toHaveLength(1);
      expect(s.lastFill).not.toBeNull();
      expect(s.toasts.at(-1)).toMatchObject({ titleKey: "orderPlaced" });
    });
  }
});

// ------------------------------------------------------------------------ UI
async function openQuickTrade(page: Page) {
  await page.goto("/markets/cricket");
  await page.getByRole("button", { name: /^Trade$/ }).first().click();
  await expect(page.locator('[data-testid="amount-input"]')).toBeVisible();
}

test.describe("trade modal amount field", () => {
  test.beforeEach(async ({ page }) => {
    await resetState(page);
    await signInWithEmail(page);
    await openQuickTrade(page);
  });

  test("input and slider share min, max and step", async ({ page }) => {
    for (const sel of ['[data-testid="amount-input"]', '[data-testid="amount-slider"]']) {
      const el = page.locator(sel);
      await expect(el).toHaveAttribute("min", String(MIN_TRADE));
      await expect(el).toHaveAttribute("max", String(MAX_TRADE));
      await expect(el).toHaveAttribute("step", String(TRADE_STEP));
    }
    await expect(page.locator("body")).toContainText("₹1,00,000");
  });

  for (const bad of ["0", "-5", "", "1000000000"]) {
    test(`"${bad || "(empty)"}" shows an inline error and disables Place order`, async ({
      page,
    }) => {
      await page.locator('[data-testid="amount-input"]').fill(bad);
      await expect(page.locator('[data-testid="amount-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="amount-input"]')).toHaveAttribute(
        "aria-invalid",
        "true"
      );
      await expect(page.getByRole("button", { name: /place order/i })).toBeDisabled();
    });
  }

  test("₹1 and the maximum are accepted", async ({ page }) => {
    const input = page.locator('[data-testid="amount-input"]');
    const place = page.getByRole("button", { name: /place order/i });

    await input.fill("1");
    await expect(page.locator('[data-testid="amount-error"]')).toHaveCount(0);
    await expect(place).toBeEnabled();

    await input.fill(String(MAX_TRADE));
    await expect(page.locator('[data-testid="amount-error"]')).toHaveCount(0);
    await expect(place).toBeEnabled();

    await place.click();
    await expect(page.getByText(/order placed successfully/i)).toBeVisible();
  });

  test("typing moves the slider, and the slider moves the input", async ({ page }) => {
    const input = page.locator('[data-testid="amount-input"]');
    const slider = page.locator('[data-testid="amount-slider"]');

    await input.fill("2500");
    await expect(slider).toHaveValue("2500");

    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await expect(input).toHaveValue("2501");
    await expect(slider).toHaveValue("2501");

    await page.getByRole("button", { name: /^Max$/ }).click();
    await expect(input).toHaveValue(String(MAX_TRADE));
    await expect(slider).toHaveValue(String(MAX_TRADE));
  });

  test("above-max typing is kept, explained, and the slider pins to max", async ({ page }) => {
    await page.locator('[data-testid="amount-input"]').fill("250000");
    await expect(page.locator('[data-testid="amount-input"]')).toHaveValue("250000");
    await expect(page.locator('[data-testid="amount-error"]')).toContainText("₹1,00,000");
    await expect(page.locator('[data-testid="amount-slider"]')).toHaveValue(String(MAX_TRADE));
  });
});

test("the market detail panel uses the same limits", async ({ page, isMobile }) => {
  await resetState(page);
  await page.goto("/market/ipl-2026-winner");
  // Below lg the panel is the trade sheet, opened from the fixed bar.
  if (isMobile) await page.getByTestId("mobile-trade-bar").getByRole("button").click();
  const input = page.locator(isMobile ? "#amount" : "#detail-amount");
  await expect(input).toHaveAttribute("max", String(MAX_TRADE));
  await input.fill("0");
  await expect(page.getByRole("button", { name: /place order/i })).toBeDisabled();
  await input.fill("750");
  await expect(page.getByRole("button", { name: /place order/i })).toBeEnabled();
});
