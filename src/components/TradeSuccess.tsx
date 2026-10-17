"use client";

import { useEffect, useMemo, useState } from "react";
import { useMarketStore } from "@/store/useMarketStore";
import { formatPercent, formatRupees } from "@/lib/utils";
import { useT } from "@/i18n/LanguageProvider";
import { getMarketText, useOutcomeLabel } from "@/lib/market-text";
import { color } from "@/lib/tokens";

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
  const { t, locale } = useT();
  const ol = useOutcomeLabel();

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

  // Market title and outcome label in the active language.
  const { title, outcome } = useMemo(() => {
    const m = lastFill ? markets.find((x) => x.id === lastFill.marketId) : undefined;
    const o = m?.outcomes.find((x) => x.id === lastFill?.outcomeId);
    return { title: m ? getMarketText(m, locale).title : "", outcome: o ? ol(o) : "" };
  }, [lastFill, markets, locale, ol]);

  if (!lastFill) return null;

  const sold = lastFill.side === "sell";
  const shares = lastFill.shares.toFixed(sold ? 2 : 1);
  const summary = sold
    ? t("trade", "srSold", { shares, outcome, amount: formatRupees(lastFill.proceeds ?? 0) })
    : t("trade", "srBought", { shares, outcome, price: formatPercent(lastFill.price, 1) });

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
            ? "flex flex-col items-center gap-2 rounded-card border border-success/40 bg-surface-2/95 px-5 py-4 shadow-dialog"
            : "flex flex-col items-center gap-2 rounded-card border border-success/40 bg-surface-2/95 px-5 py-4 shadow-dialog animate-fill-pop motion-reduce:animate-none"
        }
      >
        <span
          className={
            reducedMotion
              ? "grid h-12 w-12 place-items-center rounded-full bg-success/15"
              : "grid h-12 w-12 place-items-center rounded-full bg-success/15 animate-fill-out motion-reduce:animate-none"
          }
        >
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7"
            fill="none"
            stroke={color.success}
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

        <p className="text-13 font-bold text-primary">
          {t("trade", sold ? "saleConfirmed" : "orderConfirmed")}
        </p>
        <p className="tnum max-w-56 truncate text-center text-12 text-secondary">
          {sold
            ? `${shares} ${outcome} → ${formatRupees(lastFill.proceeds ?? 0)}`
            : `${shares} ${outcome} @ ${formatPercent(lastFill.price, 1)}`}
        </p>
      </div>

      {/* Screen-reader text carries the market name, which is truncated visually. */}
      <span className="sr-only">{title ? t("trade", "srOnMarket", { summary, title }) : summary}</span>
    </div>
  );
}
