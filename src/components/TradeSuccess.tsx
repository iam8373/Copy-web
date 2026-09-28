"use client";

import { useEffect, useMemo, useState } from "react";
import { useMarketStore } from "@/store/useMarketStore";
import { formatPercent } from "@/lib/utils";

const VISIBLE_MS = 1160;

/**
 * Phase A: brief order-confirmation animation.
 *
 * Driven by `lastFill` in the store rather than by the trade modal, so it
 * survives the modal closing (placeOrder sets `trade: null` immediately).
 * Rendered as a small, centered, pointer-events-none overlay so it never
 * covers or shifts the odds numbers on the cards behind it.
 */
export function TradeSuccess() {
  const lastFill = useMarketStore((s) => s.lastFill);
  const clearFill = useMarketStore((s) => s.clearFill);
  const markets = useMarketStore((s) => s.markets);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Auto-dismiss. Keyed on `at` so a rapid second fill restarts the timer
  // instead of stacking a second overlay.
  useEffect(() => {
    if (!lastFill) return;
    const id = setTimeout(clearFill, VISIBLE_MS);
    return () => clearTimeout(id);
  }, [lastFill, clearFill]);

  const title = useMemo(() => {
    if (!lastFill) return "";
    return markets.find((m) => m.id === lastFill.marketId)?.title ?? "";
  }, [lastFill, markets]);

  if (!lastFill) return null;

  const label = `Order confirmed: ${lastFill.shares.toFixed(1)} ${
    lastFill.outcomeLabel
  } shares at ${formatPercent(lastFill.price, 1)}`;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[58] grid place-items-center"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        key={lastFill.at}
        className={
          reducedMotion
            ? "flex flex-col items-center gap-2 rounded-xl border border-accent-green/40 bg-bg-secondary/95 px-5 py-4 shadow-2xl"
            : "flex flex-col items-center gap-2 rounded-xl border border-accent-green/40 bg-bg-secondary/95 px-5 py-4 shadow-2xl animate-fill-pop motion-reduce:animate-none"
        }
      >
        <span
          className={
            reducedMotion
              ? "grid h-12 w-12 place-items-center rounded-full bg-accent-green/15"
              : "grid h-12 w-12 place-items-center rounded-full bg-accent-green/15 animate-fill-out motion-reduce:animate-none"
          }
        >
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7"
            fill="none"
            stroke="#16C784"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path
              d="M4 12.5 L9.5 18 L20 6.5"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={reducedMotion ? 0 : 1}
              className={reducedMotion ? "" : "animate-check-draw motion-reduce:animate-none"}
            />
          </svg>
        </span>

        <p className="text-[13px] font-bold text-content-primary">Order confirmed</p>
        <p className="tnum max-w-[220px] truncate text-center text-[12px] text-content-secondary">
          {lastFill.shares.toFixed(1)} {lastFill.outcomeLabel} @{" "}
          {formatPercent(lastFill.price, 1)}
        </p>
      </div>

      {/* Screen-reader text carries the market name, which is truncated visually. */}
      <span className="sr-only">
        {label}
        {title ? ` on ${title}` : ""}
      </span>
    </div>
  );
}
