import { test, expect } from "@playwright/test";

/**
 * Launch smoke (S6). Read-only; works against local, staging or production.
 * Labels are matched in English (a fresh browser has no saved language).
 */

test("health route returns ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});

test("robots.txt disallows crawling of private areas", async ({ request }) => {
  const body = await (await request.get("/robots.txt")).text();
  expect(body).toMatch(/Disallow:/);
  expect(body).toMatch(/Disallow: \/(admin)?\s/);
});

test("/admin redirects home when signed out", async ({ request }) => {
  const res = await request.get("/admin", { maxRedirects: 0 });
  expect([302, 307, 308]).toContain(res.status());
  expect(new URL(res.headers()["location"] ?? "/", "http://x").pathname).toBe("/");
});

test("the home page HTML already contains markets", async ({ request }) => {
  const html = await (await request.get("/")).text();
  expect(html).toContain('data-testid="markets-status" data-status="ready"');
  const count = Number(/data-count="(\d+)"/.exec(html)?.[1] ?? 0);
  expect(count).toBeGreaterThan(0);
  expect(html).toMatch(/href="\/market\/[a-z0-9-]+"/);
});

test("the sign-in sheet opens and offers Google", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("banner").getByRole("button", { name: /sign up \/ log in|^log in$/i }).click();
  const sheet = page.getByTestId("auth-modal");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId("google-signin").or(sheet.getByRole("button", { name: /google/i })).first()).toBeVisible();
});

test("a market page shows the chart, order book and rules; a signed-out buy opens sign-in", async ({ page, isMobile }) => {
  const html = await (await page.request.get("/")).text();
  const slug = /href="\/market\/([a-z0-9-]+)"/.exec(html)?.[1];
  expect(slug).toBeTruthy();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/market/${slug}`);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByTestId("price-chart").or(page.locator("svg.recharts-surface")).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /order book/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /rules/i })).toBeVisible();

  if (isMobile) await page.getByTestId("mobile-trade-bar").getByRole("button").first().click();
  const scope = page.getByTestId(isMobile ? "trade-modal" : "trade-panel");
  const place = scope.getByRole("button", { name: /place order/i });
  if (await place.isEnabled()) {
    await place.click();
    await expect(page.getByTestId("auth-modal")).toBeVisible();
  } else {
    // A closed market: buying is disabled with a note instead.
    await expect(scope.getByTestId("market-closed-note")).toBeVisible();
  }
  expect(errors).toEqual([]);
});
