"use client";

import { useMemo } from "react";
import { useMarketStore } from "@/store/useMarketStore";
import type { Market } from "@/lib/types";

export interface EnrichedPosition {
  key: string;
  market: Market;
  outcomeId: string;
  outcomeLabel: string;
  shares: number;
  avgPrice: number;
  lastPrice: number;
  cost: number;
  value: number;
  pnl: number;
  pnlPct: number;
  /** Realized so far (sales; lifetime total once settled). */
  realizedPnl: number;
  /** Everything for this position: settled lifetime P&L, or unrealised + sales. */
  totalPnl: number;
  resolved?: "won" | "lost" | "void";
}

/**
 * Joins the user's positions (from the database, B5) with live market prices.
 *  - Open (unsettled, shares > 0): unrealised P&L = value - cost of the
 *    remaining shares at current prices; their sales so far are realised.
 *  - Sold out but unsettled: realised P&L from the sales only.
 *  - Settled (won / lost / void): realised P&L is the database's lifetime
 *    realized_pnl (sales + payout or refund - cost), set at settlement (S1).
 */
export function usePortfolio() {
  const positions = useMarketStore((s) => s.positions);
  const markets = useMarketStore((s) => s.markets);

  return useMemo(() => {
    const rows: EnrichedPosition[] = [];

    positions.forEach((p, i) => {
      const market = markets.find((m) => m.id === p.marketId);
      if (!market) return;
      const outcome =
        market.outcomes.find((o) => o.id === p.outcomeId) ?? market.outcomes[0];

      // A resolved position settles at 1 (won) or 0 (lost or void).
      const lastPrice = p.resolved ? (p.resolved === "won" ? 1 : 0) : outcome.price;
      const cost = p.shares * p.avgPrice;
      const value = p.shares * lastPrice;
      const realizedPnl = p.realizedPnl ?? 0;

      rows.push({
        key: `${p.marketId}_${p.outcomeId}_${i}`,
        market,
        outcomeId: outcome.id,
        outcomeLabel: outcome.label,
        shares: p.shares,
        avgPrice: p.avgPrice,
        lastPrice,
        cost,
        value,
        pnl: p.resolved ? realizedPnl : value - cost,
        pnlPct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
        realizedPnl,
        totalPnl: p.resolved ? realizedPnl : value - cost + realizedPnl,
        resolved: p.resolved,
      });
    });

    const open = rows.filter((r) => !r.resolved && r.shares > 0);
    const settled = rows.filter((r) => r.resolved);

    const portfolioValue = open.reduce((s, r) => s + r.value, 0);
    const investedOpen = open.reduce((s, r) => s + r.cost, 0);
    const unrealized = portfolioValue - investedOpen;
    // Settled: lifetime P&L. Unsettled (open or sold out): sales so far.
    const realized = rows.reduce((s, r) => s + (r.resolved ? r.pnl : r.realizedPnl), 0);

    return {
      rows,
      open,
      settled,
      portfolioValue,
      investedOpen,
      unrealized,
      realized,
      netPnl: unrealized + realized,
      wins: settled.filter((r) => r.resolved === "won").length,
      losses: settled.filter((r) => r.resolved === "lost").length,
    };
  }, [markets, positions]);
}
