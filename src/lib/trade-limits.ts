/**
 * Phase 5: the single source of truth for order-size limits.
 *
 * Used by the trade UI (input, slider, presets, messages) AND re-checked by
 * the store's placeOrder, so an invalid amount is refused even if the UI is
 * bypassed. Any future server-side trading route must reuse this module
 * (see docs/DECISIONS.md D-009).
 */

/** Smallest order, in rupees. */
export const MIN_TRADE = 1;
/** Largest order, in rupees (₹1,00,000 for the demo). */
export const MAX_TRADE = 100_000;
/** Shared by the number input and the slider so they can never disagree. */
export const TRADE_STEP = 1;
/** Quick-pick amounts shown under the field; all within the limits. */
export const TRADE_PRESETS = [100, 500, 1_000] as const;

export type AmountReason = "notNumber" | "belowMin" | "aboveMax";

export type AmountValidation = { ok: true; value: number } | { ok: false; reason: AmountReason };

/**
 * Accepts only a finite number in [MIN_TRADE, MAX_TRADE]. Strings are parsed
 * strictly: "", whitespace, "abc", "1e", NaN and Infinity are all rejected.
 */
export function validateAmount(input: unknown): AmountValidation {
  let n: number;
  if (typeof input === "number") {
    n = input;
  } else if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed === "") return { ok: false, reason: "notNumber" };
    n = Number(trimmed);
  } else {
    return { ok: false, reason: "notNumber" };
  }

  if (!Number.isFinite(n)) return { ok: false, reason: "notNumber" };
  if (n < MIN_TRADE) return { ok: false, reason: "belowMin" };
  if (n > MAX_TRADE) return { ok: false, reason: "aboveMax" };
  return { ok: true, value: n };
}

/** Keeps the slider inside its range when the typed value is out of bounds. */
export function clampAmount(n: number): number {
  if (!Number.isFinite(n)) return MIN_TRADE;
  return Math.min(MAX_TRADE, Math.max(MIN_TRADE, n));
}

/** ₹ with en-IN grouping, e.g. 100000 -> "₹1,00,000". */
export function formatLimit(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}
