import { test, expect } from "@playwright/test";
import { localRest, localUserId, openAuthModal, resetState, signInWithEmail } from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetState(page);
});

test("cannot sign in without ticking the 18+ box", async ({ page }) => {
  await openAuthModal(page);
  const box = page.locator('[data-testid="age-confirm"]');
  await expect(box).toBeVisible();
  await expect(box).not.toBeChecked();

  // Both routes are disabled until the box is ticked.
  await expect(page.getByRole("button", { name: /send code/i })).toBeDisabled();
  await page.getByTestId("auth-modal").getByRole("button", { name: /^Google$/ }).click();
  await expect(page.getByTestId("google-signin")).toBeDisabled();
  await expect(page.getByRole("button", { name: /account menu/i })).toHaveCount(0);
});

test("ticking the box enables both sign-in routes", async ({ page }) => {
  await openAuthModal(page);
  await page.locator('[data-testid="age-confirm"]').check();
  await expect(page.getByRole("button", { name: /send code/i })).toBeEnabled();
  await page.getByTestId("auth-modal").getByRole("button", { name: /^Google$/ }).click();
  await expect(page.getByTestId("google-signin")).toBeEnabled();
});

test("a missing consent is asked for again before the first order, and stored on the server", async ({ page }) => {
  const email = await signInWithEmail(page);
  const id = await localUserId(email);
  // e.g. a Google sign-in whose consent cookie expired on the way back.
  await localRest(`profiles?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ age_confirmed_at: null }) });
  await page.goto("/markets/cricket");
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();

  await page.getByRole("button", { name: /^Trade$/ }).first().click();
  await page.getByRole("button", { name: /place order/i }).click();

  const dialog = page.getByTestId("age-confirm-dialog");
  await expect(dialog).toBeVisible();
  await expect(page.getByText(/order placed successfully/i)).toHaveCount(0);
  const confirm = dialog.getByRole("button", { name: /confirm and continue/i });
  await expect(confirm).toBeDisabled();
  await dialog.getByTestId("age-reconfirm").check();
  await confirm.click();
  await expect(dialog).toHaveCount(0);

  const [profile] = await localRest<Array<{ age_confirmed_at: string | null }>>(
    `profiles?id=eq.${id}&select=age_confirmed_at`
  );
  expect(profile.age_confirmed_at).not.toBeNull();

  // Now the order goes through.
  await page.getByRole("button", { name: /^Trade$/ }).first().click();
  await page.getByRole("button", { name: /place order/i }).click();
  await expect(page.getByText(/order placed successfully/i)).toBeVisible();
});

test("legal pages render and old anchors still resolve", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: /eligibility \(18\+\)/i })).toBeVisible();
  await expect(page.getByText(/must be at least 18 years old/i)).toBeVisible();
  await expect(page.getByText(/draft — pending legal review/i).first()).toBeVisible();

  for (const path of ["/privacy", "/responsible-play", "/grievance"]) {
    const res = await page.goto(path);
    expect(res?.status(), `${path} should resolve`).toBe(200);
    await expect(page.getByText(/draft — pending legal review/i).first()).toBeVisible();
  }

  // Legacy /learn#terms and /learn#privacy links must still land somewhere real.
  // A hash-only goto returns no response object, so assert the anchors exist.
  const learn = await page.goto("/learn");
  expect(learn?.status()).toBe(200);
  await expect(page.locator("#terms")).toHaveCount(1);
  await expect(page.locator("#privacy")).toHaveCount(1);
  // ...and that the section points readers at the dedicated pages.
  await expect(page.locator('#terms a[href="/terms"]')).toHaveCount(1);
  await expect(page.locator('#terms a[href="/privacy"]')).toHaveCount(1);

  // Footer exposes the new destinations.
  await page.goto("/");
  await expect(page.getByRole("link", { name: /^Terms$/ })).toHaveAttribute("href", "/terms");
  await expect(page.getByRole("link", { name: /^Privacy$/ })).toHaveAttribute(
    "href",
    "/privacy"
  );
});

test("reopening the modal starts unticked, and an immediate tick sticks", async ({
  page,
}) => {
  // Regression: the form used to reset in an effect after opening, which could
  // untick a box the user had already ticked.
  await openAuthModal(page);
  const box = page.locator('[data-testid="age-confirm"]');
  await box.check();
  await page.keyboard.press("Escape");

  await openAuthModal(page);
  await expect(box).not.toBeChecked();
  await box.check();
  await page.waitForTimeout(300);
  await expect(box).toBeChecked();
  await page.getByTestId("auth-modal").getByRole("button", { name: /^Google$/ }).click();
  await expect(page.getByTestId("google-signin")).toBeEnabled();
});
