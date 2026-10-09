import { test, expect } from "@playwright/test";
import { STORAGE_KEY } from "../../src/i18n";
import { hi } from "../../src/i18n/hi";

/**
 * Production sign-in settings (EMAIL_OTP_ENABLED=false): Google only, with a
 * translated note; the email-code Server Actions also refuse while it is off (services/auth/server.ts).
 */

const esc = (v: string) => v.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
/** Matches the header sign-in button in English or Hindi, long or short label. */
const SIGN_IN = new RegExp(
  `^(sign up / log in|log in|${esc(hi.header.signIn)}|${esc(hi.header.signInShort)})$`,
  "i"
);

async function openAuth(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("banner").getByRole("button", { name: SIGN_IN }).click();
  await expect(page.getByTestId("auth-modal")).toBeVisible();
}

test("the sheet offers Google only, with the email note", async ({ page }) => {
  await openAuth(page);
  const modal = page.getByTestId("auth-modal");
  await expect(modal.getByTestId("google-signin")).toBeDisabled();
  await expect(modal.getByTestId("email-soon")).toHaveText(/email sign-in is coming soon/i);
  await expect(modal.getByRole("textbox", { name: /email address/i })).toHaveCount(0);
  await expect(modal.getByRole("button", { name: /^Email$/ })).toHaveCount(0);
  await expect(modal).not.toContainText(/demo/i);

  await modal.getByTestId("age-confirm").check();
  await expect(modal.getByTestId("google-signin")).toBeEnabled();
});

test("Google starts the PKCE flow through Supabase and returns to /auth/callback", async ({ page }) => {
  await openAuth(page);
  await page.getByTestId("age-confirm").check();
  const req = page.waitForRequest((r) => r.url().includes("/auth/v1/authorize"));
  await page.getByTestId("google-signin").click();
  const url = new URL((await req).url());
  expect(url.searchParams.get("provider")).toBe("google");
  expect(url.searchParams.get("redirect_to")).toMatch(/\/auth\/callback\?next=%2F/);
  expect(url.searchParams.get("code_challenge")).toBeTruthy();
});

test("the note is translated (Hindi)", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((k) => window.localStorage.setItem(k, "hi"), STORAGE_KEY);
  await openAuth(page);
  await expect(page.getByTestId("email-soon")).toHaveText(hi.auth.emailSoon);
  await expect(page.getByTestId("google-signin")).toHaveText(hi.auth.continueGoogle);
});
