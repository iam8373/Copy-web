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
