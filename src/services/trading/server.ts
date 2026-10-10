import "server-only";
import { revalidateTag } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { MARKETS_TAG, PRICES_TAG, historyTag } from "@/services/markets/read";

/**
 * Trading service (B4). The only write path is the place_order() Postgres
 * function, called as the signed-in user (RLS + auth.uid() inside). Nothing
 * here computes prices or balances; it only maps results and errors.
 */

export type OrderReason =
  | "not_signed_in"
  | "suspended"
  | "age_not_confirmed"
  | "trading_disabled"
  | "market_closed"
  | "invalid_amount"
  | "insufficient_funds"
  | "rate_limited"
  | "daily_limit"
  | "conflict"
  | "failed";

export interface Fill {
  orderId: string;
  marketId: string;
  outcomeId: string;
  amount: number;
  shares: number;
  avgPrice: number;
  /** outcome id → new price after the order */
  prices: Record<string, number>;
  balance: number;
  replayed: boolean;
}

export type OrderResult = { ok: true; fill: Fill } | { ok: false; reason: OrderReason };

const REASONS: Record<string, OrderReason> = {
  BP_NOT_SIGNED_IN: "not_signed_in",
  BP_ACCOUNT_SUSPENDED: "suspended",
  BP_AGE_NOT_CONFIRMED: "age_not_confirmed",
  BP_TRADING_DISABLED: "trading_disabled",
  BP_MARKET_CLOSED: "market_closed",
  BP_INVALID_AMOUNT: "invalid_amount",
  BP_BAD_REQUEST: "invalid_amount",
  BP_INSUFFICIENT_FUNDS: "insufficient_funds",
  BP_RATE_LIMITED: "rate_limited",
  BP_DAILY_LIMIT: "daily_limit",
  BP_IDEMPOTENCY_CONFLICT: "conflict",
};

export async function placeOrder(
  marketId: string,
  outcomeId: string,
  amount: number,
  idempotencyKey: string
): Promise<OrderResult> {
  if (!supabaseConfigured) return { ok: false, reason: "failed" };
  const supabase = getServerSupabase({ readOnly: true });
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, reason: "not_signed_in" };

  const { data, error } = await supabase.rpc("place_order", {
    p_market_id: marketId,
    p_outcome_id: outcomeId,
    p_amount: amount,
    p_idempotency_key: idempotencyKey,
  });
  if (error) {
    const code = /BP_[A-Z_]+/.exec(error.message ?? "")?.[0];
    return { ok: false, reason: (code && REASONS[code]) || "failed" };
  }

  const r = data as unknown as {
    order_id: string; market_id: string; outcome_id: string; amount: number; shares: number;
    avg_price: number; prices: Record<string, number>; balance: number; replayed: boolean;
  };
  // New prices and volume: refresh the cached reads for everyone.
  revalidateTag(PRICES_TAG);
  revalidateTag(MARKETS_TAG);
  revalidateTag(historyTag(r.market_id));
  return {
    ok: true,
    fill: {
      orderId: r.order_id,
      marketId: r.market_id,
      outcomeId: r.outcome_id,
      amount: Number(r.amount),
      shares: Number(r.shares),
      avgPrice: Number(r.avg_price),
      prices: Object.fromEntries(Object.entries(r.prices ?? {}).map(([k, v]) => [k, Number(v)])),
      balance: Number(r.balance),
      replayed: Boolean(r.replayed),
    },
  };
}
