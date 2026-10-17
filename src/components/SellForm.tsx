"use client";

import { useMemo } from "react";
import type { Market } from "@/lib/types";
import { useMarketStore } from "@/store/useMarketStore";
import { useT } from "@/i18n/LanguageProvider";
import { useOutcomeLabel } from "@/lib/market-text";
import { AnimatedNumber, Button, FOCUS_RING } from "@/components/ui";
import { cn, formatPercent, formatRupees } from "@/lib/utils";
import { estimateSale } from "@/services/markets/market-data";

export interface SellFormProps {
  market: Market;
  outcomeId: string;
  onOutcomeChange: (id: string) => void;
  /** Raw text of the shares field. */
  shares: string;
  onSharesChange: (raw: string) => void;
  sharesId: string;
  tradable: boolean;
}

const CHIPS = [25, 50, 75, 100] as const;

/** Shares with at most 8 decimals (the database precision), or NaN. */
function parseShares(raw: string): number {
  const v = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,8})?$/.test(v)) return NaN;
  return Number(v);
}

/**
 * Shares as text with at most 8 decimals. Whole positions use the exact
 * stored value (rounded, so float error can never leave 0.00000001 behind);
 * fractions round DOWN so a percentage never exceeds what is held.
 */
const fmtShares = (n: number, mode: "exact" | "floor" = "exact") => {
  const v = mode === "exact" ? Math.round(n * 1e8) / 1e8 : Math.floor(Math.round(n * 1e9) / 10) / 1e8;
  return v.toFixed(8).replace(/\.?0+$/, "");
};

/**
 * Sell form (S1): only outcomes the user holds in this market. The estimate
 * uses the same LMSR model as sell_shares(); the server's fill is what counts
 * and it re-checks holdings, market state and the 1-credit minimum.
 */
export function SellForm({ market, outcomeId, onOutcomeChange, shares, onSharesChange, sharesId, tradable }: SellFormProps) {
  const positions = useMarketStore((s) => s.positions);
  const sell = useMarketStore((s) => s.sellShares);
  const pending = useMarketStore((s) => s.orderPending);
  const { t } = useT();
  const ol = useOutcomeLabel();

  const held = useMemo(
    () =>
      positions
        .filter((p) => p.marketId === market.id && !p.resolved && p.shares > 0)
        .map((p) => ({ position: p, outcome: market.outcomes.find((o) => o.id === p.outcomeId) }))
        .filter((x): x is { position: (typeof positions)[number]; outcome: Market["outcomes"][number] } => Boolean(x.outcome)),
    [positions, market]
  );

  if (held.length === 0) {
    return (
      <p data-testid="sell-nothing" className="rounded-btn bg-surface-3 p-4 text-center text-13 text-secondary">
        {t("trade", "sellNothing")}
      </p>
    );
  }

  const selected = held.find((h) => h.outcome.id === outcomeId) ?? held[0];
  const owned = selected.position.shares;
  const value = parseShares(shares);
  const whole = Number.isFinite(value) && Math.abs(value - Math.round(owned * 1e8) / 1e8) < 1e-9;
  const valid = Number.isFinite(value) && value > 0 && value <= owned + 1e-9;
  const est = estimateSale(market, selected.outcome.id, valid ? value : 0);
  const realized = valid ? est.proceeds - selected.position.avgPrice * value : 0;
  const tooSmall = valid && !whole && est.proceeds < 1;
  const error = !shares.trim()
    ? null
    : !Number.isFinite(value) || value <= 0
      ? t("trade", "sellInvalid")
      : value > owned + 1e-9
        ? t("trade", "sellTooMany", { count: fmtShares(owned) })
        : tooSmall
          ? t("toast", "orderSellTooSmall")
          : null;

  return (
    <div className="flex flex-col gap-4" data-testid="sell-form">
      <div role="group" aria-label={t("market", "pickOutcome")} className="grid grid-cols-1 gap-2">
        {held.map(({ outcome, position }) => {
          const active = outcome.id === selected.outcome.id;
          return (
            <button
              key={outcome.id}
              type="button"
              aria-pressed={active}
              data-testid="sell-outcome"
              onClick={() => {
                onOutcomeChange(outcome.id);
                onSharesChange("");
              }}
              className={cn(
                "flex min-h-touch items-center justify-between gap-2 rounded-btn border px-3 text-14 font-bold transition-colors duration-xs",
                FOCUS_RING,
                active ? "border-brand bg-brand/15 text-brand" : "border-subtle bg-surface-3 text-secondary hover:border-strong hover:text-primary"
              )}
            >
              <span className="truncate">{t("trade", "sell", { outcome: ol(outcome) })}</span>
              <span className="tnum shrink-0 text-12">{t("trade", "youHold", { count: fmtShares(position.shares) })}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={sharesId} className="text-13 font-semibold text-primary">
          {t("trade", "sharesToSell")}
        </label>
        <input
          id={sharesId}
          inputMode="decimal"
          autoComplete="off"
          value={shares}
          onChange={(e) => onSharesChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${sharesId}-error` : undefined}
          className={cn(
            "tnum h-12 w-full rounded-btn border bg-surface-1 px-3 text-16 font-semibold text-primary",
            FOCUS_RING,
            error ? "border-danger" : "border-strong"
          )}
        />
        <div className="grid grid-cols-4 gap-2">
          {CHIPS.map((pct) => (
            <button
              key={pct}
              type="button"
              data-testid={`sell-chip-${pct}`}
              aria-label={t("trade", "sellPercent", { pct })}
              onClick={() => onSharesChange(pct === 100 ? fmtShares(owned) : fmtShares((owned * pct) / 100, "floor"))}
              className={cn(
                "min-h-touch rounded-btn border border-subtle bg-surface-3 text-13 font-semibold text-secondary transition-colors hover:border-strong hover:text-primary",
                FOCUS_RING
              )}
            >
              {pct}%
            </button>
          ))}
        </div>
        {error && (
          <p id={`${sharesId}-error`} role="alert" className="text-12 font-semibold text-danger">
            {error}
          </p>
        )}
      </div>

      <dl className="flex flex-col gap-2 rounded-btn bg-surface-3 p-3 text-13">
        <div className="flex justify-between gap-2">
          <dt className="text-secondary">{t("trade", "avgPrice")}</dt>
          <dd className="tnum font-semibold text-primary">{formatRupees(valid ? est.avgPrice : selected.outcome.price)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-secondary">{t("trade", "priceImpact")}</dt>
          <dd className="tnum font-semibold text-primary" data-testid="sell-impact">
            {valid ? `${formatPercent(selected.outcome.price, 1)} → ${formatPercent(est.priceAfter, 1)}` : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-secondary">{t("trade", "realizedPnl")}</dt>
          <dd className={cn("tnum font-semibold", realized >= 0 ? "text-success" : "text-danger")} data-testid="sell-realized">
            {valid ? `${realized >= 0 ? "+" : "-"}${formatRupees(Math.abs(realized))}` : "—"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2 border-t border-subtle pt-2">
          <dt className="text-secondary">{t("trade", "youWillReceive")}</dt>
          <dd>
            <AnimatedNumber value={est.proceeds} format={(n) => formatRupees(n)} className="text-16 font-bold text-success" data-testid="sell-proceeds" />
          </dd>
        </div>
      </dl>

      <Button
        size="lg"
        fullWidth
        onClick={() => void sell({ market, outcomeId: selected.outcome.id, shares: value })}
        disabled={!valid || tooSmall || !tradable}
        loading={pending}
        className="text-14 font-bold"
        data-testid="sell-submit"
      >
        {t("trade", "sellShares")}
      </Button>
    </div>
  );
}
