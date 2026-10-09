"use client";

import { useEffect, useRef } from "react";
import type { Market } from "@/lib/types";
import { useMarketStore } from "@/store/useMarketStore";

/**
 * Puts the server-fetched market catalogue into the store before anything
 * that reads it renders (it sits before them in the layout), so the server
 * HTML and the first client render match.
 *
 * During SSR the store is a module-level singleton shared by concurrent
 * requests. That is acceptable ONLY because markets are public and identical
 * for everyone (the same cached query). Never set per-user state here.
 */
export function MarketsHydrator({ markets, ok }: { markets: Market[]; ok: boolean }) {
  const done = useRef(false);
  if (!done.current) {
    useMarketStore.setState({ markets, marketsStatus: ok ? "ready" : "error" });
    done.current = true;
  }
  // A router.refresh() (e.g. after an order) re-renders the layout with fresh
  // data; take it, unless the refresh itself failed.
  useEffect(() => {
    if (ok) useMarketStore.setState({ markets, marketsStatus: "ready" });
  }, [markets, ok]);
  return null;
}
