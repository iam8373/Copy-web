import { Page, expect } from "@playwright/test";

/** Clears demo storage so every test starts signed out and deterministic. */
export async function resetState(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
  });
}

/** Signs in through the real AuthModal UI (phone + OTP). */
export async function signInWithPhone(page: Page, digits = "9876543210") {
  await openAuthModal(page);
  await acceptAgeIfPresent(page);
  await page.getByRole("textbox", { name: /mobile number/i }).fill(digits);
  await page.getByRole("button", { name: /send otp/i }).click();
  await page.getByRole("textbox", { name: /otp/i }).fill("123456");
  await page.getByRole("button", { name: /verify/i }).click();
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();
}

/** Signs in with the first demo Google account. */
export async function signInWithGoogle(page: Page, index = 0) {
  await openAuthModal(page);
  await acceptAgeIfPresent(page);
  await page.getByRole("button", { name: /^Google$/ }).click();
  await page.locator('[data-testid="google-account"]').nth(index).click();
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();
}

export async function openAuthModal(page: Page) {
  await page.getByRole("button", { name: /sign up \/ log in|^log in$/i }).click();
  await expect(page.getByRole("heading", { name: /sign up \/ log in/i })).toBeVisible();
}

/**
 * Phase D adds a required 18+ checkbox. Ticking it is a no-op before that
 * phase lands, which keeps these helpers usable across phases.
 */
export async function acceptAgeIfPresent(page: Page) {
  const box = page.locator('[data-testid="age-confirm"]');
  if ((await box.count()) > 0) {
    await box.check();
  }
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: /account menu/i }).click();
  await page.getByRole("button", { name: /sign out/i }).click();
}
