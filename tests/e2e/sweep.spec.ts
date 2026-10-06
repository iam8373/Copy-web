import { test, expect, type Page } from "@playwright/test";
import { CATEGORIES } from "../../src/lib/types";
import { MARKETS } from "../../src/data/markets";
import { resetState, signInWithEmail } from "./helpers";

/**
 * Work order 4, Phase 6: every route, both themes, checked for the basics the
 * design system promises: no horizontal scroll at 360px, no runtime errors,
 * one h1, named controls, alt text, and a visible keyboard focus indicator.
 */

const binary = MARKETS.find((m) => m.isBinary && !m.isLive)!;
const multi = MARKETS.find((m) => !m.isBinary && !m.isLive)!;
const live = MARKETS.find((m) => m.isLive)!;

const ROUTES = [
  "/",
  ...CATEGORIES.map((c) => c.href),
  `/market/${binary.slug}`,
  `/market/${multi.slug}`,
  `/market/${live.slug}`,
  "/dashboard",
  "/profit",
  "/learn",
  "/terms",
  "/privacy",
  "/responsible-play",
  "/grievance",
  "/this-page-does-not-exist",
];

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  return errors;
}

async function audit(page: Page) {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
    };
    const name = (el: Element) =>
      (
        el.getAttribute("aria-label") ||
        el.getAttribute("title") ||
        (el.getAttribute("aria-labelledby") &&
          document.getElementById(el.getAttribute("aria-labelledby")!)?.textContent) ||
        (el as HTMLElement).innerText ||
        el.querySelector("img[alt]")?.getAttribute("alt") ||
        ""
      ).trim();
    const unnamed = Array.from(document.querySelectorAll("button, a[href], [role=button], [role=tab]"))
      .filter(visible)
      .filter((el) => !name(el))
      .map((el) => el.outerHTML.slice(0, 120));
    const noAlt = Array.from(document.querySelectorAll("img"))
      .filter((img) => !img.hasAttribute("alt"))
      .map((img) => img.outerHTML.slice(0, 120));
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      h1: Array.from(document.querySelectorAll("h1")).filter(visible).length,
      unnamed,
      noAlt,
    };
  });
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`route sweep (${theme})`, () => {
    for (const route of ROUTES) {
      test(`${route}`, async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 780 });
        await page.addInitScript((t) => {
          try {
            window.localStorage.setItem("predict-theme", t);
          } catch {
            /* ignore */
          }
        }, theme);
        const errors = watchErrors(page);
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        await expect(page.locator("html")).toHaveClass(theme === "light" ? /light/ : /^(?!.*light)/);

        const r = await audit(page);
        expect(r.overflow, "horizontal overflow at 360px").toBeLessThanOrEqual(0);
        expect(r.h1, "exactly one visible h1").toBe(1);
        expect(r.unnamed, "controls without an accessible name").toEqual([]);
        expect(r.noAlt, "images without alt").toEqual([]);
        // The 404 route logs the expected 404 resource error; nothing else may.
        const real = errors.filter((e) => !/status of 404/.test(e));
        expect(real, "runtime errors").toEqual([]);
      });
    }
  });
}

test.describe("signed-in pages", () => {
  test("dashboard and profit pass the same audit", async ({ page }) => {
    await resetState(page);
    const errors = watchErrors(page);
    await signInWithEmail(page);
    for (const route of ["/dashboard", "/profit"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const r = await audit(page);
      expect(r.overflow, route).toBeLessThanOrEqual(0);
      expect(r.unnamed, route).toEqual([]);
    }
    expect(errors).toEqual([]);
  });
});

test.describe("keyboard focus is always visible", () => {
  test.skip(({ isMobile }) => isMobile, "keyboard sweep runs on desktop");

  for (const route of ["/", "/markets/cricket", `/market/${binary.slug}`, "/dashboard"]) {
    test(`${route}: the first 25 tab stops show a focus indicator`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await page.locator("body").focus();
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press("Tab");
        const info = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;
          const cs = getComputedStyle(el);
          const ring = cs.boxShadow !== "none" && cs.boxShadow !== "";
          const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
          return { ok: ring || outline, html: el.outerHTML.slice(0, 120) };
        });
        if (!info) continue;
        expect(info.ok, `no focus indicator on ${info.html}`).toBe(true);
      }
    });
  }
});
