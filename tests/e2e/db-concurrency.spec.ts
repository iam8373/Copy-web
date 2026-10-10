import { test, expect } from "@playwright/test";
import { LOCAL } from "../support/local-supabase";
import { localRest, openMarket } from "./helpers";

/**
 * place_order under real concurrency (B4): many users ordering on one market
 * at the same time through PostgREST, and the same idempotency key fired in
 * parallel. Runs against the LOCAL stack only (no browser).
 */

const admin = { apikey: LOCAL.secretKey, authorization: `Bearer ${LOCAL.secretKey}`, "content-type": "application/json" };

async function makeUser(tag: string): Promise<{ id: string; token: string }> {
  const email = `${tag}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = `pw-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const created = await fetch(`${LOCAL.url}/auth/v1/admin/users`, {
    method: "POST",
    headers: admin,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const user = (await created.json()) as { id: string };
  const tok = await fetch(`${LOCAL.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: LOCAL.publishableKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const { access_token } = (await tok.json()) as { access_token: string };
  await rpc(access_token, "confirm_age", { p_terms_version: "draft-2026-10" });
  return { id: user.id, token: access_token };
}

async function rpc(token: string, fn: string, args: Record<string, unknown>) {
  const res = await fetch(`${LOCAL.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: LOCAL.publishableKey, authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

test.describe("place_order under concurrency (local stack)", () => {
  test.skip(({ isMobile }) => isMobile, "database test: run once");

  test("parallel orders from many users on one market stay consistent", async () => {
    test.setTimeout(120_000);
    const market = await openMarket(true, 1);
    const before = new Map(market.outcomes.map((o) => [o.id, Number(o.shares_outstanding)]));
    const users = await Promise.all([0, 1, 2, 3].map((i) => makeUser(`conc${i}`)));

    const results = await Promise.all(
      users.flatMap((u, i) =>
        [0, 1, 2, 3, 4].map((k) =>
          rpc(u.token, "place_order", {
            p_market_id: market.id,
            p_outcome_id: market.outcomes[(i + k) % 2].id,
            p_amount: 100 + k,
            p_idempotency_key: `conc-${u.id}-${k}`,
          })
        )
      )
    );
    expect(results.map((r) => r.status)).toEqual(Array(20).fill(200));

    const ids = users.map((u) => u.id).join(",");
    const orders = await localRest<Array<{ outcome_id: string; shares: number; amount: number; user_id: string }>>(
      `orders?user_id=in.(${ids})&select=outcome_id,shares,amount,user_id`
    );
    expect(orders).toHaveLength(20);

    // Outstanding shares grew by exactly the shares sold: no lost update.
    const [after] = await localRest<Array<{ outcomes: Array<{ id: string; shares_outstanding: number; price: number }> }>>(
      `markets?id=eq.${market.id}&select=outcomes!outcomes_market_id_fkey(id,shares_outstanding,price)`
    );
    for (const o of after.outcomes) {
      const sold = orders.filter((x) => x.outcome_id === o.id).reduce((s, x) => s + Number(x.shares), 0);
      expect(Number(o.shares_outstanding)).toBeCloseTo(before.get(o.id)! + sold, 6);
    }
    expect(after.outcomes.reduce((s, o) => s + Number(o.price), 0)).toBeCloseTo(1, 9);

    // Each wallet = 10,000 − spent, and equals its ledger.
    for (const u of users) {
      const spent = orders.filter((o) => o.user_id === u.id).reduce((s, o) => s + Number(o.amount), 0);
      const [w] = await localRest<Array<{ balance: number }>>(`wallets?user_id=eq.${u.id}&select=balance`);
      const ledger = await localRest<Array<{ amount: number }>>(`ledger_entries?user_id=eq.${u.id}&select=amount`);
      expect(Number(w.balance)).toBeCloseTo(10000 - spent, 2);
      expect(ledger.reduce((s, l) => s + Number(l.amount), 0)).toBeCloseTo(Number(w.balance), 2);
    }
  });

  test("the same idempotency key fired in parallel spends exactly once", async () => {
    const market = await openMarket(true, 2);
    const u = await makeUser("idem");
    const args = { p_market_id: market.id, p_outcome_id: market.outcomes[0].id, p_amount: 250, p_idempotency_key: `idem-${u.id}` };
    const results = await Promise.all(Array.from({ length: 6 }, () => rpc(u.token, "place_order", args)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    const fills = new Set(results.map((r) => (r.body as { order_id: string }).order_id));
    expect(fills.size).toBe(1);
    const orders = await localRest<unknown[]>(`orders?user_id=eq.${u.id}&select=id`);
    expect(orders).toHaveLength(1);
    const [w] = await localRest<Array<{ balance: number }>>(`wallets?user_id=eq.${u.id}&select=balance`);
    expect(Number(w.balance)).toBe(10000 - 250);
  });

  test("a user who spends more than their balance in parallel never goes negative", async () => {
    const market = await openMarket(false);
    const u = await makeUser("broke");
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, k) =>
        rpc(u.token, "place_order", {
          p_market_id: market.id,
          p_outcome_id: market.outcomes[0].id,
          p_amount: 3000,
          p_idempotency_key: `broke-${u.id}-${k}`,
        })
      )
    );
    const ok = results.filter((r) => r.status === 200).length;
    expect(ok).toBe(3); // 3 × 3,000 = 9,000 of 10,000
    expect(results.filter((r) => r.status !== 200).every((r) => JSON.stringify(r.body).includes("BP_INSUFFICIENT_FUNDS"))).toBe(true);
    const [w] = await localRest<Array<{ balance: number }>>(`wallets?user_id=eq.${u.id}&select=balance`);
    expect(Number(w.balance)).toBe(1000);
  });
});
