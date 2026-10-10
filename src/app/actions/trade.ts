"use server";

import * as trading from "@/services/trading/server";
import { OrderInput } from "@/lib/order-schema";

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
