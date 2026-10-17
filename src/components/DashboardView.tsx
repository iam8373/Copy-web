"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight, Briefcase, LineChart, LogIn, Receipt, Wallet } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import type { LedgerRow, OrderRow, PortfolioPage } from "@/store/useMarketStore";
import { usePortfolio, type EnrichedPosition } from "@/lib/usePortfolio";
import { useOutcomeLabel } from "@/lib/market-text";
import { buttonClasses } from "@/components/ui";
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
    <div className="rounded-card border border-subtle bg-surface-2 p-4">
      <p className="text-12 font-medium text-secondary">{label}</p>
      <p
        className={cn(
          "tnum mt-1 text-xl font-bold",
          tone === "up" && "text-success",
          tone === "down" && "text-danger",
          !tone && "text-primary"
        )}
      >
        {value}
      </p>
      {sub && <p className="tnum mt-1 text-12 text-secondary">{sub}</p>}
    </div>
  );
}

const RESULT_KEY = { won: "resultWon", lost: "resultLost", void: "resultVoid" } as const;

/** Label of a position's outcome in the active language. */
function useRowOutcome(row: EnrichedPosition) {
  const ol = useOutcomeLabel();
  const o = row.market.outcomes.find((x) => x.id === row.outcomeId);
  return o ? ol(o) : row.outcomeLabel;
}

/** Opens the market on the Sell tab with this outcome selected (S1). */
function SellLink({ row }: { row: EnrichedPosition }) {
  const { t } = useT();
  return (
    <Link
      href={`/market/${row.market.slug}?side=sell&outcome=${row.outcomeId}`}
      data-testid="position-sell"
      aria-label={t("dashboard", "sellPosition", { outcome: useRowOutcome(row) })}
      className={buttonClasses({ variant: "secondary", size: "sm" })}
    >
      {t("dashboard", "sell")}
    </Link>
  );
}

function PositionRow({ row }: { row: EnrichedPosition }) {
  const text = useMarketText(row.market);
  const outcomeLabel = useRowOutcome(row);
  const up = row.pnl >= 0;
  return (
    <tr className="border-t border-subtle">
      <td className="max-w-80 py-3 pr-3">
        <Link
          href={`/market/${row.market.slug}`}
          className="line-clamp-2 text-13 font-semibold text-primary transition-colors hover:text-brand"
        >
          {text.title}
        </Link>
        <p className="mt-1 text-11 uppercase tracking-wide text-secondary">
          {row.market.category} • {row.market.subcategory}
        </p>
      </td>
      <td className="py-3 pr-3">
        <span className="rounded-chip bg-surface-3 px-2 py-1 text-12 font-semibold text-primary">
          {outcomeLabel}
        </span>
      </td>
      <td className="tnum py-3 pr-3 text-right text-13 text-primary">
        {Math.round(row.shares).toLocaleString("en-IN")}
      </td>
      <td className="tnum py-3 pr-3 text-right text-13 text-secondary">
        {row.avgPrice.toFixed(2)}
      </td>
      <td className="tnum py-3 pr-3 text-right text-13 text-primary">
        {row.lastPrice.toFixed(2)}
      </td>
      <td className="tnum py-3 pr-3 text-right text-13 text-primary">
        {formatRupees(row.value, 0)}
      </td>
      <td
        className={cn(
          "tnum py-3 text-right text-13 font-semibold",
          up ? "text-success" : "text-danger"
        )}
      >
        {up ? "+" : "-"}
        {formatRupees(Math.abs(row.pnl), 0)}
        <span className="ml-1 text-11 font-medium opacity-80">
          ({up ? "+" : ""}
          {row.pnlPct.toFixed(1)}%)
        </span>
      </td>
      <td className="py-3 pl-3 text-right">
        <SellLink row={row} />
      </td>
    </tr>
  );
}

function PositionCard({ row }: { row: EnrichedPosition }) {
  const { t } = useT();
  const text = useMarketText(row.market);
  const outcomeLabel = useRowOutcome(row);
  const up = row.pnl >= 0;
  return (
    <div className="flex flex-col gap-2 rounded-card border border-subtle bg-surface-2 p-4" data-testid="position-card">
      <span className="text-11 font-semibold uppercase tracking-wide text-secondary">
        {row.market.category} • {row.market.subcategory}
      </span>
      <Link href={`/market/${row.market.slug}`} className="line-clamp-2 text-14 font-bold leading-snug text-primary hover:text-brand">
        {text.title}
      </Link>
      <div className="flex items-center gap-2">
        <span className="rounded-chip bg-surface-3 px-2 py-1 text-12 font-semibold text-primary">{outcomeLabel}</span>
        <span className="tnum text-12 text-secondary">
          {t("dashboard", "sharesHeld", { count: row.shares.toFixed(1) })} @ {row.avgPrice.toFixed(2)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-subtle pt-2">
        <span className="tnum text-12 text-secondary">
          {t("dashboard", "value")} {formatRupees(row.value, 0)}
        </span>
        <span className={cn("tnum text-13 font-bold", up ? "text-success" : "text-danger")}>
          {up ? "+" : "-"}
          {formatRupees(Math.abs(row.pnl), 0)}
        </span>
        <SellLink row={row} />
      </div>
    </div>
  );
}

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function Pager({ page, total, onPage, testId }: { page: number; total: number; onPage: (p: number) => void; testId: string }) {
  const { t } = useT();
  const pages = Math.max(1, Math.ceil(total / 10));
  if (pages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-between gap-2" data-testid={testId}>
      <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {t("dashboard", "prev")}
      </Button>
      <span className="tnum text-12 text-secondary">{t("dashboard", "pageOf", { page, pages })}</span>
      <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {t("dashboard", "next")}
      </Button>
    </div>
  );
}

const LEDGER_LABEL: Record<string, "ledgerSignup" | "ledgerTrade" | "ledgerSale" | "ledgerPayout" | "ledgerRefund" | "ledgerAdjustment"> = {
  signup_credit: "ledgerSignup",
  trade: "ledgerTrade",
  sale: "ledgerSale",
  payout: "ledgerPayout",
  refund: "ledgerRefund",
  admin_adjustment: "ledgerAdjustment",
};

function SettledOutcome({ row }: { row: EnrichedPosition }) {
  return <>{useRowOutcome(row)}</>;
}

function History({ orders, ledger }: { orders: PortfolioPage<OrderRow>; ledger: PortfolioPage<LedgerRow> }) {
  const { t, locale } = useT();
  const ol = useOutcomeLabel();
  const markets = useMarketStore((s) => s.markets);
  const load = useMarketStore((s) => s.loadPortfolio);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section data-testid="orders-section">
        <h2 className="mb-3 text-16 font-bold text-primary">{t("dashboard", "ordersTitle")}</h2>
        {orders.rows.length === 0 ? (
          <EmptyState size="compact" icon={Receipt} title={t("dashboard", "noOrders")} />
        ) : (
          <ul className="flex flex-col divide-y divide-subtle rounded-card border border-subtle bg-surface-2">
            {orders.rows.map((o) => {
              const m = markets.find((x) => x.id === o.marketId);
              const oc = m?.outcomes.find((x) => x.id === o.outcomeId);
              const label = oc ? ol(oc) : "";
              const sold = o.side === "sell";
              return (
                <li key={o.id} className="flex flex-col gap-1 p-3 text-13" data-testid="order-row" data-side={o.side}>
                  <span className="truncate font-semibold text-primary">{m ? getMarketText(m, locale).title : "—"}</span>
                  <span className="tnum flex flex-wrap gap-x-3 text-12 text-secondary">
                    <span className={cn("font-semibold", sold ? "text-danger" : "text-success")}>
                      {t("dashboard", sold ? "sideSell" : "sideBuy")}
                    </span>
                    <span>{label}</span>
                    <span>{sold ? `+${formatRupees(o.amount)}` : formatRupees(o.amount)}</span>
                    <span>{t("trade", "shares", { count: o.shares.toFixed(1) })}</span>
                    <span>@ {o.avgPrice.toFixed(2)}</span>
                    <span className="ml-auto">{fmtWhen(o.at)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <Pager page={orders.page} total={orders.total} onPage={(p) => void load({ ordersPage: p })} testId="orders-pager" />
      </section>

      <section data-testid="ledger-section">
        <h2 className="mb-3 text-16 font-bold text-primary">{t("dashboard", "ledgerTitle")}</h2>
        {ledger.rows.length === 0 ? (
          <EmptyState size="compact" icon={Wallet} title={t("dashboard", "noLedger")} />
        ) : (
          <ul className="flex flex-col divide-y divide-subtle rounded-card border border-subtle bg-surface-2">
            {ledger.rows.map((l) => (
              <li key={l.id} className="flex items-center gap-3 p-3 text-13" data-testid="ledger-row">
                <span className="min-w-0 flex-1 truncate text-primary">{t("dashboard", LEDGER_LABEL[l.type] ?? "ledgerAdjustment")}</span>
                <span className="tnum text-12 text-secondary">{fmtWhen(l.at)}</span>
                <span className={cn("tnum w-24 text-right font-semibold", l.amount >= 0 ? "text-success" : "text-primary")}>
                  {l.amount >= 0 ? "+" : "-"}
                  {formatRupees(Math.abs(l.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Pager page={ledger.page} total={ledger.total} onPage={(p) => void load({ ledgerPage: p })} testId="ledger-pager" />
      </section>
    </div>
  );
}

export function DashboardView() {
  const { t, locale } = useT();
  const session = useMarketStore((s) => s.session);
  const setAuthOpen = useMarketStore((s) => s.setAuthOpen);
  const wallet = useMarketStore((s) => s.wallet);
  const orders = useMarketStore((s) => s.orders);
  const ledger = useMarketStore((s) => s.ledger);
  const loadPortfolio = useMarketStore((s) => s.loadPortfolio);

  // Fresh numbers whenever the dashboard opens (the store may be minutes old).
  useEffect(() => {
    if (session) void loadPortfolio();
  }, [session, loadPortfolio]);
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
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            {t("dashboard", "title")}
          </h1>
          <p className="mt-1 text-13 text-secondary">
            {session
              ? t("dashboard", "signedInAs", { handle: session.handle })
              : t("dashboard", "signedOutNote")}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Link
            href="/profit"
            className="flex items-center gap-1.5 rounded-btn border border-subtle bg-surface-2 px-3 py-2 text-13 font-semibold text-primary transition-colors hover:border-brand"
          >
            {t("dashboard", "pnlBreakdown")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          {!session && (
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="flex items-center gap-1.5 rounded-btn bg-brand-fill px-3 py-2 text-13 font-semibold text-white transition-colors hover:bg-brand-fill-hover"
            >
              <LogIn className="h-3.5 w-3.5" />
              {t("header", "signInShort")}
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label={t("dashboard", "wallet")}
          value={session && wallet !== null ? formatRupees(wallet, 0) : "—"}
        />
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
        <aside className="hidden h-fit flex-col gap-1 rounded-card border border-subtle bg-surface-2 p-2 lg:flex">
          <span className="flex items-center gap-2 rounded-btn bg-surface-3 px-3 py-2 text-13 font-semibold text-primary">
            <Briefcase className="h-4 w-4 text-brand" />
            {t("dashboard", "positions")}
          </span>
          <Link
            href="/profit"
            className="flex items-center gap-2 rounded-btn px-3 py-2 text-13 font-semibold text-secondary transition-colors hover:bg-surface-3 hover:text-primary"
          >
            <LineChart className="h-4 w-4" />
            {t("dashboard", "profitAndLoss")}
          </Link>
          <div className="mt-2 border-t border-subtle px-3 py-2">
            <p className="text-11 text-secondary">{t("dashboard", "openPositions")}</p>
            <p className="tnum text-16 font-bold text-primary">{open.length}</p>
            <p className="mt-2 text-11 text-secondary">{t("dashboard", "resolved")}</p>
            <p className="tnum text-16 font-bold text-primary">{settled.length}</p>
          </div>
        </aside>

        <div className="flex flex-col gap-4">
          <section>
            <h2 className="mb-3 text-16 font-bold text-primary">
              {t("dashboard", "activePositions")}
            </h2>

            {open.length === 0 ? (
              <p className="rounded-card border border-subtle bg-surface-2 p-8 text-center text-13 text-secondary">
                {t("empty", "noOpenPositions")}
              </p>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-x-auto rounded-card border border-subtle bg-surface-2 px-4 pb-2 sm:block">
                  <table className="w-full min-w-table">
                    <thead>
                      <tr className="text-11 uppercase tracking-wide text-secondary">
                        <th className="py-3 pr-3 text-left font-semibold">{t("dashboard", "market")}</th>
                        <th className="py-3 pr-3 text-left font-semibold">{t("dashboard", "outcome")}</th>
                        <th className="py-3 pr-3 text-right font-semibold">{t("dashboard", "sharesCol")}</th>
                        <th className="py-3 pr-3 text-right font-semibold">{t("dashboard", "avg")}</th>
                        <th className="py-3 pr-3 text-right font-semibold">{t("dashboard", "last")}</th>
                        <th className="py-3 pr-3 text-right font-semibold">{t("dashboard", "value")}</th>
                        <th className="py-3 text-right font-semibold">{t("dashboard", "pnl")}</th>
                        <th className="py-3 pl-3 text-right font-semibold">
                          <span className="sr-only">{t("dashboard", "actions")}</span>
                        </th>
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
            <h2 className="mb-3 text-16 font-bold text-primary">
              {t("dashboard", "resolvedHistory")}
            </h2>
            {settled.length === 0 ? (
              <p className="rounded-card border border-subtle bg-surface-2 p-8 text-center text-13 text-secondary">
                {t("empty", "nothingResolved")}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {settled.map((row) => (
                  <div
                    key={row.key}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-subtle bg-surface-2 p-4"
                  >
                    <span
                      className={cn(
                        "rounded-chip px-1.5 py-1 text-11 font-bold uppercase",
                        row.resolved === "won"
                          ? "bg-success/15 text-success"
                          : row.resolved === "void"
                            ? "bg-surface-3 text-secondary"
                            : "bg-danger/15 text-danger"
                      )}
                    >
                      {row.resolved ? t("dashboard", RESULT_KEY[row.resolved]) : null}
                    </span>
                    <Link
                      href={`/market/${row.market.slug}`}
                      className="min-w-0 flex-1 truncate text-13 font-semibold text-primary transition-colors hover:text-brand"
                    >
                      {getMarketText(row.market, locale).title}
                    </Link>
                    <span className="tnum shrink-0 text-12 text-secondary">
                      <SettledOutcome row={row} /> @ {row.avgPrice.toFixed(2)} ·{" "}
                      {formatPercent(row.lastPrice)}
                    </span>
                    <span
                      className={cn(
                        "tnum shrink-0 text-13 font-bold",
                        row.pnl >= 0 ? "text-success" : "text-danger"
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

      {session && <History orders={orders} ledger={ledger} />}
    </div>
  );
}
