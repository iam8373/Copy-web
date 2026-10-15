import { test, expect, type Page } from "@playwright/test";
import { editableFields, isoToIstLocal, istLocalToIso, CreateMarket } from "../../src/lib/admin/market-schema";
import { localRest, signOut, staffSession, signInWithEmail } from "./helpers";
import { totp } from "../support/totp";

/** Admin R3: market management. */

test.describe("market form schema", () => {
  test("datetime-local values are IST and round-trip", () => {
    expect(istLocalToIso("2030-01-01T00:00")).toBe("2029-12-31T18:30:00.000Z");
    expect(isoToIstLocal("2029-12-31T18:30:00.000Z")).toBe("2030-01-01T00:00");
    expect(istLocalToIso("bad")).toBe("");
  });
  test("field locks follow the status", () => {
    expect(editableFields("draft").has("outcomes")).toBe(true);
    expect(editableFields("open").has("outcomes")).toBe(false);
    expect(editableFields("open").has("endDate")).toBe(true);
    expect(editableFields("closed").has("endDate")).toBe(false);
    expect(editableFields("resolved").size).toBe(0);
  });
  test("multi-outcome markets need 3+ distinct outcomes", () => {
    const base = {
      slug: "x-y", title: "Who wins?", description: "", category: "cricket", subcategory: "IPL",
      endDate: new Date(Date.now() + 864e5).toISOString(), resolutionSource: "src", isBinary: false,
      liquidityB: 20000, isFeatured: false, isLive: false, tags: [], region: "India",
    };
    expect(CreateMarket.safeParse({ ...base, outcomes: ["A", "a", "B"] }).success).toBe(false);
    expect(CreateMarket.safeParse({ ...base, outcomes: ["A", "B", "C"] }).success).toBe(true);
  });
});

async function createDraft(page: Page, slug: string, opts: { multi?: string[] } = {}) {
  await page.goto("/admin/markets/new");
  await page.getByLabel("Question").fill(`Will the ${slug} test pass?`);
  await page.getByLabel("Slug").fill(slug);
  await page.getByLabel("Sub-category").fill("IPL");
  await page.getByLabel("Resolution source").fill("Official scorecard");
  await page.getByLabel("Tags").fill("ipl, india");
  if (opts.multi) {
    await page.getByLabel("Several outcomes").check();
    await page.getByLabel("Outcomes", { exact: true }).fill(opts.multi.join("\n"));
  }
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(/\/admin\/markets\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("admin-status")).toHaveText("Draft");
}

test.describe("admin markets", () => {
  test.skip(({ isMobile }) => isMobile, "admin is desktop-first");

  test("moderator drafts; drafts stay private; publishing is admin-only", async ({ page }) => {
    await staffSession(page, "moderator");
    const slug = `e2e-draft-${Date.now()}`;
    await createDraft(page, slug);
    await expect(page.getByText("Publishing and closing are admin actions.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0);
    const [row] = await localRest<Array<{ status: string; tags: string[]; created_by: string | null }>>(
      `markets?slug=eq.${slug}&select=status,tags,created_by`
    );
    expect(row).toMatchObject({ status: "draft", tags: ["india", "ipl"] });
    expect(row.created_by).not.toBeNull();
    expect((await page.goto(`/market/${slug}`))?.status()).toBe(404);
    await page.goto("/admin/markets?status=draft");
    await expect(page.getByTestId("admin-market-row").filter({ hasText: slug })).toHaveCount(1);
    // A duplicate slug is refused with a clear message.
    await page.goto("/admin/markets/new");
    await page.getByLabel("Question").fill("Duplicate slug market?");
    await page.getByLabel("Slug").fill(slug);
    await page.getByLabel("Sub-category").fill("IPL");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByRole("status")).toHaveText("That slug is already used by another market.");
  });

  test("admin: create multi draft, publish with typed slug, edit wording, outcomes locked, close", async ({ page }) => {
    await staffSession(page, "admin");
    const slug = `e2e-multi-${Date.now()}`;
    await createDraft(page, slug, { multi: ["Mumbai", "Chennai", "Delhi"] });
    await expect(page.getByRole("region", { name: "Outcomes and prices" }).getByRole("listitem")).toHaveCount(3);

    await page.getByRole("button", { name: "Publish" }).click();
    const dialog = page.getByRole("dialog", { name: "Publish this market?" });
    const confirm = dialog.getByRole("button", { name: "Publish" });
    await dialog.getByLabel("Market slug").fill(slug.slice(0, -1));
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel("Market slug").fill(slug);
    await confirm.click();
    await expect(page.getByTestId("admin-status")).toHaveText("Open");

    // Public page exists now.
    const pub = await page.request.get(`/market/${slug}`);
    expect(pub.status()).toBe(200);

    // Open: outcomes and slug locked, wording editable.
    await expect(page.locator("#m-outcomes")).toBeDisabled();
    await expect(page.getByLabel(/^Slug/)).toBeDisabled();
    await page.getByLabel(/^Question/).fill(`Who wins the ${slug} final?`);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
    await page.goto(`/market/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Who wins the ${slug} final?`);

    await page.goBack();
    await expect(page.getByRole("region", { name: "History" })).toContainText("market.update");
    await expect(page.getByRole("region", { name: "History" })).toContainText("market.publish");

    await page.getByRole("button", { name: "Close trading now" }).click();
    const close = page.getByRole("dialog", { name: "Close trading now?" });
    await close.getByLabel("Market slug").fill(slug);
    await close.getByRole("button", { name: "Close trading now" }).click();
    await expect(page.getByTestId("admin-status")).toHaveText("Closed");
    const [row] = await localRest<Array<{ status: string }>>(`markets?slug=eq.${slug}&select=status`);
    expect(row.status).toBe("closed");
  });

  test("a session that lost MFA cannot use the market screens", async ({ page }) => {
    const { email, secret } = await staffSession(page, "admin");
    await page.goto("/");
    await signOut(page);
    await signInWithEmail(page, email);
    await page.goto("/admin/markets/new");
    await expect(page).toHaveURL(/\/admin\/mfa$/);
    await page.getByLabel("6-digit code").fill(totp(secret));
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  });
});
