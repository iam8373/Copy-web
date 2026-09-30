import { test, expect } from "@playwright/test";
import en from "../../src/i18n/en";
import hi from "../../src/i18n/hi";
import { STORAGE_KEY } from "../../src/i18n";
import { resetState } from "./helpers";

/**
 * Phase 4. /e2e-error exists only in builds made with
 * NEXT_PUBLIC_E2E_ERROR_TRIGGER=1 (the Playwright webServer build). It throws
 * during render while localStorage["bp-e2e-throw"] === "1".
 */
test.beforeEach(async ({ page }) => {
  await resetState(page);
});

test("a throwing route shows the error UI, and Try again recovers", async ({ page }) => {
  const consoleText: string[] = [];
  page.on("console", (m) => consoleText.push(m.text()));

  await page.evaluate(() => window.localStorage.setItem("bp-e2e-throw", "1"));
  await page.goto("/e2e-error");

  const boundary = page.locator('[data-testid="error-boundary"]');
  await expect(boundary).toBeVisible();
  await expect(boundary).toContainText(en.errors.title);
  // The layout chrome survives: the boundary is scoped to the page segment.
  await expect(page.getByRole("banner")).toBeVisible();

  // Raw error messages and stacks never reach the user.
  await expect(page.locator("body")).not.toContainText("E2E_SECRET_INTERNAL_DETAIL");
  await expect(page.locator("body")).not.toContainText(/at \w+ \(|\.tsx?:\d+/);
  // Our own logging carries no message either.
  expect(consoleText.filter((t) => t.startsWith("Route error")).join(" ")).not.toContain(
    "E2E_SECRET_INTERNAL_DETAIL"
  );

  // Fix the cause, then reset.
  await page.evaluate(() => window.localStorage.removeItem("bp-e2e-throw"));
  await page.getByRole("button", { name: en.errors.retry }).click();

  await expect(page.locator('[data-testid="e2e-recovered"]')).toBeVisible();
  await expect(boundary).toHaveCount(0);
});

test("Try again keeps failing gracefully while the cause persists", async ({ page }) => {
  await page.evaluate(() => window.localStorage.setItem("bp-e2e-throw", "1"));
  await page.goto("/e2e-error");
  await page.getByRole("button", { name: en.errors.retry }).click();
  await expect(page.locator('[data-testid="error-boundary"]')).toBeVisible();
});

test("the error UI is translated", async ({ page }) => {
  await page.evaluate(
    ([k]) => {
      window.localStorage.setItem(k, "hi");
      window.localStorage.setItem("bp-e2e-throw", "1");
    },
    [STORAGE_KEY]
  );
  await page.goto("/e2e-error");
  const boundary = page.locator('[data-testid="error-boundary"]');
  await expect(boundary).toContainText(hi.errors.title);
  await expect(page.getByRole("button", { name: hi.errors.retry })).toBeVisible();
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("skeleton blocks do not pulse", async ({ page }) => {
    // Render a skeleton in isolation: loading.tsx only flashes briefly, so
    // inject the same classes and confirm the motion-safe variant is inert.
    await page.goto("/");
    const animation = await page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "rounded-lg bg-bg-tertiary motion-safe:animate-pulse";
      document.body.appendChild(el);
      return getComputedStyle(el).animationName;
    });
    expect(animation).toBe("none");
  });
});

test("skeleton blocks pulse when motion is allowed", async ({ page }) => {
  await page.goto("/");
  const animation = await page.evaluate(() => {
    const el = document.createElement("div");
    el.className = "rounded-lg bg-bg-tertiary motion-safe:animate-pulse";
    document.body.appendChild(el);
    return getComputedStyle(el).animationName;
  });
  expect(animation).toBe("pulse");
});
