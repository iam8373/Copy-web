import { test, expect } from "@playwright/test";
import {
  acceptAgeIfPresent,
  localRest,
  localUserId,
  openAuthModal,
  readCode,
  resetState,
  signInWithEmail,
  signOut,
  uniqueEmail,
} from "./helpers";

/**
 * Real Supabase Auth (Phase B2, D-019/D-021) against the LOCAL stack, with
 * EMAIL_OTP_ENABLED=true. Google-only mode (the current production setting)
 * is covered by tests/e2e-auth (built with EMAIL_OTP_ENABLED=false).
 */

test.beforeEach(async ({ page }) => {
  await resetState(page);
});

test("an invalid email is refused before anything is sent", async ({ page }) => {
  await openAuthModal(page);
  await acceptAgeIfPresent(page);
  await page.getByRole("textbox", { name: /email address/i }).fill("not-an-email");
  await page.getByRole("button", { name: /send code/i }).click();
  await expect(page.getByTestId("auth-modal").getByRole("alert")).toHaveText(/valid email address/i);
  await expect(page.getByRole("textbox", { name: /6-digit code/i })).toHaveCount(0);
});

test("email code sign-in creates the profile, wallet, credit and consent exactly once", async ({ page, browser }) => {
  const email = uniqueEmail("asha");
  await openAuthModal(page);
  await acceptAgeIfPresent(page);
  const since = Date.now() - 1000;
  await page.getByRole("textbox", { name: /email address/i }).fill(email);
  await page.getByRole("button", { name: /send code/i }).click();
  await expect(page.getByTestId("resend-code")).toHaveText(/New code in \d+s/);

  const { code, subject } = await readCode(email, since);
  expect(subject).toBe("Your BharatPredict sign-in code");
  await page.getByRole("textbox", { name: /6-digit code/i }).fill(code);
  await page.getByRole("button", { name: /verify/i }).click();

  const avatar = page.getByRole("button", { name: /account menu/i });
  await expect(avatar).toHaveText("A");
  await expect(page.getByText(/signed in with an email code/i)).toBeVisible();
  // The menu shows the real account.
  await avatar.click();
  await expect(page.getByRole("banner").getByText(email)).toBeVisible();
  await page.keyboard.press("Escape");

  const id = await localUserId(email);
  const [profile] = await localRest<Array<{ age_confirmed_at: string | null; terms_version: string }>>(
    `profiles?id=eq.${id}&select=age_confirmed_at,terms_version`
  );
  expect(profile.age_confirmed_at).not.toBeNull();
  expect(profile.terms_version).toBe("draft-2026-10");
  const [wallet] = await localRest<Array<{ balance: number }>>(`wallets?user_id=eq.${id}&select=balance`);
  expect(Number(wallet.balance)).toBe(10000);

  // Signing in again (another browser) reuses the account: no second credit.
  const other = await browser.newPage({ baseURL: test.info().project.use.baseURL });
  await other.goto("/");
  await signInWithEmail(other, email);
  const credits = await localRest<unknown[]>(`ledger_entries?user_id=eq.${id}&type=eq.signup_credit&select=id`);
  expect(credits).toHaveLength(1);
  await other.close();

  // No session data in localStorage: the auth cookie is the session.
  expect(await page.evaluate(() => localStorage.getItem("bp-session"))).toBeNull();
});

test("the session is a cookie: it survives a reload and sign-out ends it", async ({ page, context }) => {
  await signInWithEmail(page);
  expect((await context.cookies()).some((c) => /^sb-.*-auth-token/.test(c.name))).toBe(true);

  await page.reload();
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();
  await expect(page.getByText(/signed in with an email code/i)).toHaveCount(0); // no second welcome

  await signOut(page);
  await page.reload();
  await expect(page.getByRole("button", { name: /account menu/i })).toHaveCount(0);
});

test("a wrong code is refused with a clear message", async ({ page }) => {
  const email = uniqueEmail("wrong");
  await openAuthModal(page);
  await acceptAgeIfPresent(page);
  const since = Date.now() - 1000;
  await page.getByRole("textbox", { name: /email address/i }).fill(email);
  await page.getByRole("button", { name: /send code/i }).click();
  const { code } = await readCode(email, since);
  await page.getByRole("textbox", { name: /6-digit code/i }).fill(code === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: /verify/i }).click();
  await expect(page.getByTestId("auth-modal").getByRole("alert")).toHaveText(/wrong or has expired/i);
  await expect(page.getByRole("button", { name: /account menu/i })).toHaveCount(0);
});

test("code requests are rate-limited per email on the server", async ({ page }) => {
  // The test build allows 4 code requests per email per 10 minutes.
  const email = uniqueEmail("limit");
  await openAuthModal(page);
  await acceptAgeIfPresent(page);
  await page.getByRole("textbox", { name: /email address/i }).fill(email);
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: /send code/i }).click();
    await expect(page.getByRole("textbox", { name: /6-digit code/i })).toBeVisible();
    await page.getByRole("button", { name: /use a different email/i }).click();
    await page.waitForTimeout(1100); // the local auth server's 1 s resend window
  }
  await page.getByRole("button", { name: /send code/i }).click();
  await expect(page.getByTestId("auth-modal").getByRole("alert")).toHaveText(/too many attempts/i);
});

test("there is no demo sign-in left anywhere", async ({ page }) => {
  await openAuthModal(page);
  const modal = page.getByTestId("auth-modal");
  await expect(modal).not.toContainText(/demo|any 6 digits/i);
  await modal.getByRole("button", { name: /^Google$/ }).click();
  await expect(modal.getByTestId("google-account")).toHaveCount(0);
  await expect(modal.getByTestId("google-signin")).toBeDisabled();

  // An old demo session in storage signs nobody in, and is removed.
  await page.evaluate(() =>
    localStorage.setItem("bp-session", JSON.stringify({ method: "google", handle: "x@y.z", initial: "X" }))
  );
  await page.reload();
  await expect(page.getByRole("button", { name: /account menu/i })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("bp-session"))).toBeNull();
});

test("Google goes to Supabase's authorize endpoint with PKCE and our callback", async ({ page }) => {
  await openAuthModal(page);
  await acceptAgeIfPresent(page);
  await page.getByTestId("auth-modal").getByRole("button", { name: /^Google$/ }).click();
  const req = page.waitForRequest((r) => r.url().includes("/auth/v1/authorize"));
  await page.getByTestId("google-signin").click();
  const url = new URL((await req).url());
  expect(url.searchParams.get("provider")).toBe("google");
  expect(url.searchParams.get("redirect_to")).toMatch(/\/auth\/callback\?next=%2F/);
  expect(url.searchParams.get("code_challenge")).toBeTruthy();
  // The consent travelled as a signed, httpOnly cookie scoped to the callback.
  const consent = (await page.context().cookies()).find((c) => c.name === "bp_age_consent");
  expect(consent?.httpOnly).toBe(true);
  expect(consent?.path).toBe("/auth/callback");
});

test("a failed callback lands home with a message; next cannot leave the site", async ({ page }) => {
  await page.goto("/auth/callback?code=not-a-real-code&next=//evil.example");
  await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);
  await expect(page.getByText(/sign-in didn't complete/i).first()).toBeVisible();
});

test("a suspended account is signed out on its next visit", async ({ page }) => {
  const email = await signInWithEmail(page);
  const id = await localUserId(email);
  await localRest(`profiles?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status: "suspended" }) });
  await page.reload();
  await expect(page.getByText(/account suspended/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /account menu/i })).toHaveCount(0);
});
