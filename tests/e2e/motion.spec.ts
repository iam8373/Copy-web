import { test, expect } from "@playwright/test";
import { resetState } from "./helpers";

/** Work order 4, Phase 5: motion rules from docs/DESIGN.md → Motion. */

test.beforeEach(async ({ page }) => {
  await resetState(page);
});

/** Names of CSS animations still running in the document. */
const running = () =>
  document
    .getAnimations()
    .filter((a) => a.playState === "running")
    .map((a) => (a as CSSAnimation).animationName ?? "js");

test("each page fades in (opacity only, so fixed children still work)", async ({ page }) => {
  await page.goto("/markets/cricket");
  const wrapper = page.locator("main > div").first();
  await expect(wrapper).toHaveCSS("animation-name", "fade-in");
  // No transform: it would trap position:fixed descendants.
  await expect(wrapper).toHaveCSS("transform", "none");
});

test("grid stagger: 30ms steps, capped at 8, first paint only", async ({ page }) => {
  await page.goto("/markets/cricket");
  const items = page.locator('section:not([data-testid="live-section"]) [data-testid="grid-item"]');
  expect(await items.count()).toBeGreaterThan(8);
  const delays = await items.evaluateAll((els) =>
    els.map((el) => ({ cls: el.className, delay: (el as HTMLElement).style.animationDelay }))
  );
  delays.slice(0, 8).forEach((d, i) => {
    expect(d.cls).toContain("animate-fade-in-up");
    expect(d.delay).toBe(`${i * 30}ms`);
  });
  for (const d of delays.slice(8)) expect(d.cls).not.toContain("animate-fade-in-up");

  // After first paint, re-filtering does not replay the entrance.
  await page.waitForTimeout(700);
  await page.locator('[data-testid="sort-option"][data-sort="Popular"]').click();
  const after = await items.evaluateAll((els) => els.map((el) => el.className));
  for (const cls of after) expect(cls).not.toContain("animate-fade-in-up");
});

test("nothing a user reads keeps animating past 500ms", async ({ page }) => {
  await page.goto("/market/will-india-win-the-2026-t20-world-cup");
  await page.waitForTimeout(1500);
  // Only status indicators (live pulse dots, skeletons) may loop.
  const names = await page.evaluate(running);
  for (const n of names) expect(["pulse-dot", "pulse", "spin"]).toContain(n);
});

test("reduced motion: no running animations shortly after load", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of ["/", "/markets/cricket", "/market/ipl-2026-winner"]) {
    await page.goto(path);
    await page.waitForTimeout(300);
    expect(await page.evaluate(running), path).toEqual([]);
  }
});

test("rules accordion animates height and stays out of the tab order when closed", async ({ page }) => {
  await page.goto("/market/will-india-win-the-2026-t20-world-cup");
  const toggle = page.getByRole("button", { name: "Rules & resolution" });
  // useId() ids contain colons, so match the attribute rather than #id.
  const panel = page.locator(`[id="${await toggle.getAttribute("aria-controls")}"]`);
  await expect(panel).toHaveCSS("visibility", "hidden");
  expect(await panel.evaluate((el) => getComputedStyle(el).transitionProperty)).toContain("grid-template-rows");
  await toggle.click();
  await expect(panel).toHaveCSS("visibility", "visible");
  await toggle.click();
  await expect(panel).toHaveCSS("visibility", "hidden");
});

test("payout counts to the new value and settles on it exactly", async ({ page, isMobile }) => {
  await page.goto("/market/will-india-win-the-2026-t20-world-cup");
  if (isMobile) await page.getByTestId("mobile-trade-bar").getByRole("button").first().click();
  const scope = page.getByTestId(isMobile ? "trade-modal" : "trade-panel");
  const payout = scope.getByTestId("trade-payout");
  const before = await payout.innerText();
  await scope.locator(isMobile ? "#amount" : "#detail-amount").fill("1000");
  await expect(payout).not.toHaveText(before);
  const target = Number(await payout.getAttribute("data-value"));
  const expected = `₹${target.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  await expect(payout).toHaveText(expected, { timeout: 2000 });
});

test("dialogs play an exit and are removed afterwards", async ({ page }) => {
  await page.goto("/e2e-ui");
  await page.getByTestId("open-dialog").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // Read the state in the same task as the key press, before the timer fires.
  const state = await page.evaluate(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    return document.querySelector("[data-state]")?.getAttribute("data-state") ?? "gone";
  });
  expect(["closing", "gone"]).toContain(state);
  await expect(dialog).toHaveCount(0);
});
