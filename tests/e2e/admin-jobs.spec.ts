import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { LOCAL, TEST_CRON_SECRET } from "../support/local-supabase";
import { localRest } from "./helpers";

/** Admin phase R1: scheduled jobs route and the admin bootstrap script. */
test.describe("scheduled jobs and admin bootstrap", () => {
  test.skip(({ isMobile }) => isMobile, "server-side checks: run once");

  test("POST /api/cron refuses a missing or wrong secret", async ({ request }) => {
    expect((await request.post("/api/cron")).status()).toBe(401);
    const wrong = await request.post("/api/cron", { headers: { Authorization: "Bearer not-the-secret" } });
    expect(wrong.status()).toBe(401);
    expect(wrong.headers()["cache-control"]).toMatch(/no-store/);
    expect((await request.get("/api/cron")).status()).toBe(405);
  });

  test("POST /api/cron with the secret runs the jobs", async ({ request }) => {
    const res = await request.post("/api/cron", { headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.closed).toBe("number");
    expect(typeof body.finalized).toBe("number");
    // After the job no open market is past its end date.
    const stale = await localRest<unknown[]>(`markets?status=eq.open&end_date=lte.${new Date().toISOString()}&select=id`);
    expect(stale).toHaveLength(0);
  });

  const runGrant = (args: string[], url = LOCAL.url) => {
    try {
      const out = execFileSync("npx", ["tsx", "scripts/admin-grant.ts", ...args], {
        env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: LOCAL.secretKey, NODE_ENV: "test" },
        encoding: "utf8",
        stdio: "pipe",
      });
      return { code: 0, out };
    } catch (e) {
      const err = e as { status: number; stderr: string; stdout: string };
      return { code: err.status, out: `${err.stdout}${err.stderr}` };
    }
  };

  test("admin:grant refuses a hosted database without --remote and never prints the key", () => {
    const r = runGrant(["someone@example.com"], "https://example.supabase.co");
    expect(r.code).toBe(1);
    expect(r.out).toContain("--remote");
    expect(r.out).not.toContain(LOCAL.secretKey);
  });

  test("admin:grant explains when the account has never signed in", () => {
    const r = runGrant(["nobody-here@example.com"]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("Sign in once");
  });
});
