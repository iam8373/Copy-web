import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Category, Market, NavSlug, SavedMarketText } from "@/lib/types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/supabase/config";

/**
 * Market read path (backend B3). Public data only, read with the publishable
 * key and NO user session, so results are identical for everyone and can be
 * cached: many readers do not mean many database reads. RLS hides drafts.
 *
 * Cache tags: "markets" (catalogue, 30 s), "prices" (live prices, 5 s) and
 * `history:<marketId>` (charts, 30 s). place_order and admin edits call
 * revalidateTag so changes show up immediately.
 *
 * Every function returns a Result so pages can show an "unavailable" state
 * instead of crashing when the database cannot be reached. Nothing here runs
 * at build time (pages are dynamic).
 */

export type Result<T> = { ok: true; data: T } | { ok: false };

export const MARKETS_TAG = "markets";
export const PRICES_TAG = "prices";
export const historyTag = (marketId: string) => `history:${marketId}`;

function publicClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

const MARKET_COLUMNS =
  "id, slug, title, description, category, subcategory, end_date, is_live, is_featured, resolution_source, status, is_binary, total_volume, volume_change_24h, region, tags, " +
  "outcomes!outcomes_market_id_fkey(id, label, price, sort_order), market_translations(locale, title, description, status, source_hash)";

type Row = Database["public"]["Tables"]["markets"]["Row"] & {
  outcomes: Array<{ id: string; label: string; price: number; sort_order: number }>;
  market_translations: Array<{ locale: string; title: string; description: string; status: string; source_hash: string }>;
};

const round4 = (n: number) => Math.round(n * 10000) / 10000;

function toMarket(r: Row, ref: Map<string, number>, vol24: Map<string, number>): Market {
  const outcomes = [...r.outcomes]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((o) => {
      const price = Number(o.price);
      const refPrice = ref.get(o.id) ?? price;
      return { id: o.id, label: o.label, price, refPrice, change24h: round4(price - refPrice), volume: 0 };
    });
  const translations: Record<string, SavedMarketText> = {};
  for (const t of r.market_translations ?? []) {
    translations[t.locale] = {
      title: t.title,
      description: t.description,
      sourceHash: t.source_hash,
      status: t.status === "reviewed" ? "reviewed" : "machine-drafted",
    };
  }
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    category: r.category as Category,
    subcategory: r.subcategory,
    endDate: r.end_date,
    isLive: r.is_live,
    totalVolume: Number(r.total_volume),
    // Seeded 24 h figure plus real orders in the last 24 h.
    volumeChange24h: Number(r.volume_change_24h) + (vol24.get(r.id) ?? 0),
    outcomes,
    resolutionSource: r.resolution_source,
    isBinary: r.is_binary,
    currency: "INR",
    region: r.region,
    tags: r.tags ?? [],
    status: r.status as Market["status"],
    translations,
  };
}

async function loadMarkets(): Promise<Market[]> {
  const db = publicClient();
  const [markets, ref, vol] = await Promise.all([
    db.from("markets").select(MARKET_COLUMNS).neq("status", "draft").order("total_volume", { ascending: false }),
    db.rpc("outcome_prices_24h_ago"),
    db.rpc("market_volume_24h"),
  ]);
  if (markets.error) throw new Error(`markets: ${markets.error.code ?? "error"}`);
  const refMap = new Map((ref.data ?? []).map((x) => [x.outcome_id, Number(x.price)]));
  const volMap = new Map((vol.data ?? []).map((x) => [x.market_id, Number(x.volume)]));
  return (markets.data as unknown as Row[]).map((r) => toMarket(r, refMap, volMap));
}

const cachedMarkets = unstable_cache(loadMarkets, ["markets:all:v1"], { revalidate: 30, tags: [MARKETS_TAG] });

async function safe<T>(fn: () => Promise<T>): Promise<Result<T>> {
  if (!supabaseConfigured) return { ok: false };
  try {
    return { ok: true, data: await fn() };
  } catch {
    // Unreachable database or a query error: callers show the unavailable state.
    return { ok: false };
  }
}

/** Every public (non-draft) market, highest volume first. */
export function getMarkets(): Promise<Result<Market[]>> {
  return safe(cachedMarkets);
}

/** One market by slug, or ok with null when it does not exist. */
export async function getMarket(slug: string): Promise<Result<Market | null>> {
  const all = await getMarkets();
  if (!all.ok) return all;
  return { ok: true, data: all.data.find((m) => m.slug === slug) ?? null };
}

/** A category page's markets; "live" means is_live (Live tab unchanged). */
export async function getCategoryMarkets(slug: NavSlug): Promise<Result<Market[]>> {
  const all = await getMarkets();
  if (!all.ok) return all;
  return { ok: true, data: all.data.filter((m) => (slug === "live" ? m.isLive : m.category === slug)) };
}

/** Plain-text search over titles, categories and sub-categories (English). */
export async function searchMarkets(query: string, limit = 10): Promise<Result<Market[]>> {
  const all = await getMarkets();
  if (!all.ok) return all;
  const q = query.trim().toLowerCase();
  if (!q) return { ok: true, data: all.data.slice(0, limit) };
  return {
    ok: true,
    data: all.data
      .filter((m) => `${m.title} ${m.category} ${m.subcategory}`.toLowerCase().includes(q))
      .slice(0, limit),
  };
}

export interface HistoryPoint {
  t: number;
  /** outcome id → probability 0–100 */
  prices: Record<string, number>;
}

async function loadHistory(marketId: string): Promise<HistoryPoint[]> {
  const db = publicClient();
  const { data, error } = await db
    .from("price_history")
    .select("outcome_id, price, at")
    .eq("market_id", marketId)
    .order("at", { ascending: true })
    .limit(5000);
  if (error) throw new Error(`price_history: ${error.code ?? "error"}`);
  const byTime = new Map<number, Record<string, number>>();
  for (const row of data ?? []) {
    const t = Date.parse(row.at);
    const point = byTime.get(t) ?? {};
    point[row.outcome_id] = Math.round(Number(row.price) * 1000) / 10;
    byTime.set(t, point);
  }
  return Array.from(byTime.entries()).sort((a, b) => a[0] - b[0]).map(([t, prices]) => ({ t, prices }));
}

/** Recorded price history for a market's chart (real data, not generated). */
export function getPriceHistory(marketId: string): Promise<Result<HistoryPoint[]>> {
  return safe(() =>
    unstable_cache(() => loadHistory(marketId), ["history:v1", marketId], {
      revalidate: 30,
      tags: [historyTag(marketId), MARKETS_TAG],
    })()
  );
}

async function loadPrices(): Promise<Record<string, number>> {
  const { data, error } = await publicClient().from("outcomes").select("id, price");
  if (error) throw new Error(`outcomes: ${error.code ?? "error"}`);
  return Object.fromEntries((data ?? []).map((o) => [o.id, Number(o.price)]));
}

const cachedPrices = unstable_cache(loadPrices, ["prices:v1"], { revalidate: 5, tags: [PRICES_TAG] });

/** Current price of every public outcome (the live-price polling fallback). */
export function getLivePrices(): Promise<Result<Record<string, number>>> {
  return safe(cachedPrices);
}
