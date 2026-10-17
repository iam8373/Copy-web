"use client";

import { useEffect, useRef } from "react";
import type { Market } from "@/lib/types";
import { MarketStoreContext, createMarketStore, type MarketStore } from "./useMarketStore";

/**
 * Creates the store for this tree with the server-fetched public catalogue
 * (S2). Rendered by the root layout, so it is created per request on the
 * server and once per page load in the browser; the server HTML and the
 * first client render therefore start from the same markets.
 *
 * Never pass per-user data here: it would be rendered into the server HTML.
 */
export function MarketStoreProvider({
  markets,
  ok,
  children,
}: {
  markets: Market[];
  ok: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<MarketStore | null>(null);
  if (!ref.current) ref.current = createMarketStore({ markets, marketsStatus: ok ? "ready" : "error" });

  // A router.refresh() re-renders the layout with fresh data; take it,
  // unless the refresh itself failed. Live prices keep updating meanwhile.
  useEffect(() => {
    if (ok) ref.current!.setState({ markets, marketsStatus: "ready" });
  }, [markets, ok]);

  return (
    <MarketStoreContext.Provider value={ref.current}>
      {/* Machine-readable status for health checks and tests (no data in it). */}
      <span hidden data-testid="markets-status" data-status={ok ? "ready" : "error"} data-count={markets.length} />
      {children}
    </MarketStoreContext.Provider>
  );
}
