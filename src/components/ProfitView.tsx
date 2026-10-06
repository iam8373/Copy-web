"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePortfolio } from "@/lib/usePortfolio";
import { cn, formatRupees } from "@/lib/utils";
import { useT } from "@/i18n/LanguageProvider";
import { getMarketText } from "@/lib/market-text";
import { color, size, tooltipStyle } from "@/lib/tokens";

export function ProfitView() {
  const { t, locale } = useT();
  const { rows, open, settled, realized, unrealized, netPnl, wins, losses } = usePortfolio();

  const chartData = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.pnl - a.pnl)
        .slice(0, 8)
        .map((r) => ({
          name: (() => {
            const title = getMarketText(r.market, locale).title;
            return title.length > 22 ? `${title.slice(0, 22)}…` : title;
          })(),
          pnl: Math.round(r.pnl),
        })),
    [rows, locale]
  );

  const invested = rows.reduce((s, r) => s + r.cost, 0);
  const roi = invested > 0 ? (netPnl / invested) * 100 : 0;
  const settledTotal = wins + losses;
  const winRate = settledTotal > 0 ? (wins / settledTotal) * 100 : 0;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/dashboard"
        className="flex w-fit items-center gap-1 text-[13px] font-semibold text-content-secondary transition-colors hover:text-content-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("profit", "backToDashboard")}
      </Link>

      <header>
        <h1 className="text-2xl font-bold tracking-tight text-content-primary">
          {t("profit", "title")}
        </h1>
        <p className="mt-0.5 text-[13px] text-content-secondary">
          {t("profit", "subtitle")}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-subtle bg-bg-secondary p-4">
          <p className="text-[12px] font-medium text-content-secondary">{t("profit", "title")}</p>
          <p
            className={cn(
              "tnum mt-1 text-2xl font-bold",
              netPnl >= 0 ? "text-accent-green" : "text-accent-red"
            )}
          >
            {netPnl >= 0 ? "+" : "-"}
            {formatRupees(Math.abs(netPnl), 0)}
          </p>
          <p className="tnum mt-0.5 text-[12px] text-content-secondary">
            {t("profit", "roi", { value: `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%` })}
          </p>
        </div>
        <div className="rounded-xl border border-subtle bg-bg-secondary p-4">
          <p className="text-[12px] font-medium text-content-secondary">{t("dashboard", "resolved")}</p>
          <p
            className={cn(
              "tnum mt-1 text-2xl font-bold",
              realized >= 0 ? "text-accent-green" : "text-accent-red"
            )}
          >
            {realized >= 0 ? "+" : "-"}
            {formatRupees(Math.abs(realized), 0)}
          </p>
          <p className="tnum mt-0.5 text-[12px] text-content-secondary">
            {t("profit", "settled", { count: settled.length })}
          </p>
        </div>
        <div className="rounded-xl border border-subtle bg-bg-secondary p-4">
          <p className="text-[12px] font-medium text-content-secondary">{t("dashboard", "unrealised")}</p>
          <p
            className={cn(
              "tnum mt-1 text-2xl font-bold",
              unrealized >= 0 ? "text-accent-green" : "text-accent-red"
            )}
          >
            {unrealized >= 0 ? "+" : "-"}
            {formatRupees(Math.abs(unrealized), 0)}
          </p>
          <p className="tnum mt-0.5 text-[12px] text-content-secondary">
            {t("profit", "openCount", { count: open.length })}
          </p>
        </div>
        <div className="rounded-xl border border-subtle bg-bg-secondary p-4">
          <p className="text-[12px] font-medium text-content-secondary">{t("profit", "winRate")}</p>
          <p className="tnum mt-1 text-2xl font-bold text-content-primary">
            {winRate.toFixed(0)}%
          </p>
          <p className="tnum mt-0.5 text-[12px] text-content-secondary">
            {t("profit", "winLoss", { wins, losses })}
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-subtle bg-bg-secondary p-4">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-content-secondary">
          {t("profit", "byMarket")}
        </h2>
        <div className="mt-3 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 12, bottom: 48, left: 4 }}>
              <CartesianGrid stroke={color.borderSubtle} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: color.textSecondary, fontSize: size.axisFont }}
                stroke={color.borderSubtle}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={48}
              />
              <YAxis
                tick={{ fill: color.textSecondary, fontSize: size.axisFont }}
                stroke={color.borderSubtle}
                width={64}
                tickFormatter={(v) => `₹${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => [formatRupees(Number(v), 0), "P&L"]}
              />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {chartData.map((d) => (
                  <Cell key={d.name} fill={d.pnl >= 0 ? color.success : color.danger} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-bold text-content-primary">
          {t("profit", "perMarket")}
        </h2>
        <div className="flex flex-col gap-2">
          {rows
            .slice()
            .sort((a, b) => b.pnl - a.pnl)
            .map((row) => (
              <div
                key={row.key}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-subtle bg-bg-secondary p-3.5"
              >
                <span
                  className={cn(
                    "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase",
                    row.resolved
                      ? row.resolved === "won"
                        ? "bg-accent-green/15 text-accent-green"
                        : "bg-accent-red/15 text-accent-red"
                      : "bg-bg-tertiary text-content-secondary"
                  )}
                >
                  {row.resolved ?? "open"}
                </span>
                <Link
                  href={`/market/${row.market.slug}`}
                  className="min-w-0 flex-1 truncate text-[13px] font-semibold text-content-primary transition-colors hover:text-accent-blue"
                >
                  {getMarketText(row.market, locale).title}
                </Link>
                <span className="tnum shrink-0 text-[12px] text-content-secondary">
                  {row.outcomeLabel} · {Math.round(row.shares).toLocaleString("en-IN")} sh ·{" "}
                  {formatRupees(row.cost, 0)} in
                </span>
                <span
                  className={cn(
                    "tnum w-24 shrink-0 text-right text-[13px] font-bold",
                    row.pnl >= 0 ? "text-accent-green" : "text-accent-red"
                  )}
                >
                  {row.pnl >= 0 ? "+" : "-"}
                  {formatRupees(Math.abs(row.pnl), 0)}
                </span>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
