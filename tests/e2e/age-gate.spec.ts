import { test, expect } from "@playwright/test";
import { openAuthModal, resetState } from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetState(page);
});

test("cannot sign in without ticking the 18+ box", async ({ page }) => {
  await openAuthModal(page);

  const box = page.locator('[data-testid="age-confirm"]');
  await expect(box).toBeVisible();
  await expect(box).not.toBeChecked();

  // Both routes are disabled until the box is ticked.
  await expect(page.getByRole("button", { name: /send code/i })).toBeDisabled();
  await page.getByRole("button", { name: /^Google$/ }).click();
  await expect(page.locator('[data-testid="google-account"]').first()).toBeDisabled();

  // Still signed out.
  await expect(page.getByRole("button", { name: /account menu/i })).toHaveCount(0);
});

test("ticking the box enables both sign-in routes", async ({ page }) => {
  await openAuthModal(page);
  await page.locator('[data-testid="age-confirm"]').check();

  await expect(page.getByRole("button", { name: /send code/i })).toBeEnabled();
  await page.getByRole("button", { name: /^Google$/ }).click();
  await expect(page.locator('[data-testid="google-account"]').first()).toBeEnabled();
});

test("age confirmation is recorded on the session", async ({ page }) => {
  await openAuthModal(page);
  await page.locator('[data-testid="age-confirm"]').check();
  await page.getByRole("button", { name: /^Google$/ }).click();
  await page.locator('[data-testid="google-account"]').first().click();
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();

  const session = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("bp-session") ?? "null")
  );
  expect(typeof session.ageConfirmedAt).toBe("string");
  expect(Number.isNaN(Date.parse(session.ageConfirmedAt))).toBe(false);
});

test("a legacy session without age confirmation must re-confirm before ordering", async ({
  page,
}) => {
  // Simulate a session stored before Phase D existed.
  await page.evaluate(() => {
    window.localStorage.setItem(
      "bp-session",
      JSON.stringify({ method: "google", handle: "arjun.mehta@gmail.com", initial: "A" })
    );
  });

  await page.goto("/markets/cricket");
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();

  await page.getByRole("button", { name: /^Trade$/ }).first().click();
  await page.getByRole("button", { name: /place order/i }).click();

  // Order refused, auth modal reopened for re-confirmation.
  await expect(page.getByText(/confirm your age to continue/i)).toBeVisible();
  await expect(page.locator('[data-testid="age-confirm"]')).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("legal pages render and old anchors still resolve", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: /eligibility \(18\+\)/i })).toBeVisible();
  await expect(page.getByText(/must be at least 18 years old/i)).toBeVisible();
  await expect(page.getByText(/draft — pending legal review/i).first()).toBeVisible();

  for (const path of ["/privacy", "/responsible-play", "/grievance"]) {
    const res = await page.goto(path);
    expect(res?.status(), `${path} should resolve`).toBe(200);
    await expect(page.getByText(/draft — pending legal review/i).first()).toBeVisible();
  }

  // Legacy /learn#terms and /learn#privacy links must still land somewhere real.
  // A hash-only goto returns no response object, so assert the anchors exist.
  const learn = await page.goto("/learn");
  expect(learn?.status()).toBe(200);
  await expect(page.locator("#terms")).toHaveCount(1);
  await expect(page.locator("#privacy")).toHaveCount(1);
  // ...and that the section points readers at the dedicated pages.
  await expect(page.locator('#terms a[href="/terms"]')).toHaveCount(1);
  await expect(page.locator('#terms a[href="/privacy"]')).toHaveCount(1);

  // Footer exposes the new destinations.
  await page.goto("/");
  await expect(page.getByRole("link", { name: /^Terms$/ })).toHaveAttribute("href", "/terms");
  await expect(page.getByRole("link", { name: /^Privacy$/ })).toHaveAttribute(
    "href",
    "/privacy"
  );
});

test("reopening the modal starts unticked, and an immediate tick sticks", async ({
  page,
}) => {
  // Regression: the form used to reset in an effect after opening, which could
  // untick a box the user had already ticked.
  await openAuthModal(page);
  const box = page.locator('[data-testid="age-confirm"]');
  await box.check();
  await page.keyboard.press("Escape");

  await openAuthModal(page);
  await expect(box).not.toBeChecked();
  await box.check();
  await page.waitForTimeout(300);
  await expect(box).toBeChecked();
  await page.getByRole("button", { name: /^Google$/ }).click();
  await expect(page.locator('[data-testid="google-account"]').first()).toBeEnabled();
});
