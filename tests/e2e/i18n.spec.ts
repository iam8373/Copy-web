import { test, expect } from "@playwright/test";
import en from "../../src/i18n/en";
import hi from "../../src/i18n/hi";
import mr from "../../src/i18n/mr";
import bn from "../../src/i18n/bn";
import ta from "../../src/i18n/ta";
import { LOCALES, LOCALE_META, STORAGE_KEY } from "../../src/i18n";
import { resetState } from "./helpers";

/** Flattens a dictionary to "section.key" strings for exact comparison. */
function flatten(dict: Record<string, Record<string, string>>) {
  return Object.entries(dict)
    .flatMap(([section, entries]) => Object.keys(entries).map((k) => `${section}.${k}`))
    .sort();
}

/** Every translated locale. English is the reference, so it is excluded. */
const TRANSLATED = { hi, mr, bn, ta } as const;

test.describe("dictionary parity", () => {
  for (const [code, dict] of Object.entries(TRANSLATED)) {
    test(`${code} has exactly the same keys as english`, () => {
      expect(flatten(dict as never)).toEqual(flatten(en as never));
    });

    test(`${code} has no empty strings and keeps every placeholder`, () => {
      for (const [section, entries] of Object.entries(dict as never) as [
        string,
        Record<string, string>,
      ][]) {
        for (const [key, value] of Object.entries(entries)) {
          expect(value.trim(), `${code}.${section}.${key} is empty`).not.toBe("");
          const want = ((en as never)[section][key] as string).match(/\{\w+\}/g) ?? [];
          const got = value.match(/\{\w+\}/g) ?? [];
          expect(got.sort(), `${code}.${section}.${key} placeholders`).toEqual(want.sort());
        }
      }
    });
  }

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

test.describe("each translated locale renders", () => {
  for (const [code, dict] of Object.entries(TRANSLATED)) {
    test(`${code}: html lang, script and nav chrome switch over`, async ({ page }) => {
      await resetState(page);
      await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [STORAGE_KEY, code]);
      await page.goto("/markets/cricket");

      await expect(page.locator("html")).toHaveAttribute("lang", code);
      await expect(page.locator("html")).toHaveAttribute(
        "data-script",
        LOCALE_META[code as keyof typeof LOCALE_META].script
      );
      await expect(
        page.getByRole("link", { name: dict.nav.cricket, exact: true })
      ).toBeVisible();
      await expect(page.getByRole("button", { name: dict.sort.popular })).toBeVisible();
      // Digits and currency stay Latin / rupee regardless of locale.
      await expect(page.locator("body")).toContainText("₹");
      expect(await page.locator('[data-testid="shown-count"]').innerText()).toMatch(/[0-9]/);
    });
  }
});

test.describe("layout at 375px with the longest translations", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  for (const [code, dict] of Object.entries(TRANSLATED)) {
    test(`${code}: category nav, chips, bottom nav and trade modal do not overflow`, async ({
      page,
    }) => {
      await resetState(page);
      await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [STORAGE_KEY, code]);
      await page.goto("/markets/entertainment");
      await expect(page.locator("html")).toHaveAttribute("lang", code);

      const docWidth = await page.evaluate(() => document.documentElement.clientWidth);
      const noOverflow = async () =>
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth)
        ).toBeLessThanOrEqual(docWidth + 1);

      // Nav and chips scroll horizontally inside their own rows, never the page.
      await noOverflow();

      // Bottom nav: all four labels on one row, each within its column.
      const bottom = page.locator("nav").last();
      const navBox = await bottom.boundingBox();
      expect(navBox!.width).toBeLessThanOrEqual(docWidth + 1);
      const items = bottom.locator("a, button");
      await expect(items).toHaveCount(4);
      for (let i = 0; i < 4; i++) {
        const b = await items.nth(i).boundingBox();
        expect(b!.x + b!.width).toBeLessThanOrEqual(docWidth + 1);
        expect(b!.height).toBeLessThan(80);
      }

      // Trade modal stays inside the viewport with the longest labels.
      await page.getByRole("button", { name: new RegExp(dict.card.trade) }).first().click();
      const place = page.getByRole("button", { name: dict.trade.placeOrder });
      await expect(place).toBeVisible();
      const box = await place.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(docWidth + 1);
      await noOverflow();
    });
  }
});
