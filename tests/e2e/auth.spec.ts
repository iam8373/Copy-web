import { test, expect } from "@playwright/test";
import {
  acceptAgeIfPresent,
  openAuthModal,
  resetState,
  signInWithGoogle,
  signInWithEmail,
  signOut,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetState(page);
});

test("invalid email shows a validation error", async ({ page }) => {
  await openAuthModal(page);
  await acceptAgeIfPresent(page);
  await page.getByRole("textbox", { name: /email address/i }).fill("not-an-email");
  await page.getByRole("button", { name: /send code/i }).click();

  await expect(page.getByTestId("auth-modal").getByRole("alert")).toHaveText(/valid email address/i);
  // Still on the email step, so no code field appeared.
  await expect(page.getByRole("textbox", { name: /6-digit code/i })).toHaveCount(0);
});

test("email then any six digits signs in; the email is the handle", async ({ page }) => {
  await signInWithEmail(page, "Asha.Rao@Example.com");

  const avatar = page.getByRole("button", { name: /account menu/i });
  await expect(avatar).toBeVisible();
  // Initial is the first letter of the (normalised) email.
  await expect(avatar).toHaveText("A");
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem("bp-session") ?? "null"));
  expect(session).toMatchObject({ method: "email", handle: "asha.rao@example.com" });
  expect(Date.parse(session.ageConfirmedAt)).not.toBeNaN();
});

test("a short code is refused", async ({ page }) => {
  await openAuthModal(page);
  await acceptAgeIfPresent(page);
  await page.getByRole("textbox", { name: /email address/i }).fill("asha@example.com");
  await page.getByRole("button", { name: /send code/i }).click();
  await page.getByRole("textbox", { name: /6-digit code/i }).fill("123");
  await page.getByRole("button", { name: /verify/i }).click();
  await expect(page.getByTestId("auth-modal").getByRole("alert")).toHaveText(/6-digit code/i);
  await expect(page.getByRole("button", { name: /account menu/i })).toHaveCount(0);
});

test("there is no phone sign-in, and an old phone session is dropped", async ({ page }) => {
  await openAuthModal(page);
  const dialog = page.getByTestId("auth-modal");
  await expect(dialog).not.toContainText(/phone|mobile|OTP|\+91/i);
  await expect(dialog.locator('input[type="tel"], input[autocomplete="tel"]')).toHaveCount(0);

  // A session saved by the removed phone flow must not sign anyone in.
  await page.evaluate(() =>
    localStorage.setItem(
      "bp-session",
      JSON.stringify({ method: "phone", handle: "+91 98765 43210", initial: "0", ageConfirmedAt: new Date().toISOString() })
    )
  );
  await page.reload();
  await expect(page.getByRole("button", { name: /account menu/i })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("bp-session"))).toBeNull();
});

test("google demo account signs in", async ({ page }) => {
  await signInWithGoogle(page);
  await expect(page.getByRole("button", { name: /account menu/i })).toHaveText("A");
});

test("sign out returns to the logged-out header", async ({ page }) => {
  await signInWithGoogle(page);
  await signOut(page);
  await expect(page.getByRole("button", { name: /sign up \/ log in|^log in$/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /account menu/i })).toHaveCount(0);
});

test("session survives a reload", async ({ page }) => {
  await signInWithGoogle(page);
  await page.reload();
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();
});

test("auth modal opens from the compact header button", async ({ page }) => {
  // On the mobile project the button label collapses to "Log in".
  await openAuthModal(page);
  await expect(page.getByRole("button", { name: /^Email$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Google$/ })).toBeVisible();
});
