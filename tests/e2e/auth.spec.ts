import { test, expect } from "@playwright/test";
import {
  acceptAgeIfPresent,
  openAuthModal,
  resetState,
  signInWithGoogle,
  signInWithPhone,
  signOut,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetState(page);
});

test("invalid mobile number shows a validation error", async ({ page }) => {
  await openAuthModal(page);
  await acceptAgeIfPresent(page);
  await page.getByRole("textbox", { name: /mobile number/i }).fill("12345");
  await page.getByRole("button", { name: /send otp/i }).click();

  await expect(page.getByText(/valid 10-digit Indian mobile number/i)).toBeVisible();
  // Still on the number step, so no OTP field appeared.
  await expect(page.getByRole("textbox", { name: /otp/i })).toHaveCount(0);
});

test("valid number then any six digits signs in and shows the avatar initial", async ({
  page,
}) => {
  await signInWithPhone(page, "9876543210");

  const avatar = page.getByRole("button", { name: /account menu/i });
  await expect(avatar).toBeVisible();
  // Initial for a phone session is the last digit of the number.
  await expect(avatar).toHaveText("0");
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
  await expect(page.getByRole("button", { name: /^Phone$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Google$/ })).toBeVisible();
});
