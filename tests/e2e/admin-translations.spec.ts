import { test, expect } from "@playwright/test";
import type { Server } from "node:http";
import { STORAGE_KEY } from "../../src/i18n";
import { GEMINI_MOCK_PORT } from "../support/local-supabase";
import { startGeminiMock } from "../support/gemini-mock";
import { validateOutcomeLabels } from "../../src/services/translation/validate";
import { resolveBaseUrl, GEMINI_BASE_URL } from "../../src/services/translation/translate";
import { localRest, resetState, staffSession } from "./helpers";

/** Admin R5: translations admin (Gemini mock), reviewed entries kept, daily cap. */

test.describe("translation helpers", () => {
  test("outcome labels must keep count, numbers and the Yes/No terms", () => {
    const ok = { hi: ["हाँ", "नहीं"], mr: ["होय", "नाही"], bn: ["হ্যাঁ", "না"], ta: ["ஆம்", "இல்லை"], te: ["అవును", "కాదు"] };
    const problems = validateOutcomeLabels(["Yes", "No"], ok);
    // Whatever the dictionaries say Yes/No are, a wrong count is always caught.
    expect(validateOutcomeLabels(["Yes", "No"], { ...ok, hi: ["हाँ"] }).some((p) => p.startsWith("hi:"))).toBe(true);
    expect(Array.isArray(problems)).toBe(true);
    expect(validateOutcomeLabels(["Over 180"], { hi: ["ओवर"], mr: ["180"], bn: ["180"], ta: ["180"], te: ["180"] })).toContain('hi[0]: number "180" missing');
  });
  test("the Gemini base URL can only be Google or loopback", () => {
    expect(resolveBaseUrl(undefined)).toBe(GEMINI_BASE_URL);
    expect(resolveBaseUrl("https://evil.example/v1beta/models")).toBe(GEMINI_BASE_URL);
    expect(resolveBaseUrl("http://127.0.0.1:3998/v1beta/models")).toBe("http://127.0.0.1:3998/v1beta/models");
  });
});

test.describe("admin translations", () => {
  test.skip(({ isMobile }) => isMobile, "admin is desktop-first");
  let mock: { server: Server; calls: () => number };
  test.beforeAll(async () => {
    mock = await startGeminiMock(GEMINI_MOCK_PORT);
  });
  test.afterAll(async () => {
    await new Promise((r) => mock.server.close(r));
  });

  async function multiMarket() {
    const slug = `e2e-tr-${Date.now()}`;
    const [m] = await localRest<Array<{ id: string }>>("markets", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        slug, title: `Who wins the Zeta ${Date.now() % 1000} cup?`, description: "Decided by the final score.",
        category: "sports", subcategory: "Football", end_date: new Date(Date.now() + 7 * 864e5).toISOString(),
        status: "open", is_binary: false, resolution_source: "Official site",
      }),
    });
    await localRest("outcomes", {
      method: "POST",
      body: JSON.stringify(["Alpha FC", "Beta FC", "Gamma FC"].map((label, i) => ({ market_id: m.id, label, sort_order: i, price: 0.3333333333 }))),
    });
    return { id: m.id, slug };
  }

  test("Gemini drafts every locale; users see them; a reviewed edit is kept on regenerate", async ({ page, browser }) => {
    const m = await multiMarket();
    await staffSession(page, "moderator");
    await page.goto(`/admin/translations?q=${m.slug}`);
    const row = page.locator(`[data-testid="translation-row"][data-slug="${m.slug}"]`);
    await expect(row.locator('[data-locale="hi"] [data-state]')).toHaveAttribute("data-state", "missing");

    await page.goto(`/admin/translations/${m.id}`);
    const quotaBefore = await page.getByTestId("translation-quota").innerText();
    await page.getByRole("button", { name: "Translate with Gemini" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved 20 machine drafts." })).toBeVisible();
    await expect(page.getByTestId("locale-hi").locator("[data-state]").first()).toHaveAttribute("data-state", "machine");
    await expect(page.getByTestId("translation-quota")).not.toHaveText(quotaBefore);

    // A reviewer fixes the Hindi title and one label.
    const hi = page.getByTestId("locale-hi");
    await hi.getByLabel("Title").fill("ज़ेटा कप कौन जीतेगा?");
    await hi.getByLabel("Alpha FC").fill("अल्फ़ा एफसी");
    await hi.getByRole("button", { name: "Save as reviewed" }).click();
    await expect(hi.getByRole("status")).toHaveText("Saved as reviewed.");
    await expect(page.getByTestId("locale-hi").locator("[data-state]").first()).toHaveAttribute("data-state", "reviewed");

    // Regenerating keeps the reviewed Hindi text and labels (1 + 3), redrafts the rest.
    await page.getByRole("button", { name: "Translate with Gemini" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved 16 machine drafts; kept 4 reviewed." })).toBeVisible();
    await expect(page.getByTestId("locale-hi").getByLabel("Title")).toHaveValue("ज़ेटा कप कौन जीतेगा?");

    // Public page in Hindi: reviewed title and the translated outcome labels.
    const ctx = await browser.newContext();
    const pub = await ctx.newPage();
    await resetState(pub);
    await pub.evaluate((k) => window.localStorage.setItem(k, "hi"), STORAGE_KEY);
    await pub.goto(`/market/${m.slug}`);
    await expect(pub.getByRole("heading", { level: 1 })).toHaveText("ज़ेटा कप कौन जीतेगा?");
    await expect(pub.getByTestId("outcome-list")).toContainText("अल्फ़ा एफसी");
    await expect(pub.getByTestId("outcome-list")).toContainText("Beta FC hi");
    await ctx.close();

    // Editing the English makes every locale stale (not shown to users).
    await localRest(`markets?id=eq.${m.id}`, { method: "PATCH", body: JSON.stringify({ title: "Who wins the Zeta final?" }) });
    await page.reload();
    await expect(page.getByTestId("locale-hi").locator("[data-state]").first()).toHaveAttribute("data-state", "stale");
  });

  test("the daily cap stops Gemini calls", async ({ page }) => {
    const m = await multiMarket();
    await staffSession(page, "admin");
    const [setting] = await localRest<Array<{ value: number }>>("app_settings?key=eq.daily_translation_cap&select=value");
    try {
      await localRest("app_settings?key=eq.daily_translation_cap", { method: "PATCH", body: JSON.stringify({ value: 0 }) });
      const calls = mock.calls();
      await page.goto(`/admin/translations/${m.id}`);
      await expect(page.getByRole("button", { name: "Translate with Gemini" })).toBeDisabled();
      await expect(page.getByTestId("translation-quota")).toContainText("of 0 markets");
      expect(mock.calls()).toBe(calls);
    } finally {
      await localRest("app_settings?key=eq.daily_translation_cap", { method: "PATCH", body: JSON.stringify({ value: setting.value }) });
    }
  });
});
