import { test, expect } from "@playwright/test";

/**
 * Phase 1: the mock API was unauthenticated (no session, no 18+ check, no
 * amount validation) and nothing called it, so it was deleted. These routes
 * must stay gone until a properly guarded server route replaces them.
 */
test.describe("removed API surface", () => {
  test("GET /api/markets returns 404", async ({ request }) => {
    const res = await request.get("/api/markets");
    expect(res.status()).toBe(404);
  });

  test("GET /api/markets/<slug> returns 404", async ({ request }) => {
    const res = await request.get("/api/markets/ipl-2026-winner");
    expect(res.status()).toBe(404);
  });

  test("POST /api/trade returns 404", async ({ request }) => {
    const res = await request.post("/api/trade", {
      data: { slug: "ipl-2026-winner", outcomeId: "mumbai-indians", amount: 100 },
    });
    expect(res.status()).toBe(404);
  });
});
