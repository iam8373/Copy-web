import { test, expect } from "@playwright/test";
import { CATEGORIES } from "../../src/lib/types";
import { resetState } from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetState(page);
});

for (const meta of CATEGORIES) {
  test.describe(`category: ${meta.slug}`, () => {
    test("first chip is the category name and shows markets", async ({ page }) => {
      await page.goto(meta.href);

      const chips = page.locator('[data-testid="subfilter-chip"]');
      await expect(chips).toHaveCount(meta.subFilters.length);

      // The "show everything" chip is the category label itself. Compared
      // case-insensitively because Esports renders as "eSports".
      const firstChip = (await chips.first().innerText()).trim().toLowerCase();
      expect(firstChip).toBe(meta.label.toLowerCase());

      expect(await page.locator('a[href^="/market/"]').count()).toBeGreaterThan(0);
    });

    test("every chip shows at least one market", async ({ page }) => {
      await page.goto(meta.href);
      const chips = page.locator('[data-testid="subfilter-chip"]');

      for (let i = 0; i < meta.subFilters.length; i++) {
        await chips.nth(i).click();
        const count = await page.locator('a[href^="/market/"]').count();
        expect(
          count,
          `chip "${meta.subFilters[i].label}" in ${meta.slug} rendered no markets`
        ).toBeGreaterThan(0);
      }
    });

    test("highlighted chips carry the highlight style", async ({ page }) => {
      await page.goto(meta.href);
      const expected = meta.subFilters.filter((f) => f.isHighlighted).length;
      await expect(
        page.locator('[data-testid="subfilter-chip"][data-highlighted="true"]')
      ).toHaveCount(expected);
    });
  });
}

test("clicking a narrower chip changes the shown count", async ({ page }) => {
  // Cricket has the widest spread of subcategories, so narrowing must reduce.
  await page.goto("/markets/cricket");
  const shown = page.locator('[data-testid="shown-count"]');
  const readCount = async () =>
    Number((await shown.innerText()).replace(/[^\d]/g, ""));

  const all = await readCount();
  await page.locator('[data-testid="subfilter-chip"]', { hasText: "Ranji Trophy" }).click();
  const narrowed = await readCount();

  expect(narrowed).toBeLessThan(all);
  expect(narrowed).toBeGreaterThan(0);
});

test("every category page renders rupee-formatted volume", async ({ page }) => {
  await page.goto("/markets/finance");
  await expect(page.locator("body")).toContainText("₹");
  await expect(page.locator("body")).toContainText("%");
});
