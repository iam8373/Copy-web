import { test, expect, type Page } from "@playwright/test";
import { MARKETS } from "../../src/data/markets";
import { STORAGE_KEY } from "../../src/i18n";
import { hi } from "../../src/i18n/hi";
import { resetState, signInWithEmail } from "./helpers";

/** Work order 4, Phase 3: home and navigation polish. */

test.beforeEach(async ({ page }) => {
  await resetState(page);
});

/** Titles of the non-live grid on a category page, in display order. */
async function gridTitles(page: Page) {
  return page.locator('section:not([data-testid="live-section"]) h3').allInnerTexts();
}

function expected(category: string, by: (a: (typeof MARKETS)[number], b: (typeof MARKETS)[number]) => number) {
  return MARKETS.filter((m) => m.category === category && !m.isLive)
    .sort(by)
    .map((m) => m.title);
}

test.describe("category sort", () => {
  test("Trending / Popular / Starting Soon; Trending is the default", async ({ page }) => {
    await page.goto("/markets/finance");
    const options = page.locator('[data-testid="sort-option"]');
    await expect(options).toHaveText(["Trending", "Popular", "Starting Soon"]);
    await expect(options.first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("group", { name: "Sort by" })).toBeVisible();

    // Trending = biggest 24h volume change first.
    expect(await gridTitles(page)).toEqual(
      expected("finance", (a, b) => b.volumeChange24h - a.volumeChange24h)
    );

    await page.locator('[data-testid="sort-option"][data-sort="Popular"]').click();
    await expect(page.locator('[data-sort="Popular"]')).toHaveAttribute("aria-pressed", "true");
    expect(await gridTitles(page)).toEqual(
      expected("finance", (a, b) => b.totalVolume - a.totalVolume)
    );
  });

  test("Starting Soon puts open markets first, soonest end date first", async ({ page }) => {
    await page.goto("/markets/cricket");
    await page.locator('[data-testid="sort-option"][data-sort="Starting Soon"]').click();
    const titles = await gridTitles(page);
    const now = Date.now();
    const ends = titles.map((t) => +new Date(MARKETS.find((m) => m.title === t)!.endDate));
    const open = ends.filter((e) => e >= now);
    // Every open market comes before every ended one, ascending among open.
    expect(ends.slice(0, open.length)).toEqual([...open].sort((a, b) => a - b));
  });
});

test.describe("featured carousel", () => {
  test("can be paused, and labels its slides", async ({ page }) => {
    await page.goto("/");
    const carousel = page.getByTestId("featured-carousel");
    await expect(carousel).toHaveAttribute("aria-roledescription", "carousel");
    // Move the pointer away so hover doesn't pause it first.
    await page.mouse.move(0, 0);
    await expect(carousel).toHaveAttribute("data-rotating", "true");

    const pause = page.getByTestId("featured-pause");
    await pause.click();
    await expect(pause).toHaveAttribute("aria-pressed", "true");
    await expect(pause).toHaveAccessibleName("Resume rotation");
    await page.mouse.move(0, 0);
    await page.locator("h1, h2").first().focus().catch(() => {});
    await expect(carousel).toHaveAttribute("data-rotating", "false");

    await page.getByRole("button", { name: "Next featured market" }).click();
    await expect(carousel.getByRole("button", { name: "Featured market 2 of 5" })).toHaveAttribute(
      "aria-current",
      "true"
    );
  });

  test("never auto-rotates under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.mouse.move(0, 0);
    await expect(page.getByTestId("featured-carousel")).toHaveAttribute("data-rotating", "false");
    await expect(page.getByTestId("featured-pause")).toHaveCount(0);
  });
});

test.describe("navigation", () => {
  test("category bar marks the current page", async ({ page }) => {
    await page.goto("/markets/politics");
    const nav = page.getByRole("navigation", { name: "Categories" });
    await expect(nav.getByRole("link", { name: "Politics", exact: true })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  });

  test("Popular has no misleading View all link; category sections do", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "View all: Popular" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "View all: Cricket" })).toHaveAttribute(
      "href",
      "/markets/cricket"
    );
  });

  test("search is a modal combobox: arrows, Tab stays inside, Escape restores focus", async ({ page, isMobile }) => {
    await page.goto("/");
    const trigger = page.getByRole("banner").getByRole("button", { name: /search markets/i });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Search markets" });
    await expect(dialog).toBeVisible();
    const box = dialog.getByRole("combobox");
    await expect(box).toBeFocused();
    await expect(box).toHaveAttribute("aria-activedescendant", "search-option-0");
    await page.keyboard.press("ArrowDown");
    await expect(box).toHaveAttribute("aria-activedescendant", "search-option-1");
    await expect(dialog.locator("#search-option-1")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Tab");
    await expect(box).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    if (!isMobile) await expect(trigger).toBeFocused();
  });

  test("account menu closes on Escape and returns focus", async ({ page }) => {
    await page.goto("/");
    await signInWithEmail(page);
    const button = page.getByRole("button", { name: /account menu/i });
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();
  });
});

test.describe("mobile More sheet", () => {
  test.skip(({ isMobile }) => !isMobile, "BottomNav is mobile-only");

  test("is a dialog with a focus trap that returns focus", async ({ page }) => {
    await page.goto("/");
    const more = page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "More" });
    await more.click();
    const sheet = page.getByRole("dialog", { name: "More" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Terms of Use" })).toBeVisible();
    for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(more).toBeFocused();
  });

  test("language chips switch the locale", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "More" }).click();
    await page.locator('[data-testid="language-chip"]', { hasText: "हिन्दी" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  });
});

test.describe("home in Hindi", () => {
  test("headings, carousel and card chrome are translated", async ({ page }) => {
    await page.evaluate((k) => window.localStorage.setItem(k, "hi"), STORAGE_KEY);
    await page.goto("/");
    const main = page.locator("main");
    await expect(main.getByRole("heading", { name: hi.home.popular, exact: true })).toBeVisible();
    await expect(main.getByRole("heading", { name: hi.home.featured })).toBeVisible();
    await expect(main.getByRole("heading", { name: hi.nav.cricket, exact: true })).toBeVisible();
    await expect(main).toContainText(hi.home.viewAll);
    await expect(main).toContainText(hi.home.learnBody);
    for (const english of ["View all", "Featured Markets", "Live now", "Resolves via", "Predictions 101"]) {
      await expect(main).not.toContainText(english);
    }
    // Category labels on cards follow the locale too.
    await expect(main.locator("a[href^='/market/']").first()).not.toContainText(/^CRICKET|^POLITICS/);
  });
});

for (const locale of ["ta", "te"] as const) {
  test(`no horizontal overflow at 360px in ${locale} (home and category)`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.evaluate(([k, l]) => window.localStorage.setItem(k, l), [STORAGE_KEY, locale]);
    for (const path of ["/", "/markets/cricket"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
}
