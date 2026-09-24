"use client";

import { useEffect } from "react";
import { restoreSession, useMarketStore } from "@/store/useMarketStore";

/** Simulates live CLOB movement by nudging odds every few seconds. */
export function LiveTicker() {
  const tick = useMarketStore((s) => s.tick);

  useEffect(() => {
    restoreSession();
  }, []);

  useEffect(() => {
    const id = setInterval(tick, 6000);
    return () => clearInterval(id);
  }, [tick]);

  return null;
}
