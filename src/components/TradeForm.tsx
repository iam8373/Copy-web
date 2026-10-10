"use client";

import { AlertTriangle } from "lucide-react";
import type { Market } from "@/lib/types";
import { useMarketStore } from "@/store/useMarketStore";
import { useT } from "@/i18n/LanguageProvider";
import { AmountField } from "@/components/AmountField";
import { AnimatedNumber, Button, FOCUS_RING } from "@/components/ui";
import { validateAmount } from "@/lib/trade-limits";
import { cn, formatPercent, formatRupees } from "@/lib/utils";
import { estimateShares } from "@/services/markets/market-data";

export interface TradeFormProps {
  market: Market;
  outcomeId: string;
  onOutcomeChange: (id: string) => void;
  amount: string;
  onAmountChange: (raw: string) => void;
  /** id of the amount input (each instance on a page needs its own). */
  amountId: string;
  /** Price when the form was opened; shows a warning if it has since moved. */
  openedPrice?: number;
}

/**
 * Buy form shared by the market page's sticky panel (lg+) and the trade sheet
 * (TradeModal). Buy-only: selling needs the engine's sell path (backlog).
 *
 * Yes is success and No is danger for binary markets; multi-outcome markets
 * use the brand colour for the selected outcome.
 */
export function TradeForm({
  market,
  outcomeId,
  onOutcomeChange,
  amount,
  onAmountChange,
  amountId,
  openedPrice,
}: TradeFormProps) {
  const placeOrder = useMarketStore((s) => s.placeOrder);
  const pending = useMarketStore((s) => s.orderPending);
  const wallet = useMarketStore((s) => s.wallet);
  const { t } = useT();

  const selected = market.outcomes.find((o) => o.id === outcomeId) ?? market.outcomes[0];
  const check = validateAmount(amount);
  // LMSR estimate including price impact (same model as place_order); the
  // server's fill is what the success animation and toast show.
  const shares = check.ok ? estimateShares(market, selected.id, check.value) : 0;
  const payout = shares;
  const returnPct = check.ok && check.value > 0 ? (payout - check.value) / check.value : 0;
  const slipped = openedPrice !== undefined && Math.abs(selected.price - openedPrice) > 0.01;
  // Only open markets before their end date take orders (the server checks too).
  const tradable = (market.status === undefined || market.status === "open") && new Date(market.endDate) > new Date();

  return (
    <div className="flex flex-col gap-4" data-testid="trade-form">
      <div
        role="group"
        aria-label={t("market", "pickOutcome")}
        className={cn(
          "grid gap-2",
          market.isBinary ? "grid-cols-2" : "thin-scrollbar max-h-48 grid-cols-1 overflow-y-auto p-0.5"
        )}
      >
        {market.outcomes.map((o, i) => {
          const active = o.id === selected.id;
          const tone = market.isBinary ? (i === 0 ? "yes" : "no") : "brand";
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={active}
              data-testid="trade-outcome"
              onClick={() => onOutcomeChange(o.id)}
              className={cn(
                "flex min-h-touch items-center justify-between gap-2 rounded-btn border px-3 text-14 font-bold transition-colors duration-xs",
                FOCUS_RING,
                active && tone === "yes" && "border-success bg-success/15 text-success",
                active && tone === "no" && "border-danger bg-danger/15 text-danger",
                active && tone === "brand" && "border-brand bg-brand/15 text-brand",
                !active && "border-subtle bg-surface-3 text-secondary hover:border-strong hover:text-primary"
              )}
            >
              <span className="truncate">{t("trade", "buy", { outcome: o.label })}</span>
              <span className="tnum shrink-0">{formatPercent(o.price, 1)}</span>
            </button>
          );
        })}
      </div>

      <AmountField id={amountId} value={amount} onChange={onAmountChange} />

      <dl className="flex flex-col gap-2 rounded-btn bg-surface-3 p-3 text-13">
        <div className="flex justify-between gap-2">
          <dt className="text-secondary">{t("trade", "avgPrice")}</dt>
          <dd className="tnum font-semibold text-primary">{formatRupees(shares > 0 && check.ok ? check.value / shares : selected.price)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-secondary">{t("trade", "youWillReceive")}</dt>
          <dd className="font-semibold text-primary">
            <AnimatedNumber
              value={shares}
              format={(n) => t("trade", "shares", { count: n.toFixed(1) })}
            />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2 border-t border-subtle pt-2">
          <dt className="text-secondary">{t("trade", "ifCorrect")}</dt>
          <dd className="flex items-baseline gap-1.5">
            <AnimatedNumber
              value={payout}
              format={(n) => formatRupees(n)}
              className="text-16 font-bold text-success"
              data-testid="trade-payout"
            />
            {check.ok && (
              <span className="tnum text-12 font-semibold text-success">
                (+{formatPercent(returnPct, 0)})
              </span>
            )}
          </dd>
        </div>
      </dl>

      {slipped && (
        <p className="flex items-center gap-2 rounded-btn border border-warning/30 bg-warning/10 px-3 py-2 text-12 text-warning"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t("trade", "priceMoved", { price: formatPercent(selected.price, 1) })}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          fullWidth
          // The store re-validates; this is only the UI half of the check.
          onClick={() => void placeOrder({ market, outcomeId: selected.id, amount: Number(amount) })}
          disabled={!check.ok || !tradable}
          loading={pending}
          className="text-14 font-bold"
        >
          {t("trade", "placeOrder")}
        </Button>
        {!tradable && (
          <p className="text-center text-12 font-semibold text-warning" data-testid="market-closed-note">
            {t("toast", "orderMarketClosed")}
          </p>
        )}
        {wallet !== null && (
          <p className="tnum text-center text-12 text-secondary" data-testid="trade-balance">
            {t("trade", "balance", { amount: formatRupees(wallet) })}
          </p>
        )}
        <p className="text-center text-11 text-secondary">{t("trade", "settlementNote")}</p>
      </div>
    </div>
  );
}
