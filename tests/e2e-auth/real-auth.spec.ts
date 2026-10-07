import { test, expect, type Page } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";

/**
 * Real Supabase Auth (backend Phase 2, D-019) against a local Supabase:
 * email OTP read from the local mail catcher (Mailpit), the sign-up trigger
 * (profile, wallet, signup credit), confirm_age, cookie sessions, sign-out,
 * Google redirect wiring, the callback error path and suspended accounts.
 * See playwright.auth.config.ts for how to run it.
 */

function env(name: string): string {
  if (process.env[name]) return process.env[name]!;
  if (!existsSync(".env.local")) return "";
  const m = readFileSync(".env.local", "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
  return m ? m[1].replace(/^["']|["']$/g, "").trim() : "";
}

const API = env("E2E_SUPABASE_URL") || "http://127.0.0.1:54321";
const SERVICE = env("E2E_SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
const MAIL = env("E2E_MAILPIT_URL") || "http://127.0.0.1:54324";

const admin = { apikey: SERVICE, authorization: `Bearer ${SERVICE}` };

const unique = (tag: string) => `${tag}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;

/** Polls the mail catcher for the newest code sent to `to`. */
async function codeFor(to: string): Promise<{ code: string; subject: string }> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const list = (await res.json()) as { messages?: Array<{ ID: string; Subject: string }> };
    const first = list.messages?.[0];
    if (first) {
      const msg = (await (await fetch(`${MAIL}/api/v1/message/${first.ID}`)).json()) as { HTML: string };
      const m = msg.HTML.match(/data-otp>\s*(\d{6})\s*</);
      if (m) return { code: m[1], subject: first.Subject };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no code email for ${to}`);
}

async function userIdFor(email: string): Promise<string> {
  const res = await fetch(`${API}/auth/v1/admin/users?per_page=1000`, { headers: admin });
  const body = (await res.json()) as { users: Array<{ id: string; email: string }> };
  const u = body.users.find((x) => x.email === email.toLowerCase());
  if (!u) throw new Error(`no auth user ${email}`);
  return u.id;
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/rest/v1/${path}`, {
    ...init,
    headers: { ...admin, "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

async function openAuth(page: Page) {
  await page.goto("/");
  await page.getByRole("banner").getByRole("button", { name: /sign up \/ log in|^log in$/i }).click();
  await expect(page.getByTestId("auth-modal")).toBeVisible();
}

async function signInByEmail(page: Page, email: string) {
  await openAuth(page);
  await page.getByTestId("age-confirm").check();
  await page.getByRole("textbox", { name: /email address/i }).fill(email);
  await page.getByRole("button", { name: /send code/i }).click();
  await expect(page.getByRole("textbox", { name: /6-digit code/i })).toBeVisible();
  const { code } = await codeFor(email);
  await page.getByRole("textbox", { name: /6-digit code/i }).fill(code);
  await page.getByRole("button", { name: /verify/i }).click();
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();
}

test.beforeAll(() => {
  if (!SERVICE) throw new Error("SUPABASE_SERVICE_ROLE_KEY for the local stack is missing");
});

test("real mode shows no demo shortcuts", async ({ page }) => {
  await openAuth(page);
  const modal = page.getByTestId("auth-modal");
  await expect(modal).not.toContainText(/demo/i);
  await expect(modal.getByRole("button", { name: /send code/i })).toBeDisabled();
  await modal.getByRole("button", { name: /^Google$/ }).click();
  await expect(modal.getByTestId("google-account")).toHaveCount(0);
  await expect(modal.getByTestId("google-signin")).toBeDisabled();
});

test("email code: the email shows the code; sign-up creates profile, wallet, credit and consent", async ({ page }) => {
  const email = unique("Asha");
  await openAuth(page);
  await page.getByTestId("age-confirm").check();
  await page.getByRole("textbox", { name: /email address/i }).fill(email);
  await page.getByRole("button", { name: /send code/i }).click();
  await expect(page.getByTestId("resend-code")).toHaveText(/New code in \d+s/);

  const { code, subject } = await codeFor(email);
  expect(subject).toBe("Your BharatPredict sign-in code");
  expect(code).toMatch(/^\d{6}$/);

  await page.getByRole("textbox", { name: /6-digit code/i }).fill(code);
  await page.getByRole("button", { name: /verify/i }).click();
  const avatar = page.getByRole("button", { name: /account menu/i });
  await expect(avatar).toHaveText("A");
  await expect(page.getByText(/signed in with an email code/i)).toBeVisible();

  const id = await userIdFor(email);
  const [profile] = await rest<Array<{ handle: string; age_confirmed_at: string | null; terms_version: string; role: string }>>(
    `profiles?id=eq.${id}&select=handle,age_confirmed_at,terms_version,role`
  );
  expect(profile.handle).toMatch(/^asha\./);
  expect(profile.role).toBe("user");
  expect(profile.age_confirmed_at).not.toBeNull();
  expect(profile.terms_version).toBe("draft-2026-10");
  const [wallet] = await rest<Array<{ balance: number }>>(`wallets?user_id=eq.${id}&select=balance`);
  expect(Number(wallet.balance)).toBe(10000);
  const audit = await rest<Array<{ action: string }>>(`audit_log?entity_id=eq.${id}&select=action`);
  expect(audit.map((a) => a.action).sort()).toEqual(["age_confirmed", "user_signed_up"]);

  // Nothing about the session lives in demo storage.
  expect(await page.evaluate(() => localStorage.getItem("bp-session"))).toBeNull();
});

test("the session is a cookie the server sees: it survives a reload; sign-out ends it", async ({ page, context }) => {
  const email = unique("ravi");
  await signInByEmail(page, email);
  const cookies = await context.cookies();
  expect(cookies.some((c) => /^sb-.*-auth-token/.test(c.name))).toBe(true);

  await page.reload();
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();
  // No second welcome toast for a restored session.
  await expect(page.getByText(/signed in with an email code/i)).toHaveCount(0);

  await page.getByRole("button", { name: /account menu/i }).click();
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page.getByRole("button", { name: /account menu/i })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: /account menu/i })).toHaveCount(0);
  expect((await context.cookies()).some((c) => /^sb-.*-auth-token$/.test(c.name) && c.value)).toBe(false);
});

test("a second sign-in reuses the account and grants no second credit", async ({ page, browser }) => {
  const email = unique("meera");
  await signInByEmail(page, email);
  const fresh = await browser.newPage();
  await signInByEmail(fresh, email);
  const id = await userIdFor(email);
  const credits = await rest<unknown[]>(`ledger_entries?user_id=eq.${id}&type=eq.signup_credit&select=id`);
  expect(credits).toHaveLength(1);
  await fresh.close();
});

test("a wrong code is refused with a clear message", async ({ page }) => {
  const email = unique("wrong");
  await openAuth(page);
  await page.getByTestId("age-confirm").check();
  await page.getByRole("textbox", { name: /email address/i }).fill(email);
  await page.getByRole("button", { name: /send code/i }).click();
  const { code } = await codeFor(email);
  const bad = code === "000000" ? "111111" : "000000";
  await page.getByRole("textbox", { name: /6-digit code/i }).fill(bad);
  await page.getByRole("button", { name: /verify/i }).click();
  await expect(page.getByTestId("auth-modal").getByRole("alert")).toHaveText(/wrong or has expired/i);
  await expect(page.getByRole("button", { name: /account menu/i })).toHaveCount(0);
});

test("Google goes to Supabase's authorize endpoint and returns to /auth/callback", async ({ page }) => {
  await openAuth(page);
  await page.getByTestId("age-confirm").check();
  await page.getByTestId("auth-modal").getByRole("button", { name: /^Google$/ }).click();
  const req = page.waitForRequest((r) => r.url().includes("/auth/v1/authorize"));
  await page.getByTestId("google-signin").click();
  const url = new URL((await req).url());
  expect(url.searchParams.get("provider")).toBe("google");
  expect(url.searchParams.get("redirect_to")).toMatch(/\/auth\/callback\?next=%2F/);
  expect(url.searchParams.get("code_challenge")).toBeTruthy(); // PKCE
});

test("a failed callback lands on the home page with a message, not an error page", async ({ page }) => {
  await page.goto("/auth/callback?code=not-a-real-code&next=//evil.example");
  await expect(page).toHaveURL(/\/$/); // ?auth_error is cleaned up after the toast
  await expect(page.getByText(/sign-in didn't complete/i)).toBeVisible();
});

test("a suspended account is signed out on its next visit", async ({ page }) => {
  const email = unique("suspend");
  await signInByEmail(page, email);
  const id = await userIdFor(email);
  await rest(`profiles?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status: "suspended" }) });
  await page.reload();
  await expect(page.getByText(/account suspended/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /account menu/i })).toHaveCount(0);
});
