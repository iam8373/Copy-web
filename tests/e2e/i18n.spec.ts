import { test, expect } from "@playwright/test";
import en from "../../src/i18n/en";
import hi from "../../src/i18n/hi";
import { LOCALES, LOCALE_META, STORAGE_KEY } from "../../src/i18n";
import { resetState } from "./helpers";

/** Flattens a dictionary to "section.key" strings for exact comparison. */
function flatten(dict: Record<string, Record<string, string>>) {
  return Object.entries(dict)
    .flatMap(([section, entries]) => Object.keys(entries).map((k) => `${section}.${k}`))
    .sort();
}

test.describe("dictionary parity", () => {
  test("hindi has exactly the same keys as english", () => {
    expect(flatten(hi as never)).toEqual(flatten(en as never));
  });

  test("no locale has an empty string", () => {
    for (const [section, entries] of Object.entries(hi as never) as [
      string,
      Record<string, string>,
    ][]) {
      for (const [key, value] of Object.entries(entries)) {
        expect(value.trim(), `hi.${section}.${key} is empty`).not.toBe("");
      }
    }
  });

  test("every advertised locale has metadata", () => {
    for (const l of LOCALES) {
      expect(LOCALE_META[l].label.trim()).not.toBe("");
      expect(LOCALE_META[l].script).toBeTruthy();
    }
  });
});

test.describe("language switching", () => {
  test.beforeEach(async ({ page }) => {
    await resetState(page);
  });

  test("switching to Hindi translates chrome, sets html lang, and persists", async ({
    page,
  }) => {
    await page.goto("/markets/cricket");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.evaluate((k) => window.localStorage.setItem(k, "hi"), STORAGE_KEY);
    await page.reload();

    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
    await expect(page.locator("html")).toHaveAttribute("data-script", "devanagari");

    // Nav, sort controls and card chrome are all translated.
    await expect(page.getByRole("link", { name: hi.nav.cricket, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: hi.sort.popular })).toBeVisible();
    await expect(page.locator("body")).toContainText(hi.card.trade);
    await expect(page.locator("footer")).toContainText(hi.footer.terms);

    // Subfilter chips show translated text but still filter on the English key.
    const ipl = page.locator('[data-testid="subfilter-chip"][data-filter="IPL"]');
    await expect(ipl).toContainText(hi.chips.IPL);
    const before = await page.locator('[data-testid="shown-count"]').innerText();
    await ipl.click();
    await expect(page.locator('[data-testid="shown-count"]')).not.toHaveText(before);

    // Numbers stay Latin with the rupee symbol.
    await expect(page.locator("body")).toContainText("₹");
    expect(await page.locator('[data-testid="shown-count"]').innerText()).toMatch(/\d/);

    // Survives another reload.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  });

  test("unknown stored locale falls back to English", async ({ page }) => {
    await page.evaluate((k) => window.localStorage.setItem(k, "klingon"), STORAGE_KEY);
    await page.goto("/markets/cricket");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("button", { name: en.sort.popular })).toBeVisible();
  });

  test("auth modal is translated in Hindi", async ({ page }) => {
    await page.evaluate((k) => window.localStorage.setItem(k, "hi"), STORAGE_KEY);
    await page.goto("/");
    // The header label collapses to the short form on mobile viewports.
    await page
      .getByRole("banner")
      .getByRole("button", {
        name: new RegExp(`${hi.header.signIn}|^${hi.header.signInShort}$`),
      })
      .click();

    await expect(page.getByRole("heading", { name: hi.auth.title })).toBeVisible();
    await expect(page.getByRole("button", { name: hi.auth.sendOtp })).toBeVisible();
    await expect(page.locator("body")).toContainText(hi.auth.ageConfirm);
  });
});

test.describe("layout at 375px with the longest translations", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("category nav, chips, bottom nav and trade modal do not overflow", async ({
    page,
  }) => {
    await resetState(page);
    await page.evaluate((k) => window.localStorage.setItem(k, "hi"), STORAGE_KEY);
    await page.goto("/markets/entertainment");

    const docWidth = await page.evaluate(() => document.documentElement.clientWidth);

    // Nothing may push the document into horizontal scroll.
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(docWidth + 1);

    // The bottom nav must fit its four items on one row.
    const nav = page.locator("nav").last();
    const navBox = await nav.boundingBox();
    expect(navBox!.width).toBeLessThanOrEqual(docWidth + 1);

    // The trade modal must stay inside the viewport too.
    await page.getByRole("button", { name: new RegExp(hi.card.trade) }).first().click();
    await expect(page.getByRole("button", { name: hi.trade.placeOrder })).toBeVisible();
    const modalBox = await page
      .getByRole("button", { name: hi.trade.placeOrder })
      .boundingBox();
    expect(modalBox!.x).toBeGreaterThanOrEqual(0);
    expect(modalBox!.x + modalBox!.width).toBeLessThanOrEqual(docWidth + 1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(docWidth + 1);
  });
});
