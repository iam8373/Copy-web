import { test, expect } from "@playwright/test";
import { localRest, localUserId, resetState, signInWithEmail, staffSession, uniqueEmail } from "./helpers";

/** Admin R6: grievance form + inbox, users and credits, settings, audit, compliance. */

async function fileGrievance(page: import("@playwright/test").Page, email: string, subject = `Wrong result ${Date.now()}`) {
  await page.goto("/grievance");
  const form = page.getByRole("form", { name: "Raise a grievance" });
  await form.getByLabel("Your name").fill("Asha Rao");
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Topic").selectOption("resolution");
  await form.getByLabel("Subject").fill(subject);
  await form.getByLabel("What happened?").fill("The market resolved before the match finished.");
  await form.getByRole("button", { name: "Send" }).click();
}

test("anyone can file a grievance and gets a reference; 3 an hour per email", async ({ page }) => {
  await resetState(page);
  const email = uniqueEmail("griever");
  await fileGrievance(page, email);
  await expect(page.getByTestId("grievance-sent")).toContainText(/BP-[0-9A-F]{8}/);
  const [row] = await localRest<Array<{ category: string; user_id: string | null }>>(`grievances?email=eq.${email}&select=category,user_id`);
  expect(row).toEqual({ category: "resolution", user_id: null });
  for (let i = 0; i < 2; i++) {
    await fileGrievance(page, email);
    await expect(page.getByTestId("grievance-sent")).toBeVisible();
  }
  await fileGrievance(page, email);
  await expect(page.getByRole("alert").filter({ hasText: "Too many grievances" })).toBeVisible();
});

test.describe("admin people", () => {
  test.skip(({ isMobile }) => isMobile, "admin is desktop-first");

  test("moderator: grievance inbox, no access to admin-only areas", async ({ page, browser }) => {
    const subject = `Inbox test ${Date.now()}`;
    const ctx = await browser.newContext();
    const pub = await ctx.newPage();
    await pub.goto("/grievance");
    const form = pub.getByRole("form", { name: "Raise a grievance" });
    await form.getByLabel("Your name").fill("Ravi");
    await form.getByLabel("Email").fill(uniqueEmail("ravi"));
    await form.getByLabel("Subject").fill(subject);
    await form.getByLabel("What happened?").fill("My balance looks wrong after the payout.");
    await form.getByRole("button", { name: "Send" }).click();
    const ref = ((await pub.getByTestId("grievance-sent").innerText()).match(/BP-[0-9A-F]{8}/) ?? [""])[0];
    await ctx.close();

    await staffSession(page, "moderator");
    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link", { name: "Grievances" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Users" })).toHaveCount(0);
    expect((await page.goto("/admin/users"))?.status()).toBe(404);
    expect((await page.goto("/admin/settings"))?.status()).toBe(404);

    await page.goto("/admin/grievances");
    await page.getByTestId("grievance-row").filter({ hasText: ref }).getByRole("link").click();
    await expect(page.getByTestId("grievance-message")).toHaveText("My balance looks wrong after the payout.");
    await page.getByLabel("Status").selectOption("resolved");
    await page.getByLabel("Internal note").fill("Checked ledger, payout correct; replied by email.");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
    const [g] = await localRest<Array<{ status: string; resolved_at: string | null; admin_note: string }>>(
      `grievances?reference=eq.${ref}&select=status,resolved_at,admin_note`
    );
    expect(g.status).toBe("resolved");
    expect(g.resolved_at).not.toBeNull();
  });

  test("admin: find a user, adjust credits, suspend and reinstate, change role; audit and compliance", async ({ page, browser }) => {
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await resetState(other);
    const email = await signInWithEmail(other, uniqueEmail("target"));
    await ctx.close();
    const uid = await localUserId(email);

    const me = await staffSession(page, "admin");
    await page.goto(`/admin/users?q=${encodeURIComponent(email)}`);
    await page.getByTestId("user-row").getByRole("link", { name: email }).click();
    await expect(page.getByRole("heading", { level: 1, name: "User" })).toBeVisible();

    const credits = page.getByRole("form", { name: "Adjust play credits" });
    await credits.getByLabel("Amount (₹)").fill("500");
    await credits.getByLabel("Reason").fill("Goodwill for outage");
    await credits.getByRole("button", { name: "Apply" }).click();
    await expect(credits.getByRole("status")).toHaveText("Done. New balance ₹10,500.");
    await credits.getByLabel("Amount (₹)").fill("20000");
    await credits.getByLabel("Reason").fill("Too much");
    await credits.getByRole("button", { name: "Apply" }).click();
    await expect(credits.getByRole("status")).toHaveText("That amount is not allowed.");
    await expect(page.getByRole("region", { name: "Recent ledger" })).toContainText("Goodwill for outage");

    await page.getByRole("button", { name: "Suspend" }).click();
    const dialog = page.getByRole("dialog", { name: "Suspend this account?" });
    await dialog.getByLabel("Reason").fill("Abuse report #7");
    await dialog.getByRole("button", { name: "Suspend" }).click();
    await expect(page.getByTestId("suspension")).toContainText("Abuse report #7");
    await page.getByRole("button", { name: "Reinstate" }).click();
    await expect(page.getByTestId("suspension")).toHaveCount(0);

    await page.getByLabel("New role").selectOption("moderator");
    await page.getByRole("button", { name: "Change role" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Role changed." })).toBeVisible();
    const [p] = await localRest<Array<{ role: string; status: string }>>(`profiles?id=eq.${uid}&select=role,status`);
    expect(p).toEqual({ role: "moderator", status: "active" });

    // Own account: no actions.
    await page.goto(`/admin/users/${me.uid}`);
    await expect(page.getByText("This is your own account")).toBeVisible();
    await expect(page.getByRole("form", { name: "Adjust play credits" })).toHaveCount(0);

    // Audit viewer.
    await page.goto(`/admin/audit?action=credits.adjust&entityId=${uid}`);
    await expect(page.getByTestId("audit-row")).toHaveCount(1);
    await page.goto(`/admin/audit?action=user.&entityId=${uid}`);
    await expect(page.getByTestId("audit-row")).toHaveCount(3); // suspend, reinstate, role

    // Compliance: both staff accounts with their authenticator state.
    await page.goto("/admin/compliance");
    await expect(page.getByTestId("staff-row").filter({ hasText: me.email })).toContainText("Authenticator: enrolled");
    await expect(page.getByTestId("staff-row").filter({ hasText: email })).toContainText("Authenticator: not enrolled");
  });

  test("admin: settings are validated and audited", async ({ page }) => {
    await staffSession(page, "admin");
    try {
      await page.goto("/admin/settings");
      const row = page.getByTestId("setting-dispute_window_hours");
      await row.getByRole("spinbutton").fill("1000");
      await row.getByRole("button", { name: "Save" }).click();
      await expect(row.getByRole("status")).toHaveText("Some fields are invalid. Check them and try again.");
      await row.getByRole("spinbutton").fill("48");
      await row.getByRole("button", { name: "Save" }).click();
      await expect(row.getByRole("status")).toHaveText("Saved.");
      const [s] = await localRest<Array<{ value: number }>>("app_settings?key=eq.dispute_window_hours&select=value");
      expect(s.value).toBe(48);
      await page.goto("/admin/audit?action=setting.update&entityId=dispute_window_hours");
      await expect(page.getByTestId("audit-row").first()).toContainText("setting.update");
    } finally {
      await localRest("app_settings?key=eq.dispute_window_hours", { method: "PATCH", body: JSON.stringify({ value: 24 }) });
    }
  });
});
