import { test, expect, type Page } from "@playwright/test";

/**
 * Shared UI primitives (src/components/ui), exercised through the test-only
 * /e2e-ui gallery (bundled because the Playwright build sets
 * NEXT_PUBLIC_E2E_UI_GALLERY=1).
 */

async function openGallery(page: Page, theme: "dark" | "light" = "dark") {
  await page.addInitScript((t) => {
    try {
      window.localStorage.setItem("predict-theme", t);
    } catch {
      /* ignore */
    }
  }, theme);
  await page.goto("/e2e-ui");
  await expect(page.getByTestId("ui-gallery")).toBeVisible();
}

/** Size of the ::before hit area (or the element itself if larger). */
async function hitArea(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    const b = getComputedStyle(el, "::before");
    return {
      w: Math.max(r.width, parseFloat(b.width) || 0),
      h: Math.max(r.height, parseFloat(b.height) || 0),
      visualH: r.height,
    };
  });
}

test.describe("UI primitives", () => {
  test("buttons: 32/40/48 visual heights, every hit area at least 44px", async ({ page }) => {
    await openGallery(page);
    for (const [size, h] of [["sm", 32], ["md", 40], ["lg", 48]] as const) {
      const box = await hitArea(page, `[data-testid="buttons-${size}"] button`);
      expect(box.visualH).toBe(h);
      expect(box.w).toBeGreaterThanOrEqual(44);
      expect(box.h).toBeGreaterThanOrEqual(44);
    }
    const icon = await hitArea(page, '[data-testid="icon-button"]');
    expect(icon.w).toBeGreaterThanOrEqual(44);
    expect(icon.h).toBeGreaterThanOrEqual(44);
    // Icon-only buttons always carry an accessible name.
    await expect(page.getByTestId("icon-button")).toHaveAccessibleName("Trending");
  });

  test("yes / no buttons keep their colour (custom font sizes don't eat it)", async ({ page }) => {
    await openGallery(page);
    const colours = await page.locator('[data-testid="buttons-md"] button').evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).color)
    );
    const [primary, , , , yes, no] = colours;
    expect(yes).not.toBe(primary);
    expect(no).not.toBe(primary);
    expect(yes).not.toBe(no);
  });

  test("loading button is busy and announces loading", async ({ page }) => {
    await openGallery(page);
    const btn = page.getByTestId("loading-button");
    await btn.click();
    await expect(btn).toHaveAttribute("aria-busy", "true");
    await expect(btn).toBeDisabled();
    await expect(btn).toContainText("Loading");
    await expect(btn).not.toHaveAttribute("aria-busy", "true", { timeout: 5000 });
  });

  test("chips expose aria-pressed and toggle", async ({ page }) => {
    await openGallery(page);
    const chips = page.getByTestId("sort-chips");
    await expect(chips.getByRole("button", { name: "Trending" })).toHaveAttribute("aria-pressed", "true");
    await chips.getByRole("button", { name: "Popular" }).click();
    await expect(chips.getByRole("button", { name: "Popular" })).toHaveAttribute("aria-pressed", "true");
    await expect(chips.getByRole("button", { name: "Trending" })).toHaveAttribute("aria-pressed", "false");
  });

  test("tabs: arrow keys, Home/End, roving tabindex, linked panel", async ({ page }) => {
    await openGallery(page);
    const list = page.getByRole("tablist", { name: "Market sections" });
    const activity = list.getByRole("tab", { name: "Activity" });
    await expect(activity).toHaveAttribute("aria-selected", "true");
    await expect(activity).toHaveAttribute("tabindex", "0");
    await expect(list.getByRole("tab", { name: /Comments/ })).toHaveAttribute("tabindex", "-1");

    await activity.focus();
    await page.keyboard.press("ArrowRight");
    const holders = list.getByRole("tab", { name: /Top holders/ });
    await expect(holders).toBeFocused();
    await expect(holders).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name: /Top holders/ })).toContainText("No holders yet");

    await page.keyboard.press("End");
    await expect(list.getByRole("tab", { name: /Comments/ })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowRight"); // wraps
    await expect(activity).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowLeft"); // wraps back
    await expect(list.getByRole("tab", { name: /Comments/ })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(activity).toHaveAttribute("aria-selected", "true");
    // Only one panel is rendered.
    await expect(page.getByRole("tabpanel")).toHaveCount(1);
  });

  test("tooltip: keyboard focus opens, Escape closes, described-by resolves", async ({ page }) => {
    await openGallery(page);
    const trigger = page.getByRole("button", { name: "About the order book" });
    const tipId = await trigger.getAttribute("aria-describedby");
    expect(tipId).toBeTruthy();
    await expect(page.getByRole("tooltip")).toHaveCount(0);

    // Reach it by keyboard so :focus-visible applies.
    await page.getByRole("tab", { name: "1D" }).focus();
    await page.keyboard.press("Tab");
    await expect(trigger).toBeFocused();
    const tip = page.getByRole("tooltip");
    await expect(tip).toBeVisible();
    await expect(tip).toContainText("automated market maker");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  });

  test("tooltip: click/tap toggles and stays inside the viewport", async ({ page }) => {
    await openGallery(page);
    const trigger = page.getByRole("button", { name: "Edge tooltip" });
    await trigger.click();
    const tip = page.getByRole("tooltip");
    await expect(tip).toBeVisible();
    // Give the edge correction a frame.
    await page.waitForTimeout(100);
    const box = await tip.boundingBox();
    const vw = await page.evaluate(() => document.documentElement.clientWidth);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw);
    // Outside click closes.
    await page.getByRole("heading", { name: "UI primitives" }).click();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  });

  test("dialog: focus moves in, Tab is trapped, Escape closes and restores focus", async ({ page }) => {
    await openGallery(page);
    const opener = page.getByTestId("open-dialog");
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Buy Yes" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(page.getByTestId("dialog-input")).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

    // Tab around the three focusables (close, input, confirm) and stay inside.
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(
        () => !!document.activeElement?.closest('[role="dialog"]')
      );
      expect(inside).toBe(true);
    }
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  });

  test("dialog: close button and backdrop close it", async ({ page }) => {
    await openGallery(page);
    await page.getByTestId("open-dialog").click();
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByTestId("open-dialog").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  for (const theme of ["dark", "light"] as const) {
    test(`no horizontal overflow at 360px (${theme})`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 780 });
      await openGallery(page, theme);
      await page.getByTestId("open-dialog").click();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
      // Below sm the dialog is a bottom sheet pinned to the bottom edge
      // (measured once the slide-up animation has finished).
      await page.getByRole("dialog").evaluate((el) =>
        Promise.all(el.getAnimations().map((a) => a.finished))
      );
      const box = await page.getByRole("dialog").boundingBox();
      expect(Math.round(box!.y + box!.height)).toBe(780);
    });
  }
});

test.describe("Turnstile widget", () => {
  test("loads only when shown, yields a token, resets, and reports failures", async ({ page }) => {
    const scripts: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("challenges.cloudflare.com")) scripts.push(r.url());
    });
    await page.goto("/e2e-ui");
    await expect(page.getByTestId("ui-gallery")).toBeVisible();
    expect(scripts).toEqual([]); // not loaded until a widget is rendered

    await page.getByTestId("captcha-pass").click();
    await expect(page.getByTestId("captcha-token")).toHaveText("XXXX.DUMMY.TOKEN.XXXX", { timeout: 20_000 });
    expect(scripts.some((u) => u.includes("/turnstile/v0/api.js"))).toBe(true);

    await page.getByTestId("captcha-reset").click();
    await expect(page.getByTestId("captcha-token")).toHaveText("no token");

    await page.getByTestId("captcha-fail").click();
    await page.waitForTimeout(3000);
    await expect(page.getByTestId("captcha-token")).toHaveText("no token");
  });
});
