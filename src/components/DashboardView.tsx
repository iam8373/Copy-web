"use client";

import Link from "next/link";
import { ArrowRight, Briefcase, LineChart, LogIn } from "lucide-react";
import { usePortfolio, type EnrichedPosition } from "@/lib/usePortfolio";
import { useMarketStore } from "@/store/useMarketStore";
import { cn, formatPercent, formatRupees } from "@/lib/utils";
import { useT } from "@/i18n/LanguageProvider";
import { getMarketText, useMarketText } from "@/lib/market-text";

function StatCard({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-subtle bg-bg-secondary p-4">
      <p className="text-[12px] font-medium text-content-secondary">{label}</p>
      <p
        className={cn(
          "tnum mt-1 text-xl font-bold",
          tone === "up" && "text-accent-green",
          tone === "down" && "text-accent-red",
          !tone && "text-content-primary"
        )}
      >
        {value}
      </p>
      {sub && <p className="tnum mt-0.5 text-[12px] text-content-secondary">{sub}</p>}
    </div>
  );
}

function PositionRow({ row }: { row: EnrichedPosition }) {
  const text = useMarketText(row.market);
  const up = row.pnl >= 0;
  return (
    <tr className="border-t border-subtle">
      <td className="max-w-[320px] py-3 pr-3">
        <Link
          href={`/market/${row.market.slug}`}
          className="line-clamp-2 text-[13px] font-semibold text-content-primary transition-colors hover:text-accent-blue"
        >
          {text.title}
        </Link>
        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-content-secondary">
          {row.market.category} • {row.market.subcategory}
        </p>
      </td>
      <td className="py-3 pr-3">
        <span className="rounded-md bg-bg-tertiary px-2 py-0.5 text-[12px] font-semibold text-content-primary">
          {row.outcomeLabel}
        </span>
      </td>
      <td className="tnum py-3 pr-3 text-right text-[13px] text-content-primary">
        {Math.round(row.shares).toLocaleString("en-IN")}
      </td>
      <td className="tnum py-3 pr-3 text-right text-[13px] text-content-secondary">
        {row.avgPrice.toFixed(2)}
      </td>
      <td className="tnum py-3 pr-3 text-right text-[13px] text-content-primary">
        {row.lastPrice.toFixed(2)}
      </td>
      <td className="tnum py-3 pr-3 text-right text-[13px] text-content-primary">
        {formatRupees(row.value, 0)}
      </td>
      <td
        className={cn(
          "tnum py-3 text-right text-[13px] font-semibold",
          up ? "text-accent-green" : "text-accent-red"
        )}
      >
        {up ? "+" : "-"}
        {formatRupees(Math.abs(row.pnl), 0)}
        <span className="ml-1 text-[11px] font-medium opacity-80">
          ({up ? "+" : ""}
          {row.pnlPct.toFixed(1)}%)
        </span>
      </td>
    </tr>
  );
}

function PositionCard({ row }: { row: EnrichedPosition }) {
  const text = useMarketText(row.market);
  const up = row.pnl >= 0;
  return (
    <Link
      href={`/market/${row.market.slug}`}
      className="flex flex-col gap-2 rounded-xl border border-subtle bg-bg-secondary p-3.5"
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-content-secondary">
          {row.market.category} • {row.market.subcategory}
        </span>
        {row.resolved && (
          <span
            className={cn(
              "ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase",
              row.resolved === "won"
                ? "bg-accent-green/15 text-accent-green"
                : "bg-accent-red/15 text-accent-red"
            )}
          >
            {row.resolved}
          </span>
        )}
      </div>
      <p className="line-clamp-2 text-[14px] font-bold leading-snug text-content-primary">
        {text.title}
      </p>
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-bg-tertiary px-2 py-0.5 text-[12px] font-semibold text-content-primary">
          {row.outcomeLabel}
        </span>
        <span className="tnum text-[12px] text-content-secondary">
          {Math.round(row.shares).toLocaleString("en-IN")} shares @ {row.avgPrice.toFixed(2)}
        </span>
      </div>
      <div className="flex items-center justify-between border-t border-subtle pt-2">
        <span className="tnum text-[12px] text-content-secondary">
          Value {formatRupees(row.value, 0)}
        </span>
        <span
          className={cn(
            "tnum text-[13px] font-bold",
            up ? "text-accent-green" : "text-accent-red"
          )}
        >
          {up ? "+" : "-"}
          {formatRupees(Math.abs(row.pnl), 0)}
        </span>
      </div>
    </Link>
  );
}

export function DashboardView() {
  const { t, locale } = useT();
  const session = useMarketStore((s) => s.session);
  const setAuthOpen = useMarketStore((s) => s.setAuthOpen);
  const {
    open,
    settled,
    portfolioValue,
    investedOpen,
    unrealized,
    realized,
    netPnl,
  } = usePortfolio();

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-content-primary">
            {t("dashboard", "title")}
          </h1>
          <p className="mt-0.5 text-[13px] text-content-secondary">
            {session
              ? t("dashboard", "signedInAs", { handle: session.handle })
              : t("dashboard", "demoPortfolio")}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Link
            href="/profit"
            className="flex items-center gap-1.5 rounded-lg border border-subtle bg-bg-secondary px-3 py-2 text-[13px] font-semibold text-content-primary transition-colors hover:border-accent-blue"
          >
            {t("dashboard", "pnlBreakdown")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          {!session && (
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-accent-blue px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-strong"
            >
              <LogIn className="h-3.5 w-3.5" />
              {t("header", "signInShort")}
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("dashboard", "portfolioValue")} value={formatRupees(portfolioValue, 0)} />
        <StatCard label={t("dashboard", "invested")} value={formatRupees(investedOpen, 0)} />
        <StatCard
          label={t("dashboard", "unrealised")}
          value={`${unrealized >= 0 ? "+" : "-"}${formatRupees(Math.abs(unrealized), 0)}`}
          tone={unrealized >= 0 ? "up" : "down"}
        />
        <StatCard
          label={t("dashboard", "netPnl")}
          value={`${netPnl >= 0 ? "+" : "-"}${formatRupees(Math.abs(netPnl), 0)}`}
          tone={netPnl >= 0 ? "up" : "down"}
          sub={t("dashboard", "realised", {
            value: `${realized >= 0 ? "+" : "-"}${formatRupees(Math.abs(realized), 0)}`,
          })}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        {/* Desktop sidebar */}
        <aside className="hidden h-fit flex-col gap-1 rounded-xl border border-subtle bg-bg-secondary p-2 lg:flex">
          <span className="flex items-center gap-2 rounded-lg bg-bg-tertiary px-3 py-2 text-[13px] font-semibold text-content-primary">
            <Briefcase className="h-4 w-4 text-accent-blue" />
            {t("dashboard", "positions")}
          </span>
          <Link
            href="/profit"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-content-secondary transition-colors hover:bg-bg-tertiary hover:text-content-primary"
          >
            <LineChart className="h-4 w-4" />
            {t("dashboard", "profitAndLoss")}
          </Link>
          <div className="mt-2 border-t border-subtle px-3 py-2">
            <p className="text-[11px] text-content-secondary">{t("dashboard", "openPositions")}</p>
            <p className="tnum text-[15px] font-bold text-content-primary">{open.length}</p>
            <p className="mt-2 text-[11px] text-content-secondary">{t("dashboard", "resolved")}</p>
            <p className="tnum text-[15px] font-bold text-content-primary">{settled.length}</p>
          </div>
        </aside>

        <div className="flex flex-col gap-4">
          <section>
            <h2 className="mb-3 text-[15px] font-bold text-content-primary">
              {t("dashboard", "activePositions")}
            </h2>

            {open.length === 0 ? (
              <p className="rounded-xl border border-subtle bg-bg-secondary p-8 text-center text-[13px] text-content-secondary">
                {t("empty", "noOpenPositions")}
              </p>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-x-auto rounded-xl border border-subtle bg-bg-secondary px-4 pb-2 sm:block">
                  <table className="w-full min-w-[720px]">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wide text-content-secondary">
                        <th className="py-3 pr-3 text-left font-semibold">{t("dashboard", "market")}</th>
                        <th className="py-3 pr-3 text-left font-semibold">{t("dashboard", "outcome")}</th>
                        <th className="py-3 pr-3 text-right font-semibold">{t("dashboard", "sharesCol")}</th>
                        <th className="py-3 pr-3 text-right font-semibold">{t("dashboard", "avg")}</th>
                        <th className="py-3 pr-3 text-right font-semibold">{t("dashboard", "last")}</th>
                        <th className="py-3 pr-3 text-right font-semibold">{t("dashboard", "value")}</th>
                        <th className="py-3 text-right font-semibold">{t("dashboard", "pnl")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {open.map((row) => (
                        <PositionRow key={row.key} row={row} />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="flex flex-col gap-3 sm:hidden">
                  {open.map((row) => (
                    <PositionCard key={row.key} row={row} />
                  ))}
                </div>
              </>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-[15px] font-bold text-content-primary">
              {t("dashboard", "resolvedHistory")}
            </h2>
            {settled.length === 0 ? (
              <p className="rounded-xl border border-subtle bg-bg-secondary p-8 text-center text-[13px] text-content-secondary">
                {t("empty", "nothingResolved")}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {settled.map((row) => (
                  <div
                    key={row.key}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-subtle bg-bg-secondary p-3.5"
                  >
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase",
                        row.resolved === "won"
                          ? "bg-accent-green/15 text-accent-green"
                          : "bg-accent-red/15 text-accent-red"
                      )}
                    >
                      {row.resolved}
                    </span>
                    <Link
                      href={`/market/${row.market.slug}`}
                      className="min-w-0 flex-1 truncate text-[13px] font-semibold text-content-primary transition-colors hover:text-accent-blue"
                    >
                      {getMarketText(row.market, locale).title}
                    </Link>
                    <span className="tnum shrink-0 text-[12px] text-content-secondary">
                      {row.outcomeLabel} @ {row.avgPrice.toFixed(2)} ·{" "}
                      {formatPercent(row.lastPrice)}
                    </span>
                    <span
                      className={cn(
                        "tnum shrink-0 text-[13px] font-bold",
                        row.pnl >= 0 ? "text-accent-green" : "text-accent-red"
                      )}
                    >
                      {row.pnl >= 0 ? "+" : "-"}
                      {formatRupees(Math.abs(row.pnl), 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
