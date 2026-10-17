import { z } from "zod";
import { MAX_TRADE, MIN_TRADE } from "@/lib/trade-limits";

/**
 * Order input as the server accepts it (B4). Pure, so it is unit-tested; the
 * Server Action validates with it before calling place_order(), which checks
 * everything again in the database (limits come from app_settings there).
 */
export const OrderInput = z.object({
  marketId: z.string().uuid(),
  outcomeId: z.string().uuid(),
  amount: z
    .number()
    .finite()
    .min(MIN_TRADE)
    .max(MAX_TRADE)
    .refine((n) => Math.round(n * 100) === n * 100, "whole paise only"),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),
});

/**
 * Sell input (S1). Shares are positive with at most 8 decimals (the
 * database's numeric(24,8)); sell_shares() checks holdings, market state,
 * the minimum proceeds and everything else again.
 */
export const SellInput = z.object({
  marketId: z.string().uuid(),
  outcomeId: z.string().uuid(),
  shares: z
    .number()
    .finite()
    .positive()
    .max(1e12)
    .refine((n) => Math.abs(Math.round(n * 1e8) - n * 1e8) < 1e-3, "at most 8 decimals"),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),
});
