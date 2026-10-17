"use server";

import * as trading from "@/services/trading/server";
import { OrderInput, SellInput } from "@/lib/order-schema";

/**
 * Order Server Action (B4): validate with zod, then place_order() decides.
 * The database re-checks everything (limits from app_settings, balance,
 * market state, account state); this is only the first gate.
 */
export async function submitOrder(input: unknown): Promise<trading.OrderResult> {
  const p = OrderInput.safeParse(input);
  if (!p.success) return { ok: false, reason: "invalid_amount" };
  return trading.placeOrder(p.data.marketId, p.data.outcomeId, p.data.amount, p.data.idempotencyKey);
}

/** Sell Server Action (S1): zod first, then sell_shares() decides. */
export async function submitSell(input: unknown): Promise<trading.SaleResult> {
  const p = SellInput.safeParse(input);
  if (!p.success) return { ok: false, reason: "invalid_amount" };
  return trading.sellShares(p.data.marketId, p.data.outcomeId, p.data.shares, p.data.idempotencyKey);
}
