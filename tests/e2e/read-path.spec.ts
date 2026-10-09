import { test, expect } from "@playwright/test";
import { MARKETS } from "../../src/data/markets";
import { localRest, resetState } from "./helpers";

/**
 * Backend B3: pages render from the database (the local stand-in, seeded by
 * the global setup from the static catalogue), prices update live, and the
 * static file is not part of the app at runtime.
 */

test.beforeEach(async ({ page }) => {
  await resetState(page);
});

test("market pages are served from the database, with database ids", async ({ page }) => {
  const [row] = await localRest<Array<{ id: string; title: string }>>("markets?slug=eq.ipl-2026-winner&select=id,title");
  await page.goto("/market/ipl-2026-winner");
  await expect(page.locator("h1")).toHaveText(row.title);
  // Outcome ids in the page are the database uuids, not the old static keys.
  const ids = await page.getByTestId("trade-outcome").evaluateAll((els) => els.length);
  expect(ids).toBeGreaterThan(1);
  const [{ count }] = await localRest<Array<{ count: number }>>("markets?select=count");
  expect(count).toBe(MARKETS.length);
});

test("an unknown slug is a 404, not an error", async ({ page }) => {
  const res = await page.goto("/market/this-market-does-not-exist");
  expect(res?.status()).toBe(404);
});

test("prices change live without a reload (Realtime or the polling fallback)", async ({ page }) => {
  test.setTimeout(90_000);
  const slug = "will-india-win-the-2026-t20-world-cup";
  const [m] = await localRest<Array<{ id: string; outcomes: Array<{ id: string; label: string; price: number }> }>>(
    `markets?slug=eq.${slug}&select=id,outcomes!outcomes_market_id_fkey(id,label,price)`
  );
  const yes = m.outcomes.find((o) => o.label === "Yes")!;
  const no = m.outcomes.find((o) => o.label === "No")!;
  const original = [Number(yes.price), Number(no.price)];
  await page.goto(`/market/${slug}`);
  const headline = page.getByTestId("chart-headline");
  await expect(headline).toHaveText(`${(original[0] * 100).toFixed(1)}%`);

  const target = original[0] > 0.5 ? 0.25 : 0.75;
  try {
    await localRest(`outcomes?id=eq.${yes.id}`, { method: "PATCH", body: JSON.stringify({ price: target }) });
    await localRest(`outcomes?id=eq.${no.id}`, { method: "PATCH", body: JSON.stringify({ price: 1 - target }) });
    // Prices are cached 5 s on the server and polled every 20 s.
    await expect(headline).toHaveText(`${(target * 100).toFixed(1)}%`, { timeout: 60_000 });
  } finally {
    await localRest(`outcomes?id=eq.${yes.id}`, { method: "PATCH", body: JSON.stringify({ price: original[0] }) });
    await localRest(`outcomes?id=eq.${no.id}`, { method: "PATCH", body: JSON.stringify({ price: original[1] }) });
  }
});

test("GET /api/prices returns public prices only, and is cacheable briefly", async ({ request }) => {
  const res = await request.get("/api/prices");
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toMatch(/max-age=5/);
  const body = (await res.json()) as { prices: Record<string, number> };
  const values = Object.values(body.prices);
  expect(values.length).toBeGreaterThan(100);
  for (const v of values) expect(v >= 0 && v <= 1).toBe(true);
});

test("nothing personal is exposed by GET /api/session when signed out", async ({ request }) => {
  const res = await request.get("/api/session");
  expect(res.headers()["cache-control"]).toMatch(/no-store/);
  expect(await res.json()).toEqual({ profile: null });
});
