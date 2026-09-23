"use client";

import { useEffect } from "react";
import { useMarketStore } from "@/store/useMarketStore";

/** Simulates live CLOB movement by nudging odds every few seconds. */
export function LiveTicker() {
  const tick = useMarketStore((s) => s.tick);

  useEffect(() => {
    const id = setInterval(tick, 6000);
    return () => clearInterval(id);
  }, [tick]);

  return null;
}
