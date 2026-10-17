import { test, expect } from "@playwright/test";
import { DICTIONARIES, LOCALE_COOKIE } from "../../src/i18n";
import { openAuthModal, resetState } from "./helpers";

/** Phase S4: wordmark, icons, manifest, social image, localized metadata, leftovers. */

test.describe("branding", () => {
  test("the wordmark names the site in the header (also at 360 px), footer and sign-in sheet", async ({ page }) => {
    await resetState(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/");
    const home = page.getByRole("banner").getByRole("link", { name: "BharatPredict" });
    await expect(home).toBeVisible();
    await expect(home.getByTestId("wordmark").locator("svg")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("contentinfo").getByTestId("wordmark")).toContainText("BharatPredict");
    await openAuthModal(page);
    await expect(page.getByTestId("auth-modal").getByTestId("wordmark")).toBeVisible();
  });

  test("the 404 page is branded and in the saved language", async ({ page, context }) => {
    await context.addCookies([{ name: LOCALE_COOKIE, value: "hi", domain: "localhost", path: "/" }]);
    const res = await page.goto("/no-such-page-anywhere");
    expect(res?.status()).toBe(404);
    await expect(page.getByTestId("wordmark").first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(DICTIONARIES.hi.errors.notFoundTitle);
  });
});

test.describe("icons, manifest and social image", () => {
  test.skip(({ isMobile }) => isMobile, "HTTP checks: once");

  test("favicon (SVG + PNG), apple touch icon, manifest and Open Graph image are served", async ({ request }) => {
    const svg = await request.get("/icon.svg");
    expect(svg.status()).toBe(200);
    expect(svg.headers()["content-type"]).toContain("image/svg+xml");
    for (const s of [32, 192, 512]) {
      const png = await request.get(`/icon1/${s}`);
      expect(png.status(), `icon ${s}`).toBe(200);
      expect(png.headers()["content-type"]).toContain("image/png");
    }
    const apple = await request.get("/apple-icon");
    expect(apple.headers()["content-type"]).toContain("image/png");
    const og = await request.get("/opengraph-image");
    expect(og.status()).toBe(200);
    expect(og.headers()["content-type"]).toContain("image/png");
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.name).toBe("BharatPredict");
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(["any", "192x192", "512x512"]);
    for (const i of manifest.icons as Array<{ src: string }>) expect((await request.get(i.src)).status()).toBe(200);
  });

  test("every page links them, with a title and description in the saved language", async ({ request }) => {
    const html = await (await request.get("/", { headers: { cookie: `${LOCALE_COOKIE}=ta` } })).text();
    expect(html).toMatch(/<link rel="icon" href="\/icon\.svg/);
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/apple-icon/);
    expect(html).toMatch(/<link rel="manifest" href="\/manifest\.webmanifest/);
    expect(html).toMatch(/<meta property="og:image" content="[^"]*\/opengraph-image/);
    expect(html).toContain(`<title>${DICTIONARIES.ta.brand.metaTitle}</title>`);
    expect(html).toContain(DICTIONARIES.ta.brand.metaDescription);
  });

  test("no leftover names or placeholder copy in the main pages", async ({ request }) => {
    for (const route of ["/", "/learn", "/terms", "/privacy", "/responsible-play"]) {
      const html = await (await request.get(route)).text();
      for (const leftover of ["Predictions 101", "Learn Hub", "demo session", "simulated", "Deposits and payouts", "Join the mailing list", "rupee settlement", "Any 6 digits"]) {
        expect(html, `${route}: ${leftover}`).not.toContain(leftover);
      }
    }
    const learn = await (await request.get("/learn", { headers: { cookie: `${LOCALE_COOKIE}=bn` } })).text();
    expect(learn).toContain(DICTIONARIES.bn.footer.learn);
  });
});
