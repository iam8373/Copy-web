import { test, expect, type Page } from "@playwright/test";
import { LOCALES, STORAGE_KEY } from "../../src/i18n";
import { openMarket, resetState } from "./helpers";

/**
 * Phase S6: responsive and language sweep. 4 widths × 6 languages × 2 themes on
 * the main public pages: no horizontal overflow, no console or page errors,
 * one h1, and a visible keyboard focus indicator. One project (viewport set
 * per case), so it runs once.
 */

const WIDTHS = [360, 390, 768, 1280] as const;
const THEMES = ["dark", "light"] as const;

async function check(page: Page, route: string, label: string, errors: string[]) {
  await page.goto(route);
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${label}: horizontal overflow ${overflow}px`).toBeLessThanOrEqual(1);
  await expect(page.locator("h1"), `${label}: one h1`).toHaveCount(1);
  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "none";
    const cs = getComputedStyle(el);
    const ring = cs.boxShadow && cs.boxShadow !== "none";
    const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
    return ring || outline ? "visible" : `invisible <${el.tagName.toLowerCase()}>`;
  });
  expect(focus, `${label}: keyboard focus`).toBe("visible");
  expect(errors, label).toEqual([]);
}

test.describe("responsive and language sweep", () => {
  test.skip(({ isMobile }) => isMobile, "viewports are set per case");

  for (const theme of THEMES) {
    test(`all widths and languages (${theme})`, async ({ page }) => {
      test.setTimeout(600_000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(`console: ${m.text()}`);
      });
      const market = await openMarket(true, 0);
      const routes = ["/", "/markets/cricket", `/market/${market.slug}`, "/learn"];
      await resetState(page);
      await page.evaluate((t) => window.localStorage.setItem("predict-theme", t), theme);
      for (const code of LOCALES) {
        await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [STORAGE_KEY, code]);
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: width < 768 ? 780 : 900 });
          for (const route of routes) await check(page, route, `${theme} ${code} ${width}px ${route}`, errors);
        }
      }
      await page.evaluate((k) => window.localStorage.setItem(k, "en"), STORAGE_KEY);
    });
  }
});
