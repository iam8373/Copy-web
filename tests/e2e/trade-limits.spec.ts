import { test, expect, type Page } from "@playwright/test";
import {
  MAX_TRADE,
  MIN_TRADE,
  TRADE_STEP,
  formatLimit,
  validateAmount,
} from "../../src/lib/trade-limits";
import { OrderInput } from "../../src/lib/order-schema";
import { openMarket, resetState, signInWithEmail } from "./helpers";

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

// ------------------------------------------------ server input (no UI at all)
// The Server Action validates with OrderInput before calling place_order(),
// and the database refuses invalid amounts again (supabase/tests/004).
test.describe("the server's order schema refuses invalid amounts even if the UI is bypassed", () => {
  const base = {
    marketId: "00000000-0000-4000-8000-000000000001",
    outcomeId: "00000000-0000-4000-8000-000000000002",
    idempotencyKey: "abcdefgh-1234",
  };
  for (const bad of [0, -5, NaN, 1e9, Infinity, 0.5, 1.234, MAX_TRADE + 1]) {
    test(`amount ${bad} is refused`, () => {
      expect(OrderInput.safeParse({ ...base, amount: bad }).success).toBe(false);
    });
  }
  for (const good of [MIN_TRADE, 12.5, MAX_TRADE]) {
    test(`amount ${good} is accepted`, () => {
      expect(OrderInput.safeParse({ ...base, amount: good }).success).toBe(true);
    });
  }
  test("ids must be uuids and the idempotency key well-formed", () => {
    expect(OrderInput.safeParse({ ...base, amount: 10, marketId: "mkt_001" }).success).toBe(false);
    expect(OrderInput.safeParse({ ...base, amount: 10, idempotencyKey: "short" }).success).toBe(false);
    expect(OrderInput.safeParse({ ...base, amount: 10, idempotencyKey: "has spaces in it" }).success).toBe(false);
  });
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

    // ₹1 really fills. (The maximum is a valid amount but more than the
    // 10,000 welcome credit, so the server refuses it for lack of funds.)
    await input.fill("1");
    await place.click();
    await expect(page.getByText(/order placed successfully/i)).toBeVisible();
  });

  test("an order larger than the balance is refused by the server with a clear message", async ({ page }) => {
    await page.locator('[data-testid="amount-input"]').fill(String(MAX_TRADE));
    await page.getByRole("button", { name: /place order/i }).click();
    await expect(page.getByText(/not enough credits/i)).toBeVisible();
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
  const m = await openMarket(false);
  await page.goto(`/market/${m.slug}`);
  // Below lg the panel is the trade sheet, opened from the fixed bar.
  if (isMobile) await page.getByTestId("mobile-trade-bar").getByRole("button").click();
  const input = page.locator(isMobile ? "#amount" : "#detail-amount");
  await expect(input).toHaveAttribute("max", String(MAX_TRADE));
  await input.fill("0");
  await expect(page.getByRole("button", { name: /place order/i })).toBeDisabled();
  await input.fill("750");
  await expect(page.getByRole("button", { name: /place order/i })).toBeEnabled();
});
