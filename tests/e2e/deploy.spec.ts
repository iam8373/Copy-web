import { test, expect } from "@playwright/test";
import robots from "../../src/app/robots";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { contentSecurityPolicy, supabaseOrigins } = require("../../src/lib/security-headers");

/** Backend B6: Railway readiness — healthcheck, security headers, CSP, robots. */

test("GET /api/health is public, constant and never cached", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
  expect(res.headers()["cache-control"]).toMatch(/no-store/);
});

test("pages send the security headers and a CSP that allows only what we use", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["strict-transport-security"]).toMatch(/max-age=\d+/);
  expect(h["x-powered-by"]).toBeUndefined();
  const csp = h["content-security-policy"];
  expect(csp).toContain("default-src 'self'");
  expect(csp).toMatch(/script-src [^;]*https:\/\/challenges\.cloudflare\.com/);
  expect(csp).toContain("frame-src https://challenges.cloudflare.com");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  // The test build talks to the local Supabase: its origin (http + ws) is allowed.
  expect(csp).toMatch(/connect-src [^;]*http:\/\/127\.0\.0\.1:54321/);
  expect(csp).not.toContain("'unsafe-eval'"); // production build
});

test("personal pages are private and not indexable", async ({ request }) => {
  for (const path of ["/dashboard", "/profit"]) {
    const res = await request.get(path);
    expect(res.headers()["cache-control"], path).toMatch(/private, no-store/);
    expect(res.headers()["x-robots-tag"], path).toMatch(/noindex/);
  }
});

test("the CSP builder allows the hosted Supabase project over https and wss only", () => {
  expect(supabaseOrigins("https://abc.supabase.co")).toEqual(["https://abc.supabase.co", "wss://abc.supabase.co"]);
  expect(supabaseOrigins("not a url")).toEqual([]);
  const csp = contentSecurityPolicy({ supabaseUrl: "https://abc.supabase.co" });
  expect(csp).toContain("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co https://challenges.cloudflare.com");
  expect(contentSecurityPolicy({ dev: true })).toContain("'unsafe-eval'");
});

test("robots keeps /admin out even when indexing is allowed", () => {
  const saved = process.env.ALLOW_INDEXING;
  process.env.ALLOW_INDEXING = "true";
  try {
    const r = robots();
    expect(JSON.stringify(r.rules)).toContain("/admin");
  } finally {
    process.env.ALLOW_INDEXING = saved;
  }
});
