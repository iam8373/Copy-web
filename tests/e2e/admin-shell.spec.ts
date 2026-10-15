import { test, expect } from "@playwright/test";
import { totp } from "../support/totp";
import { becomeStaff, enrollMfa, resetState, signInWithEmail, signOut, staffSession } from "./helpers";

/** Admin R2: access, MFA, shell, dashboard. */
test.describe("admin shell", () => {
  test.skip(({ isMobile }) => isMobile, "admin is desktop-first; one viewport is enough here");

  test("signed out: /admin redirects home and is never cached or indexed", async ({ page, request }) => {
    const res = await request.get("/admin", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()["location"]).toMatch(/\/$/);
    expect(res.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    expect(res.headers()["cache-control"]).toMatch(/no-store/);
    await resetState(page);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/$/);
  });

  test("a signed-in user gets a plain 404 and no Admin link", async ({ page }) => {
    await resetState(page);
    await signInWithEmail(page);
    const res = await page.goto("/admin");
    expect(res?.status()).toBe(404);
    expect((await page.goto("/admin/mfa"))?.status()).toBe(404);
    await page.goto("/");
    await page.getByRole("button", { name: /account menu/i }).click();
    await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);
  });

  test("staff must enrol MFA before anything; a wrong code is refused", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await resetState(page);
    await becomeStaff(page, "moderator");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/mfa$/);
    await expect(page.getByRole("heading", { level: 1, name: "Two-step verification" })).toBeVisible();
    // No section links before MFA.
    await expect(page.getByRole("navigation", { name: "Admin" })).toHaveCount(0);
    await page.getByRole("button", { name: "Start setup" }).click();
    await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();
    const secret = (await page.getByTestId("mfa-secret").innerText()).trim();
    expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
    const wrong = totp(secret) === "000000" ? "111111" : "000000";
    await page.getByLabel("6-digit code").fill(wrong);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByRole("status")).toContainText("That code is not right");
    await page.getByLabel("6-digit code").fill(totp(secret));
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("next sign-in asks for a code (challenge), not a new enrolment", async ({ page }) => {
    const { email, secret } = await staffSession(page, "moderator");
    await page.goto("/");
    await signOut(page);
    await signInWithEmail(page, email);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/mfa$/);
    await expect(page.getByRole("heading", { name: "Enter your code" })).toBeVisible();
    await expect(page.getByTestId("mfa-secret")).toHaveCount(0);
    await page.getByLabel("6-digit code").fill(totp(secret));
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  });

  test("dashboard: role-aware menu, stats, noindex, no public chrome, Admin link in the account menu", async ({ page }) => {
    await staffSession(page, "admin");
    const res = await page.goto("/admin");
    expect(res?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    expect(res?.headers()["cache-control"]).toMatch(/no-store/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("trading-state")).toHaveText("Trading is on");
    expect(Number((await page.getByTestId("stat-open").innerText()).replace(/,/g, ""))).toBeGreaterThan(0);
    await expect(page.getByRole("contentinfo")).toHaveCount(0); // public footer hidden
    await expect(page.locator("h1")).toHaveCount(1);
    await page.getByRole("button", { name: /account menu/i }).click();
    await expect(page.getByRole("link", { name: "Admin", exact: true })).toBeVisible();
  });
});
