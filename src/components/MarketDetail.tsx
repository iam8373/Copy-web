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
import { useMarketText } from "@/lib/market-text";
import { color, size, tooltipStyle } from "@/lib/tokens";
import { Languages } from "lucide-react";
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
  const { t, locale } = useT();
  const text = useMarketText(market);
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
        className="flex w-fit items-center gap-1 text-13 font-semibold text-secondary transition-colors hover:text-primary"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to {market.category}
      </Link>

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-11 font-semibold uppercase tracking-wide">
          <span className="rounded-chip bg-brand/15 px-2 py-1 text-brand">
            {market.category} • {market.subcategory}
          </span>
          {market.isLive ? (
            <span className="flex items-center gap-1 rounded-chip bg-danger/15 px-2 py-1 text-danger">
              <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse-dot" />
              Live <Countdown endDate={market.endDate} />
            </span>
          ) : (
            <span className="rounded-chip bg-surface-3 px-2 py-1 text-secondary">
              Open
            </span>
          )}
          <span className="text-secondary">
            {t("terms", "resolves")} {formatEndDate(market.endDate)}
          </span>
        </div>
        <h1 className="text-xl font-bold leading-tight tracking-tight text-primary sm:text-2xl">
          {text.title}
        </h1>
        {/* Saved AI translation, not yet reviewed by a native speaker. */}
        {text.translated && locale !== "en" && (
          <p
            data-testid="translated-note"
            className="flex w-fit items-center gap-1.5 rounded-chip bg-surface-3 px-2 py-1 text-11 font-medium text-secondary"
          >
            <Languages className="h-3 w-3" aria-hidden="true" />
            {t("market", "translatedNote")}
          </p>
        )}
        <p className="tnum text-13 text-secondary">
          {t("terms", "volume")} {formatVolumeFull(market.totalVolume)}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4">
          {/* Probability chart */}
          <section className="rounded-card border border-subtle bg-surface-2 p-4">
            <div className="flex items-baseline gap-2">
              <h2 className="text-13 font-bold uppercase tracking-wide text-secondary">
                {market.outcomes[0].label} probability
              </h2>
              <FlashValue
                value={market.outcomes[0].price}
                className="ml-auto text-2xl font-bold text-primary"
              >
                {formatPercent(market.outcomes[0].price, 1)}
              </FlashValue>
              <span
                className={cn(
                  "tnum text-13 font-semibold",
                  up ? "text-success" : "text-danger"
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
                      <stop offset="0%" stopColor={color.brand} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={color.brand} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={color.borderSubtle} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: color.textSecondary, fontSize: size.axisFont }}
                    stroke={color.borderSubtle}
                    interval="preserveStartEnd"
                    minTickGap={72}
                    tickMargin={8}
                    padding={{ left: 12, right: 12 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: color.textSecondary, fontSize: size.axisFont }}
                    stroke={color.borderSubtle}
                    width={size.axisWidth}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => [`${v}%`, "Probability"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="p"
                    stroke={color.brand}
                    strokeWidth={size.lineWidth}
                    fill="url(#prob)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Order book */}
          <section className="rounded-card border border-subtle bg-surface-2 p-4">
            <h2 className="text-13 font-bold uppercase tracking-wide text-secondary">
              Order book · {selected.label}
            </h2>
            <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-x-3 text-12">
              <span className="text-secondary">Price</span>
              <span className="text-right text-secondary">Shares</span>
              <span className="text-right text-secondary">Total</span>

              {book.asks.map((a) => (
                <Row key={`ask-${a.price}`} row={a} tone="red" maxSize={maxSize} />
              ))}

              <div className="col-span-3 my-2 flex items-center gap-2 border-y border-subtle py-1.5">
                <span className="text-12 text-secondary">Last</span>
                <FlashValue
                  value={selected.price}
                  className="text-13 font-bold text-primary"
                >
                  {selected.price.toFixed(2)}
                </FlashValue>
                <span className="ml-auto text-12 text-secondary">
                  Spread 0.02
                </span>
              </div>

              {book.bids.map((b) => (
                <Row key={`bid-${b.price}`} row={b} tone="green" maxSize={maxSize} />
              ))}
            </div>
          </section>

          {/* Rules */}
          <section className="rounded-card border border-subtle bg-surface-2">
            <button
              type="button"
              onClick={() => setRulesOpen((o) => !o)}
              className="flex w-full items-center gap-2 p-4 text-left"
            >
              <h2 className="text-13 font-bold uppercase tracking-wide text-secondary">
                Market rules &amp; resolution
              </h2>
              <ChevronDown
                className={cn(
                  "ml-auto h-4 w-4 text-secondary transition-transform",
                  rulesOpen && "rotate-180"
                )}
              />
            </button>
            {rulesOpen && (
              <div className="flex flex-col gap-3 border-t border-subtle p-4 text-13 leading-relaxed text-secondary">
                <p>{text.description}</p>
                <p>
                  <span className="font-semibold text-primary">Resolution source: </span>
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
          <section className="rounded-card border border-subtle bg-surface-2 p-4">
            <h2 className="text-13 font-bold uppercase tracking-wide text-secondary">
              Activity
            </h2>
            <ul className="mt-3 flex flex-col divide-y divide-subtle">
              {activity.map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-2 text-13">
                  <span className="truncate font-semibold text-primary">{a.user}</span>
                  <span className="text-secondary">{a.side}</span>
                  <span className="tnum text-primary">{a.shares}</span>
                  <span
                    className={cn(
                      "truncate font-semibold",
                      a.side === "bought" ? "text-success" : "text-danger"
                    )}
                  >
                    {a.label}
                  </span>
                  <span className="tnum text-secondary">@ {a.price.toFixed(2)}</span>
                  <span className="tnum ml-auto shrink-0 text-12 text-secondary">
                    {a.minutesAgo}m ago
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Trade panel */}
        <aside className="h-fit rounded-card border border-subtle bg-surface-2 p-4 lg:sticky lg:top-32">
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
                    "flex items-center justify-between gap-2 rounded-btn border px-3 py-2 text-13 font-bold transition-colors",
                    active && tone === "green" && "border-success bg-success/20 text-success",
                    active && tone === "red" && "border-danger bg-danger/20 text-danger",
                    active && tone === "blue" && "border-brand bg-brand/20 text-brand",
                    !active &&
                      "border-subtle bg-surface-3 text-secondary hover:text-primary"
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

          <dl className="mt-4 flex flex-col gap-1.5 rounded-btn bg-surface-3 p-3 text-13">
            <div className="flex justify-between gap-2">
              <dt className="text-secondary">{t("trade", "youWillReceive")}</dt>
              <dd className="tnum font-semibold text-primary">
                {t("trade", "shares", { count: shares.toFixed(1) })}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-secondary">{t("trade", "ifCorrect")}</dt>
              <dd className="tnum font-semibold text-success">{formatRupees(shares)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-secondary">{t("trade", "avgPrice")}</dt>
              <dd className="tnum font-semibold text-primary">
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
            className="mt-4 h-11 w-full rounded-btn bg-brand-fill text-14 font-bold text-white transition-colors hover:bg-brand-fill-hover active:brightness-95 disabled:opacity-40"
          >
            {t("trade", "placeOrder")}
          </button>
          <p className="mt-2 text-center text-11 text-secondary">
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
      <div className="relative col-span-3 grid grid-cols-[1fr_auto_auto] items-center gap-x-3 py-1">
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0 right-0",
            tone === "red" ? "bg-danger/10" : "bg-success/10"
          )}
          style={{ width: `${(row.size / maxSize) * 100}%` }}
        />
        <span
          className={cn(
            "tnum relative font-semibold",
            tone === "red" ? "text-danger" : "text-success"
          )}
        >
          {row.price.toFixed(2)}
        </span>
        <span className="tnum relative text-right text-primary">
          {row.size.toLocaleString("en-US")}
        </span>
        <span className="tnum relative text-right text-secondary">
          ${Math.round(row.size * row.price).toLocaleString("en-US")}
        </span>
      </div>
    </>
  );
}
