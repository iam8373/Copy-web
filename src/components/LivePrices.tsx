"use client";

import { useEffect } from "react";
import { useMarketStore } from "@/store/useMarketStore";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { REALTIME_ENABLED, supabaseConfigured } from "@/lib/supabase/config";

/** Poll interval for the fallback, and only while the tab is visible. */
const POLL_MS = 20_000;

/**
 * Live prices (B3). Supabase Realtime pushes outcome price changes (public
 * table, publishable key, read-only); a light poll of GET /api/prices runs as
 * a fallback, so prices stay fresh even where Realtime is unavailable.
 * FlashValue shows each change. Replaces the old client-side random jitter.
 */
export function LivePrices() {
  useEffect(() => {
    if (!supabaseConfigured) return;
    const apply = useMarketStore.getState().applyPrices;

    let channel: ReturnType<ReturnType<typeof getBrowserSupabase>["channel"]> | null = null;
    if (REALTIME_ENABLED) {
      try {
        const supabase = getBrowserSupabase();
        channel = supabase
          .channel("public:outcomes:prices")
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "outcomes" }, (payload) => {
            const row = payload.new as { id?: string; price?: number | string };
            if (row.id && row.price !== undefined) apply({ [row.id]: Number(row.price) });
          })
          .subscribe();
      } catch {
        channel = null; // Realtime unavailable: polling covers it.
      }
    }

    let stopped = false;
    const poll = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/prices", { cache: "no-store" });
        if (res.ok) apply(((await res.json()) as { prices: Record<string, number> }).prices ?? {});
      } catch {
        /* offline: try again next tick */
      }
    };
    const id = setInterval(poll, POLL_MS);
    const onVisible = () => void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void channel.unsubscribe();
    };
  }, []);

  return null;
}
