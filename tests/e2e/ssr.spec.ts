import { test, expect, type Browser } from "@playwright/test";
import { DICTIONARIES, LOCALE_COOKIE } from "../../src/i18n";
import { localRest, openMarket, resetState, signInWithEmail, uniqueEmail } from "./helpers";

/**
 * Phase S2: market lists in the first HTML, language from a cookie, no state
 * shared between requests, no hydration or console errors, no layout shift
 * when prices update.
 */

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

async function signedInCookie(browser: Browser, email: string, lang: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await resetState(page);
  await signInWithEmail(page, email);
  const cookies = await ctx.cookies();
  await ctx.close();
  return [...cookies.filter((c) => c.name !== LOCALE_COOKIE).map((c) => `${c.name}=${c.value}`), `${LOCALE_COOKIE}=${lang}`].join("; ");
}

test.describe("server-rendered first HTML", () => {
  test.skip(({ isMobile }) => isMobile, "HTML checks: once is enough");

  test("the home and category HTML already contain market titles", async ({ request }) => {
    const top = await localRest<Array<{ title: string; category: string }>>(
      "markets?status=eq.open&is_live=eq.false&select=title,category&order=total_volume.desc&limit=3"
    );
    const home = decode(await (await request.get("/")).text());
    for (const m of top) expect(home).toContain(m.title);
    const cat = decode(await (await request.get(`/markets/${top[0].category}`)).text());
    expect(cat).toContain(top[0].title);
    expect(home).toContain('data-testid="markets-status" data-status="ready"');
  });

  test("the saved language is in the first HTML (cookie), English otherwise", async ({ request }) => {
    const en = await (await request.get("/", { headers: { cookie: "" } })).text();
    expect(en).toMatch(/<html lang="en"/);
    const hi = await (await request.get("/", { headers: { cookie: `${LOCALE_COOKIE}=hi` } })).text();
    expect(hi).toMatch(/<html lang="hi" data-script="devanagari"/);
    expect(hi).toContain(DICTIONARIES.hi.nav.cricket);
    const bad = await (await request.get("/", { headers: { cookie: `${LOCALE_COOKIE}=xx` } })).text();
    expect(bad).toMatch(/<html lang="en"/);
  });

  test("concurrent requests with different users and languages never bleed into each other", async ({ browser, request }) => {
    test.setTimeout(120_000);
    const a = uniqueEmail("bleeda");
    const b = uniqueEmail("bleedb");
    const [ca, cb] = await Promise.all([signedInCookie(browser, a, "hi"), signedInCookie(browser, b, "ta")]);
    const routes = ["/", "/dashboard", "/markets/cricket", `/market/${(await openMarket(true, 0)).slug}`];
    const jobs = Array.from({ length: 24 }, (_, i) => ({ who: i % 2 === 0 ? "a" : "b", route: routes[i % routes.length] }));
    const pages = await Promise.all(
      jobs.map(async (j) => ({ ...j, html: await (await request.get(j.route, { headers: { cookie: j.who === "a" ? ca : cb } })).text() }))
    );
    for (const p of pages) {
      const mine = p.who === "a" ? "hi" : "ta";
      const other = p.who === "a" ? "ta" : "hi";
      expect(p.html, `${p.who} ${p.route}`).toMatch(new RegExp(`<html lang="${mine}"`));
      expect(p.html).toContain(DICTIONARIES[mine].nav.politics);
      expect(p.html).not.toContain(DICTIONARIES[other].nav.politics);
      // Per-user data is never server-rendered: neither account appears in any HTML.
      expect(p.html).not.toContain(a);
      expect(p.html).not.toContain(b);
    }
  });

  test("no hydration warnings or console errors in either language", async ({ page, context }) => {
    const problems: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" || /hydrat|did not match/i.test(m.text())) problems.push(`${m.type()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    const market = await openMarket(true, 0);
    for (const lang of ["en", "hi"]) {
      await context.addCookies([{ name: LOCALE_COOKIE, value: lang, domain: "localhost", path: "/" }]);
      await page.goto("/");
      await page.evaluate((l) => window.localStorage.setItem("bp-lang", l), lang);
      for (const route of ["/", "/markets/cricket", `/market/${market.slug}`, "/dashboard", "/learn"]) {
        await page.goto(route);
        await page.waitForLoadState("networkidle");
      }
    }
    expect(problems).toEqual([]);
  });

  test("a live price update does not shift the layout", async ({ page }) => {
    test.setTimeout(60_000);
    const market = await openMarket(true, 0);
    await resetState(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
          if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
        }
      }).observe({ type: "layout-shift", buffered: false });
    });
    const [yes] = market.outcomes;
    const original = Number(yes.price);
    try {
      await localRest(`outcomes?id=eq.${yes.id}`, { method: "PATCH", body: JSON.stringify({ price: Math.min(0.97, original + 0.07) }) });
      // /api/prices is cached for 5 s; then the poll (also run whenever the tab
      // becomes visible) brings the new price in.
      await page.waitForTimeout(6000);
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await page.waitForTimeout(2500);
      expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.01);
    } finally {
      await localRest(`outcomes?id=eq.${yes.id}`, { method: "PATCH", body: JSON.stringify({ price: original }) });
    }
  });
});
