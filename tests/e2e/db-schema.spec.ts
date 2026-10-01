import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIES } from "../../src/lib/types";
import { MARKETS } from "../../src/data/markets";
import translations from "../../src/data/market-translations.json";
import { cost, costToBuy, prices, quantitiesForPrices, sharesForAmount } from "../../src/lib/lmsr";
import { buildSeedRows } from "../../scripts/seed-rows";
import type { TranslationFile } from "../../src/services/translation/types";

/**
 * Backend Phase 1 checks that need no database: they guard the migration and
 * seed logic. Database behaviour itself is covered by pgTAP in supabase/tests.
 */
const migrations = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join("supabase/migrations", f), "utf8"))
  .join("\n");

test.describe("schema guards", () => {
  test("markets.category CHECK matches CATEGORIES exactly (slugs never drift)", () => {
    const m = migrations.match(/category\s+text not null check \(category in \(([^)]*)\)\)/);
    expect(m, "category check not found in migrations").toBeTruthy();
    const dbSlugs = Array.from(m![1].matchAll(/'([^']+)'/g), (x) => x[1]).sort();
    const appSlugs = CATEGORIES.map((c) => c.slug).filter((s) => s !== "live").sort();
    expect(dbSlugs).toEqual(appSlugs);
  });

  test("every table created in migrations enables RLS", () => {
    const created = Array.from(migrations.matchAll(/create table public\.(\w+)/g), (x) => x[1]);
    const rls = new Set(
      Array.from(migrations.matchAll(/alter table public\.(\w+)\s+enable row level security/g), (x) => x[1])
    );
    expect(created.length).toBeGreaterThan(0);
    for (const t of created) expect(rls.has(t), `${t} has no RLS`).toBe(true);
  });

  test("no migration grants write privileges to anon or authenticated", () => {
    expect(migrations).not.toMatch(/grant\s+(all|insert|update|delete)[^;]*to\s+[^;]*(anon|authenticated)/i);
  });

  test("no migration defines a write policy", () => {
    expect(migrations).not.toMatch(/create policy[^;]*for\s+(insert|update|delete|all)/i);
  });
});

test.describe("LMSR reference math", () => {
  test("prices always sum to 1", () => {
    for (const q of [[0, 0], [10, -5, 3], [500, 0, 0, 0], [0, 0, 0, 0, 0, 0]]) {
      const p = prices(q, 1000);
      expect(Math.abs(p.reduce((s, x) => s + x, 0) - 1)).toBeLessThan(1e-12);
    }
  });

  test("quantitiesForPrices reproduces (normalised) prices", () => {
    const { q, normalized } = quantitiesForPrices([0.88, 0.498, 0.21], 1000);
    prices(q, 1000).forEach((p, i) => expect(p).toBeCloseTo(normalized[i], 12));
    expect(Math.min(...q)).toBe(0);
  });

  test("sharesForAmount inverts costToBuy, and buying raises that outcome's price", () => {
    const b = 1000;
    const q = quantitiesForPrices([0.6, 0.4], b).q;
    for (const amount of [1, 100, 5000, 20000]) {
      const s = sharesForAmount(q, b, 0, amount);
      expect(costToBuy(q, b, 0, s)).toBeCloseTo(amount, 5);
      const after = prices([q[0] + s, q[1]], b);
      expect(after[0]).toBeGreaterThan(prices(q, b)[0]);
      expect(after[0]).toBeLessThan(1);
    }
  });

  test("very large orders stay finite (no exp overflow)", () => {
    const b = 1000;
    for (const amount of [1e5, 1e6, 1e9]) {
      const s = sharesForAmount([0, 0], b, 0, amount);
      expect(Number.isFinite(s)).toBe(true);
      // You can never get more than (amount + max MM loss) winning shares.
      expect(s).toBeLessThanOrEqual(amount + b * Math.log(2) + 1e-6);
      expect(prices([s, 0], b)[0]).toBeLessThanOrEqual(1);
    }
  });

  test("the market maker's worst-case loss is bounded by b·ln(n)", () => {
    const b = 1000;
    const q0 = [0, 0, 0];
    // Someone buys a huge amount of outcome 0, which then wins.
    for (const amount of [1e3, 1e5, 1e6]) {
      const s = sharesForAmount(q0, b, 0, amount);
      const paidOut = s; // each winning share pays 1
      expect(paidOut - amount).toBeLessThanOrEqual(b * Math.log(3) + 1e-6);
    }
  });
});

test.describe("seed rows", () => {
  const now = new Date();
  const rows = buildSeedRows(MARKETS, translations as TranslationFile, { liquidityB: 1000, now });

  test("one market row per catalogue market, slugs unique", () => {
    expect(rows.marketRows).toHaveLength(MARKETS.length);
    expect(new Set(rows.marketRows.map((r) => r.slug)).size).toBe(MARKETS.length);
  });

  test("outcome prices per market sum to 1 and are consistent with LMSR", () => {
    const byMarket: Record<string, typeof rows.outcomeRows> = {};
    for (const o of rows.outcomeRows) (byMarket[o.legacy_market_id] ??= []).push(o);
    for (const [id, os] of Object.entries(byMarket)) {
      const sum = os.reduce((s, o) => s + o.price, 0);
      expect(Math.abs(sum - 1), id).toBeLessThan(1e-8);
      const p = prices(os.map((o) => o.shares_outstanding), 1000);
      p.forEach((x, i) => expect(x).toBeCloseTo(os[i].price, 7));
    }
  });

  test("past end dates seed as closed; Live flags are preserved", () => {
    for (const r of rows.marketRows) {
      expect(r.status).toBe(new Date(r.end_date) > now ? "open" : "closed");
    }
    expect(rows.marketRows.filter((r) => r.is_live).length).toBe(MARKETS.filter((m) => m.isLive).length);
  });

  test("exactly the top-5-by-volume markets are featured", () => {
    expect(rows.marketRows.filter((r) => r.is_featured)).toHaveLength(5);
  });

  test("committed translations become five rows per translated market", () => {
    expect(rows.translationRows).toHaveLength(Object.keys(translations).length * 5);
  });
});
