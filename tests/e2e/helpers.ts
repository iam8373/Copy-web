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

/** Signs in through the real AuthModal UI (email + 6-digit code). */
export async function signInWithEmail(page: Page, email = "asha.rao@example.com") {
  await openAuthModal(page);
  await acceptAgeIfPresent(page);
  await page.getByRole("textbox", { name: /email address/i }).fill(email);
  await page.getByRole("button", { name: /send code/i }).click();
  await page.getByRole("textbox", { name: /6-digit code/i }).fill("123456");
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
  // Scoped to the header: /dashboard also renders a "Log in" button, and the
  // header label itself collapses to "Log in" on mobile.
  await page
    .getByRole("banner")
    .getByRole("button", { name: /sign up \/ log in|^log in$/i })
    .click();
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
    await expect(box).toBeChecked();
  }
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: /account menu/i }).click();
  await page.getByRole("button", { name: /sign out/i }).click();
}
