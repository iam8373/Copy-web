import { test, expect } from "@playwright/test";
import robots from "../../src/app/robots";
import sitemap from "../../src/app/sitemap";

/**
 * Phase 3. The served build uses the default environment (ALLOW_INDEXING not
 * "true"), so the HTTP tests check the locked-down state. The "allowed" branch
 * is exercised by calling the route handlers directly with the env flipped,
 * which avoids a second production build.
 */
test.describe("default build: crawling is blocked", () => {
  test("robots.txt disallows everything and advertises no sitemap", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/User-Agent:\s*\*/i);
    expect(body).toMatch(/^Disallow:\s*\/\s*$/m);
    expect(body).not.toMatch(/^Allow:/m);
    expect(body).not.toMatch(/Sitemap:/i);
  });

  test("home page carries a noindex, nofollow robots meta tag", async ({ page }) => {
    await page.goto("/");
    const content = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(content).toMatch(/noindex/);
    expect(content).toMatch(/nofollow/);
  });

  test("market and legal pages inherit noindex", async ({ page }) => {
    for (const path of ["/market/ipl-2026-winner", "/terms", "/markets/live"]) {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    }
  });

  test("sitemap.xml lists no URLs", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    expect(await res.text()).not.toContain("<loc>");
  });
});

test.describe("route handlers with ALLOW_INDEXING", () => {
  const saved = { ...process.env };
  test.afterEach(() => {
    process.env.ALLOW_INDEXING = saved.ALLOW_INDEXING;
    process.env.NEXT_PUBLIC_SITE_URL = saved.NEXT_PUBLIC_SITE_URL;
  });

  test("anything other than exactly 'true' stays blocked", () => {
    for (const value of [undefined, "", "false", "TRUE", "1", "yes", " true"]) {
      if (value === undefined) delete process.env.ALLOW_INDEXING;
      else process.env.ALLOW_INDEXING = value;
      expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
      expect(sitemap()).toEqual([]);
    }
  });

  test("'true' allows crawling but keeps per-user pages out", () => {
    process.env.ALLOW_INDEXING = "true";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.in/";
    const r = robots();
    expect(r.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/profit"],
    });
    expect(r.sitemap).toBe("https://example.in/sitemap.xml");

    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain("https://example.in/");
    expect(urls).toContain("https://example.in/markets/cricket");
    expect(urls).toContain("https://example.in/market/ipl-2026-winner");
    expect(urls).toContain("https://example.in/terms");
    expect(urls.some((u) => /\/(dashboard|profit)$/.test(u))).toBe(false);
  });
});
