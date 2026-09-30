import { test, expect, type Page } from "@playwright/test";
import { STORAGE_KEY } from "../../src/i18n";
import { resetState } from "./helpers";

/** Records every font and Google request made while a page loads. */
async function recordFontRequests(page: Page, path: string) {
  const urls: string[] = [];
  const onRequest = (req: { url(): string }) => urls.push(req.url());
  page.on("request", onRequest);
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  page.off("request", onRequest);
  return {
    google: urls.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)),
    woff2: urls.filter((u) => u.endsWith(".woff2")),
  };
}

test.beforeEach(async ({ page }) => {
  await resetState(page);
});

test("no page ever contacts Google Fonts", async ({ page }) => {
  for (const path of ["/", "/markets/cricket", "/market/ipl-2026-winner", "/terms"]) {
    const { google } = await recordFontRequests(page, path);
    expect(google, `${path} requested Google Fonts`).toEqual([]);
  }
});

test("english never downloads the Indic fonts", async ({ page }) => {
  const { woff2 } = await recordFontRequests(page, "/markets/cricket");
  // Hashed filenames from next/font/local; the Noto files are ~14–54 KB and
  // Inter's are ~24 KB, so identify them by the font-face CSS instead.
  const faces = await page.evaluate(() =>
    Array.from(document.fonts)
      .filter((f) => f.status === "loaded")
      .map((f) => f.family)
  );
  expect(faces.some((f) => /inter/i.test(f))).toBe(true);
  expect(faces.some((f) => /noto/i.test(f))).toBe(false);
  // Only Inter weights may be fetched.
  expect(woff2.length).toBeGreaterThan(0);
  expect(woff2.length).toBeLessThanOrEqual(4);
});

test("hindi loads Devanagari and nothing from the other scripts", async ({ page }) => {
  await page.evaluate((k) => window.localStorage.setItem(k, "hi"), STORAGE_KEY);
  await recordFontRequests(page, "/markets/cricket");
  await expect(page.locator("html")).toHaveAttribute("data-script", "devanagari");

  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return Array.from(document.fonts)
      .filter((f) => f.status === "loaded")
      .map((f) => f.family.toLowerCase());
  });
  expect(loaded.some((f) => f.includes("devanagari"))).toBe(true);
  for (const other of ["bengali", "tamil", "telugu"]) {
    expect(loaded.some((f) => f.includes(other)), `${other} should not load`).toBe(false);
  }
});
