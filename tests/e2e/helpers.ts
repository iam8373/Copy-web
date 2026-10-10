import { Page, expect } from "@playwright/test";
import { LOCAL } from "../support/local-supabase";

/**
 * The app always uses real Supabase Auth; tests run it against the LOCAL stack
 * (tests/support/local-supabase.ts). Email codes are read from the local mail
 * catcher, so sign-in goes through exactly the code path users get.
 */

/** Clears storage and cookies so every test starts signed out. */
export async function resetState(page: Page) {
  await page.context().clearCookies();
  await page.goto("/");
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
  });
}

let counter = 0;
/** A fresh address per call, so tests never share an account. */
export function uniqueEmail(tag = "user") {
  counter += 1;
  return `${tag}.${Date.now()}.${process.pid}.${counter}@example.com`.toLowerCase();
}

/** Polls the local mail catcher for the newest 6-digit code sent to `to`. */
export async function readCode(to: string, notBefore = 0): Promise<{ code: string; subject: string }> {
  for (let i = 0; i < 60; i++) {
    const res = await fetch(`${LOCAL.mailUrl}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const list = (await res.json()) as { messages?: Array<{ ID: string; Subject: string; Created: string }> };
    const first = list.messages?.find((m) => Date.parse(m.Created) >= notBefore);
    if (first) {
      const msg = (await (await fetch(`${LOCAL.mailUrl}/api/v1/message/${first.ID}`)).json()) as { HTML: string };
      const m = msg.HTML.match(/data-otp>\s*(\d{6})\s*</);
      if (m) return { code: m[1], subject: first.Subject };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no code email for ${to}`);
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

export async function acceptAgeIfPresent(page: Page) {
  const box = page.locator('[data-testid="age-confirm"]');
  if ((await box.count()) > 0) {
    await box.check();
    await expect(box).toBeChecked();
  }
}

/** Signs in through the real sheet: email, code from the mail catcher, verify. */
export async function signInWithEmail(page: Page, email = uniqueEmail()) {
  await openAuthModal(page);
  await acceptAgeIfPresent(page);
  const since = Date.now() - 1000;
  await page.getByRole("textbox", { name: /email address/i }).fill(email);
  await page.getByRole("button", { name: /send code/i }).click();
  await expect(page.getByRole("textbox", { name: /6-digit code/i })).toBeVisible();
  const { code } = await readCode(email, since);
  await page.getByRole("textbox", { name: /6-digit code/i }).fill(code);
  await page.getByRole("button", { name: /verify/i }).click();
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();
  return email;
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: /account menu/i }).click();
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page.getByRole("button", { name: /account menu/i })).toHaveCount(0);
}

const admin = () => ({ apikey: LOCAL.secretKey, authorization: `Bearer ${LOCAL.secretKey}` });

/** Service-role REST call against the LOCAL stack (test assertions only). */
export async function localRest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${LOCAL.url}/rest/v1/${path}`, {
    ...init,
    headers: { ...admin(), "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function localUserId(email: string): Promise<string> {
  const res = await fetch(`${LOCAL.url}/auth/v1/admin/users?per_page=1000`, { headers: admin() });
  const body = (await res.json()) as { users: Array<{ id: string; email: string }> };
  const u = body.users.find((x) => x.email === email.toLowerCase());
  if (!u) throw new Error(`no auth user ${email}`);
  return u.id;
}

export interface OpenMarket {
  id: string;
  slug: string;
  outcomes: Array<{ id: string; label: string; shares_outstanding: number; price: number }>;
}

/**
 * An open, non-live market that stays open for at least a few days, so
 * trading tests never depend on catalogue dates that will pass.
 */
export async function openMarket(binary = true, skip = 0): Promise<OpenMarket> {
  const after = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
  const rows = await localRest<OpenMarket[]>(
    `markets?status=eq.open&is_live=eq.false&is_binary=eq.${binary}&end_date=gt.${encodeURIComponent(after)}` +
      `&select=id,slug,outcomes!outcomes_market_id_fkey(id,label,shares_outstanding,price)&order=total_volume.desc&limit=${skip + 1}`
  );
  if (!rows[skip]) throw new Error("no open market in the local database");
  return rows[skip];
}
