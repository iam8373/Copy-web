"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Market } from "@/lib/types";
import { useMarketStore } from "@/store/useMarketStore";
import { useT } from "@/i18n/LanguageProvider";
import { AmountField } from "@/components/AmountField";
import { validateAmount } from "@/lib/trade-limits";
import { Countdown } from "@/components/Countdown";
import { FlashValue } from "@/components/FlashValue";
import {
  cn,
  formatChange,
  formatEndDate,
  formatPercent,
  formatRupees,
  formatVolumeFull,
} from "@/lib/utils";

type Point = { t: string; p: number };
type Book = { asks: Array<{ price: number; size: number }>; bids: Array<{ price: number; size: number }> };
type Activity = {
  id: string;
  user: string;
  side: string;
  shares: number;
  label: string;
  price: number;
  minutesAgo: number;
};


export function MarketDetail({
  market: initial,
  history,
  book,
  activity,
}: {
  market: Market;
  history: Point[];
  book: Book;
  activity: Activity[];
}) {
  const markets = useMarketStore((s) => s.markets);
  const placeOrder = useMarketStore((s) => s.placeOrder);
  const market = markets.find((m) => m.id === initial.id) ?? initial;

  const [outcomeId, setOutcomeId] = useState(market.outcomes[0].id);
  const [amount, setAmount] = useState("500");
  const { t } = useT();
  const [rulesOpen, setRulesOpen] = useState(false);

  const selected = market.outcomes.find((o) => o.id === outcomeId) ?? market.outcomes[0];
  const check = validateAmount(amount);
  const shares = check.ok ? check.value / Math.max(selected.price, 0.01) : 0;

  const chartData = useMemo(() => {
    const data = [...history];
    data[data.length - 1] = {
      ...data[data.length - 1],
      p: Number((market.outcomes[0].price * 100).toFixed(1)),
    };
    return data.map((d) => ({
      ...d,
      label: new Date(d.t).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        timeZone: "UTC",
      }),
    }));
  }, [history, market.outcomes]);

  const up = market.outcomes[0].change24h >= 0;
  const maxSize = Math.max(...book.asks.map((a) => a.size), ...book.bids.map((b) => b.size));

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={`/markets/${market.category}`}
        className="flex w-fit items-center gap-1 text-[13px] font-semibold text-content-secondary transition-colors hover:text-content-primary"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to {market.category}
      </Link>

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
          <span className="rounded-md bg-accent-blue/15 px-2 py-0.5 text-accent-blue">
            {market.category} • {market.subcategory}
          </span>
          {market.isLive ? (
            <span className="flex items-center gap-1 rounded-md bg-accent-red/15 px-2 py-0.5 text-accent-red">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-red animate-pulse-dot" />
              Live <Countdown endDate={market.endDate} />
            </span>
          ) : (
            <span className="rounded-md bg-bg-tertiary px-2 py-0.5 text-content-secondary">
              Open
            </span>
          )}
          <span className="text-content-secondary">
            Resolves {formatEndDate(market.endDate)}
          </span>
        </div>
        <h1 className="text-xl font-bold leading-tight tracking-tight text-content-primary sm:text-2xl">
          {market.title}
        </h1>
        <p className="tnum text-[13px] text-content-secondary">
          Volume {formatVolumeFull(market.totalVolume)}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4">
          {/* Probability chart */}
          <section className="rounded-xl border border-subtle bg-bg-secondary p-4">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-content-secondary">
                {market.outcomes[0].label} probability
              </h2>
              <FlashValue
                value={market.outcomes[0].price}
                className="ml-auto text-2xl font-bold text-content-primary"
              >
                {formatPercent(market.outcomes[0].price, 1)}
              </FlashValue>
              <span
                className={cn(
                  "tnum text-[13px] font-semibold",
                  up ? "text-accent-green" : "text-accent-red"
                )}
              >
                {formatChange(market.outcomes[0].change24h)} pts
              </span>
            </div>

            <div className="mt-3 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="prob" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7C5CFF" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#7C5CFF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                    stroke="var(--border-subtle)"
                    interval="preserveStartEnd"
                    minTickGap={72}
                    tickMargin={8}
                    padding={{ left: 12, right: 12 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                    stroke="var(--border-subtle)"
                    width={46}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg-tertiary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--text-primary)",
                    }}
                    formatter={(v) => [`${v}%`, "Probability"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="p"
                    stroke="#7C5CFF"
                    strokeWidth={2}
                    fill="url(#prob)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Order book */}
          <section className="rounded-xl border border-subtle bg-bg-secondary p-4">
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-content-secondary">
              Order book · {selected.label}
            </h2>
            <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-x-3 text-[12px]">
              <span className="text-content-secondary">Price</span>
              <span className="text-right text-content-secondary">Shares</span>
              <span className="text-right text-content-secondary">Total</span>

              {book.asks.map((a) => (
                <Row key={`ask-${a.price}`} row={a} tone="red" maxSize={maxSize} />
              ))}

              <div className="col-span-3 my-2 flex items-center gap-2 border-y border-subtle py-1.5">
                <span className="text-[12px] text-content-secondary">Last</span>
                <FlashValue
                  value={selected.price}
                  className="text-[13px] font-bold text-content-primary"
                >
                  {selected.price.toFixed(2)}
                </FlashValue>
                <span className="ml-auto text-[12px] text-content-secondary">
                  Spread 0.02
                </span>
              </div>

              {book.bids.map((b) => (
                <Row key={`bid-${b.price}`} row={b} tone="green" maxSize={maxSize} />
              ))}
            </div>
          </section>

          {/* Rules */}
          <section className="rounded-xl border border-subtle bg-bg-secondary">
            <button
              type="button"
              onClick={() => setRulesOpen((o) => !o)}
              className="flex w-full items-center gap-2 p-4 text-left"
            >
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-content-secondary">
                Market rules &amp; resolution
              </h2>
              <ChevronDown
                className={cn(
                  "ml-auto h-4 w-4 text-content-secondary transition-transform",
                  rulesOpen && "rotate-180"
                )}
              />
            </button>
            {rulesOpen && (
              <div className="flex flex-col gap-3 border-t border-subtle p-4 text-[13px] leading-relaxed text-content-secondary">
                <p>{market.description}</p>
                <p>
                  <span className="font-semibold text-content-primary">Resolution source: </span>
                  {market.resolutionSource}
                </p>
                <p>
                  Outcome shares are backed one-for-one by rupee balances held against this
                  market. Settlement pays ₹1 per share to the winning outcome once the named
                  resolution source publishes a result.
                </p>
              </div>
            )}
          </section>

          {/* Activity */}
          <section className="rounded-xl border border-subtle bg-bg-secondary p-4">
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-content-secondary">
              Activity
            </h2>
            <ul className="mt-3 flex flex-col divide-y divide-[color:var(--border-subtle)]">
              {activity.map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-2 text-[13px]">
                  <span className="truncate font-semibold text-content-primary">{a.user}</span>
                  <span className="text-content-secondary">{a.side}</span>
                  <span className="tnum text-content-primary">{a.shares}</span>
                  <span
                    className={cn(
                      "truncate font-semibold",
                      a.side === "bought" ? "text-accent-green" : "text-accent-red"
                    )}
                  >
                    {a.label}
                  </span>
                  <span className="tnum text-content-secondary">@ {a.price.toFixed(2)}</span>
                  <span className="tnum ml-auto shrink-0 text-[12px] text-content-secondary">
                    {a.minutesAgo}m ago
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Trade panel */}
        <aside className="h-fit rounded-xl border border-subtle bg-bg-secondary p-4 lg:sticky lg:top-32">
          <div
            className={cn(
              "grid gap-2",
              market.isBinary ? "grid-cols-2" : "max-h-44 grid-cols-1 overflow-y-auto thin-scrollbar"
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

          <div className="mt-4">
            <AmountField id="detail-amount" value={amount} onChange={setAmount} />
          </div>

          <dl className="mt-4 flex flex-col gap-1.5 rounded-lg bg-bg-tertiary p-3 text-[13px]">
            <div className="flex justify-between gap-2">
              <dt className="text-content-secondary">{t("trade", "youWillReceive")}</dt>
              <dd className="tnum font-semibold text-content-primary">
                {t("trade", "shares", { count: shares.toFixed(1) })}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-content-secondary">{t("trade", "ifCorrect")}</dt>
              <dd className="tnum font-semibold text-accent-green">{formatRupees(shares)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-content-secondary">{t("trade", "avgPrice")}</dt>
              <dd className="tnum font-semibold text-content-primary">
                {selected.price.toFixed(2)}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            // The store re-validates; this is only the UI half of the check.
            onClick={() =>
              placeOrder({ market, outcomeId: selected.id, amount: Number(amount) })
            }
            disabled={!check.ok}
            className="mt-4 h-11 w-full rounded-lg bg-accent-blue text-[14px] font-bold text-white transition-colors hover:bg-accent-strong active:brightness-95 disabled:opacity-40"
          >
            {t("trade", "placeOrder")}
          </button>
          <p className="mt-2 text-center text-[11px] text-content-secondary">
            {t("trade", "settlementNote")}
          </p>
        </aside>
      </div>
    </div>
  );
}

function Row({
  row,
  tone,
  maxSize,
}: {
  row: { price: number; size: number };
  tone: "red" | "green";
  maxSize: number;
}) {
  return (
    <>
      <div className="relative col-span-3 grid grid-cols-[1fr_auto_auto] items-center gap-x-3 py-0.5">
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0 right-0",
            tone === "red" ? "bg-accent-red/10" : "bg-accent-green/10"
          )}
          style={{ width: `${(row.size / maxSize) * 100}%` }}
        />
        <span
          className={cn(
            "tnum relative font-semibold",
            tone === "red" ? "text-accent-red" : "text-accent-green"
          )}
        >
          {row.price.toFixed(2)}
        </span>
        <span className="tnum relative text-right text-content-primary">
          {row.size.toLocaleString("en-US")}
        </span>
        <span className="tnum relative text-right text-content-secondary">
          ${Math.round(row.size * row.price).toLocaleString("en-US")}
        </span>
      </div>
    </>
  );
}
