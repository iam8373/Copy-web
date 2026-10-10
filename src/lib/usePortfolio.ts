"use client";

import { useMemo } from "react";
import { useMarketStore } from "@/store/useMarketStore";
import type { Market } from "@/lib/types";

export interface EnrichedPosition {
  key: string;
  market: Market;
  outcomeLabel: string;
  shares: number;
  avgPrice: number;
  lastPrice: number;
  cost: number;
  value: number;
  pnl: number;
  pnlPct: number;
  resolved?: "won" | "lost";
}

/**
 * Joins the user's positions (from the database, B5) with live market prices.
 * Unrealised P&L uses current prices; realised P&L comes from resolved
 * positions (the database's realized_pnl once a market settles).
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

      // A resolved position settles at 1 (won) or 0 (lost).
      const lastPrice = p.resolved ? (p.resolved === "won" ? 1 : 0) : outcome.price;
      const cost = p.shares * p.avgPrice;
      const value = p.shares * lastPrice;

      rows.push({
        key: `${p.marketId}_${p.outcomeId}_${i}`,
        market,
        outcomeLabel: outcome.label,
        shares: p.shares,
        avgPrice: p.avgPrice,
        lastPrice,
        cost,
        value,
        pnl: p.resolved && p.realizedPnl !== undefined && p.realizedPnl !== 0 ? p.realizedPnl : value - cost,
        pnlPct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
        resolved: p.resolved,
      });
    });

    const open = rows.filter((r) => !r.resolved);
    const settled = rows.filter((r) => r.resolved);

    const portfolioValue = open.reduce((s, r) => s + r.value, 0);
    const investedOpen = open.reduce((s, r) => s + r.cost, 0);
    const unrealized = portfolioValue - investedOpen;
    const realized = settled.reduce((s, r) => s + r.pnl, 0);

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
