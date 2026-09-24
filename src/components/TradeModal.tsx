"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useMarketStore } from "@/store/useMarketStore";
import { cn, formatPercent } from "@/lib/utils";

const PRESETS = [10, 50, 100];

export function TradeModal() {
  const trade = useMarketStore((s) => s.trade);
  const markets = useMarketStore((s) => s.markets);
  const closeTrade = useMarketStore((s) => s.closeTrade);
  const placeOrder = useMarketStore((s) => s.placeOrder);

  const [amount, setAmount] = useState(50);
  const [outcomeId, setOutcomeId] = useState<string | null>(null);

  useEffect(() => {
    if (trade) {
      setOutcomeId(trade.outcomeId);
      setAmount(50);
    }
  }, [trade]);

  const market = useMemo(
    () => (trade ? markets.find((m) => m.id === trade.market.id) ?? trade.market : null),
    [markets, trade]
  );

  if (!trade || !market) return null;

  const selected =
    market.outcomes.find((o) => o.id === outcomeId) ?? market.outcomes[0];
  const openedAt = trade.market.outcomes.find((o) => o.id === selected.id)?.price ?? selected.price;
  const slipped = Math.abs(selected.price - openedAt) > 0.01;
  const shares = amount / Math.max(selected.price, 0.01);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={closeTrade} />

      <div className="relative w-full max-w-md rounded-t-xl border border-subtle bg-bg-secondary p-4 shadow-2xl animate-slide-up sm:rounded-xl sm:p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-content-secondary">
              {market.category} • {market.subcategory}
            </p>
            <h2 className="mt-0.5 line-clamp-2 text-[15px] font-bold text-content-primary">
              {market.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeTrade}
            aria-label="Close"
            className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-content-secondary transition-colors hover:bg-bg-tertiary hover:text-content-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className={cn(
            "mt-4 grid gap-2",
            market.isBinary ? "grid-cols-2" : "max-h-40 grid-cols-1 overflow-y-auto thin-scrollbar"
          )}
        >
          {market.outcomes.map((o, i) => {
            const active = o.id === selected.id;
            const tone = market.isBinary ? (i === 0 ? "green" : "red") : "blue";
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setOutcomeId(o.id)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[13px] font-bold transition-colors",
                  active && tone === "green" && "border-accent-green bg-accent-green/20 text-accent-green",
                  active && tone === "red" && "border-accent-red bg-accent-red/20 text-accent-red",
                  active && tone === "blue" && "border-accent-blue bg-accent-blue/20 text-accent-blue",
                  !active &&
                    "border-subtle bg-bg-tertiary text-content-secondary hover:text-content-primary"
                )}
              >
                <span className="truncate">Buy {o.label}</span>
                <span className="tnum shrink-0">{formatPercent(o.price, 1)}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <label className="text-[12px] font-medium text-content-secondary" htmlFor="amount">
            Amount (USDC)
          </label>
          <input
            id="amount"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
            className="tnum h-11 w-full rounded-lg border border-subtle bg-bg-tertiary px-3 text-[15px] font-semibold text-content-primary outline-none focus:border-accent-blue"
          />
          <input
            type="range"
            min={1}
            max={500}
            value={Math.min(amount, 500)}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="h-1.5 w-full accent-[#7C5CFF]"
            aria-label="Amount slider"
          />
          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(p)}
                className="flex-1 rounded-lg border border-subtle bg-bg-tertiary py-1.5 text-[12px] font-semibold text-content-secondary transition-colors hover:text-content-primary"
              >
                ${p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAmount(500)}
              className="flex-1 rounded-lg border border-subtle bg-bg-tertiary py-1.5 text-[12px] font-semibold text-content-secondary transition-colors hover:text-content-primary"
            >
              Max
            </button>
          </div>
        </div>

        <dl className="mt-4 flex flex-col gap-1.5 rounded-lg bg-bg-tertiary p-3 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-content-secondary">You will receive</dt>
            <dd className="tnum font-semibold text-content-primary">~{shares.toFixed(1)} shares</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-content-secondary">If correct, you receive</dt>
            <dd className="tnum font-semibold text-accent-green">${shares.toFixed(2)}</dd>
          </div>
        </dl>

        {slipped && (
          <p className="mt-3 flex items-center gap-2 rounded-lg border border-accent-yellow/30 bg-accent-yellow/10 px-3 py-2 text-[12px] text-accent-yellow">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Price moved to {formatPercent(selected.price, 1)} since you opened this order.
          </p>
        )}

        <button
          type="button"
          onClick={() => placeOrder({ market, outcomeId: selected.id, amount })}
          disabled={amount <= 0}
          className="mt-4 h-11 w-full rounded-lg bg-accent-blue text-[14px] font-bold text-white transition-colors hover:bg-accent-strong active:brightness-95 disabled:opacity-40"
        >
          Place Order
        </button>
      </div>
    </div>
  );
}
