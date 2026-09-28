import { test, expect } from "@playwright/test";
import { resetState, signInWithGoogle } from "./helpers";

/** Opens the quick-trade modal from the first market card on a page. */
async function openFirstTrade(page: import("@playwright/test").Page) {
  await page.goto("/markets/cricket");
  await page.getByRole("button", { name: /^Trade$/ }).first().click();
  await expect(page.getByRole("button", { name: /place order/i })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await resetState(page);
});

test("signed-out order opens the auth modal and places nothing", async ({ page }) => {
  await openFirstTrade(page);
  await page.getByRole("button", { name: /place order/i }).click();

  await expect(page.getByRole("heading", { name: /sign up \/ log in/i })).toBeVisible();
  // No success animation for a rejected order, and the prompt toast instead.
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByText(/sign in to place an order/i)).toBeVisible();
  // NOTE: the signed-out dashboard still renders seeded demo positions until
  // Phase C scopes positions to a session; asserted in positions.spec.ts there.
});

test("signed-in order shows the success animation, a toast, and lands on the dashboard", async ({
  page,
}) => {
  await signInWithGoogle(page);
  await openFirstTrade(page);

  // The animation deliberately self-dismisses in ~1.2s, so start waiting for
  // it before the click rather than asserting after — otherwise a slow run can
  // miss the window and the test flakes.
  const appeared = page.waitForSelector('[role="status"]', {
    state: "attached",
    timeout: 5_000,
  });
  await page.getByRole("button", { name: /place order/i }).click();

  const overlay = await appeared;
  expect(await overlay.textContent()).toMatch(/order confirmed/i);

  // The toast lives longer than the animation, so it can be asserted normally.
  await expect(page.getByText(/order placed successfully/i)).toBeVisible();
  // ...and the overlay auto-dismisses.
  await expect(page.getByRole("status")).toHaveCount(0, { timeout: 5_000 });

  await page.goto("/dashboard");
  // Positions hydrate from storage in an effect, so use a retrying assertion
  // rather than a bare count().
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();
  await expect(page.locator('a[href^="/market/"]:visible')).not.toHaveCount(0);
  // Portfolio figures are rupee-formatted; never assert an exact jittering price.
  await expect(page.getByText(/portfolio value/i)).toBeVisible();
  await expect(page.locator("body")).toContainText("₹");
});

test("rapid consecutive orders do not stack the animation", async ({ page }) => {
  await signInWithGoogle(page);
  await openFirstTrade(page);

  const place = page.getByRole("button", { name: /place order/i });
  await place.click();
  await page.getByRole("button", { name: /^Trade$/ }).first().click();
  await page.getByRole("button", { name: /place order/i }).click();

  // Never more than one live region, however many fills land back to back.
  // (Zero is valid too if both have already auto-dismissed.)
  expect(await page.locator('[role="status"]').count()).toBeLessThanOrEqual(1);
  await expect(page.getByText(/order placed successfully/i).first()).toBeVisible();
});
