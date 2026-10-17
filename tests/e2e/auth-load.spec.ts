import { test, expect, type BrowserContext } from "@playwright/test";
import { createHash } from "node:crypto";
import { clientIpFrom } from "../../src/lib/client-ip";
import { LOCAL } from "../support/local-supabase";
import { resetState, signInWithEmail, uniqueEmail } from "./helpers";

/** Phase S3: trusted client IP; no Auth-server call per request. */

const hdrs = (h: Record<string, string>) => new Headers(h);
const ipKey = (h: Headers) => createHash("sha256").update(`ip:${clientIpFrom(h, undefined).toLowerCase()}`).digest("hex");

test.describe("client IP for rate limits", () => {
  test.skip(({ isMobile }) => isMobile, "node-level: once");

  test("spoofed X-Forwarded-For never changes the rate-limit key", () => {
    const base = ipKey(hdrs({ "x-real-ip": "203.0.113.7" }));
    for (const xff of ["1.2.3.4", "1.2.3.4, 203.0.113.7", "evil", "203.0.113.8", ""]) {
      expect(ipKey(hdrs({ "x-real-ip": "203.0.113.7", "x-forwarded-for": xff }))).toBe(base);
    }
    expect(clientIpFrom(hdrs({ "x-forwarded-for": "1.2.3.4" }), undefined)).toBe("unknown");
  });

  test("only a single, well-formed address in the trusted header counts", () => {
    expect(clientIpFrom(hdrs({ "x-real-ip": "203.0.113.7" }), undefined)).toBe("203.0.113.7");
    expect(clientIpFrom(hdrs({ "x-real-ip": "2001:db8::1" }), undefined)).toBe("2001:db8::1");
    expect(clientIpFrom(hdrs({ "x-real-ip": "1.2.3.4, 5.6.7.8" }), undefined)).toBe("unknown");
    expect(clientIpFrom(hdrs({ "x-real-ip": "not-an-ip" }), undefined)).toBe("unknown");
    expect(clientIpFrom(hdrs({ "x-real-ip": "999.1.1.1" }), undefined)).toBe("unknown");
    // Override for a proxy in front of Railway; X-Forwarded-For can never be chosen.
    expect(clientIpFrom(hdrs({ "cf-connecting-ip": "198.51.100.2", "x-real-ip": "10.0.0.1" }), "cf-connecting-ip")).toBe("198.51.100.2");
    expect(clientIpFrom(hdrs({ "x-forwarded-for": "198.51.100.2" }), "x-forwarded-for")).toBe("unknown");
    expect(clientIpFrom(hdrs({ "x-real-ip": "203.0.113.7" }), "none")).toBe("unknown");
  });
});

/** The auth cookie(s) of a context as one Cookie header, optionally with an expired session. */
async function authCookie(ctx: BrowserContext, expire = false): Promise<string> {
  const all = (await ctx.cookies()).filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name));
  if (!expire) return all.map((c) => `${c.name}=${c.value}`).join("; ");
  const name = all[0].name.replace(/\.\d+$/, "");
  const raw = all.sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true })).map((c) => c.value).join("");
  const session = JSON.parse(Buffer.from(raw.replace(/^base64-/, ""), "base64url").toString("utf8"));
  session.expires_at = Math.floor(Date.now() / 1000) - 60;
  return `${name}=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
}

test.describe("middleware and the Auth server", () => {
  test.skip(({ isMobile }) => isMobile, "node-level: once");

  test("valid session: no Auth call; expired session: exactly one refresh", async ({ browser }) => {
    test.setTimeout(90_000);
    process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL.url;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = LOCAL.publishableKey;
    // require (not import()) so Playwright's loader maps the "@/…" paths; the
    // env above must be set before src/lib/supabase/config.ts is first loaded.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { middleware } = require("../../src/middleware") as typeof import("../../src/middleware");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NextRequest } = require("next/server") as typeof import("next/server");

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await resetState(page);
    await signInWithEmail(page, uniqueEmail("mwload"));

    const calls: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/auth/v1/")) calls.push(url);
      return realFetch(input, init);
    }) as typeof fetch;
    try {
      const run = async (cookie: string, path = "/markets/cricket") => {
        calls.length = 0;
        const res = await middleware(new NextRequest(`http://localhost${path}`, { headers: { cookie } }));
        return { res, calls: [...calls] };
      };
      const signedOut = await run("");
      expect(signedOut.calls).toEqual([]);

      const valid = await run(await authCookie(ctx));
      expect(valid.calls).toEqual([]);
      const admin = await run(await authCookie(ctx), "/admin");
      expect(admin.calls).toEqual([]);
      expect(admin.res.status).toBe(200); // signed in: passes to the page (which checks the role)

      const expired = await run(await authCookie(ctx, true));
      expect(expired.calls).toHaveLength(1);
      expect(expired.calls[0]).toContain("grant_type=refresh_token");
      expect(expired.res.headers.get("set-cookie") ?? "").toMatch(/sb-.*-auth-token/);
    } finally {
      globalThis.fetch = realFetch;
      await ctx.close();
    }
  });
});
