/**
 * Market page data (work order 4, Phase 4). The UI only calls these three
 * functions, so switching to the Supabase backend is one function each:
 *
 *   getPriceHistory   → price_history table      (today: generated demo series)
 *   getOrderBook      → LMSR quotes from q and b (today: q derived from prices)
 *   getMarketActivity → orders table             (today: none — no fake rows)
 *
 * Pure and synchronous for now; they become async when they hit the network.
 */
import type { Market } from "@/lib/types";
import { costToBuy, prices, quantitiesForPrices, sharesForAmount } from "@/lib/lmsr";

// ---------------------------------------------------------------------------
// Price history
// ---------------------------------------------------------------------------

export const CHART_RANGES = ["1D", "1W", "1M", "ALL"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

const HOUR = 3600 * 1000;
/** Length of each range and the spacing of its points. */
const RANGE_SPEC: Record<ChartRange, { span: number; step: number }> = {
  "1D": { span: 24 * HOUR, step: HOUR / 2 },
  "1W": { span: 7 * 24 * HOUR, step: 3 * HOUR },
  "1M": { span: 30 * 24 * HOUR, step: 12 * HOUR },
  ALL: { span: 90 * 24 * HOUR, step: 36 * HOUR },
};

export interface PricePoint {
  /** Epoch ms. */
  t: number;
  /** Probability 0–100 per outcome id. */
  [outcomeId: string]: number;
}

export interface PriceHistory {
  points: PricePoint[];
  /** True while the series is generated rather than recorded trades. */
  isDemo: boolean;
}

/** Small deterministic PRNG so server and client render the same series. */
function rng(seedText: string) {
  let seed = 0;
  for (let i = 0; i < seedText.length; i++) seed = (seed * 31 + seedText.charCodeAt(i)) % 2147483647;
  return () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
}

/**
 * Probability history for every outcome over `range`. DEMO: a seeded random
 * walk that ends exactly at the current price, so the last point always
 * matches the trade panel. `now` is rounded to the hour so the server-rendered
 * and hydrated series agree.
 */
export function getPriceHistory(market: Market, range: ChartRange, now = Date.now()): PriceHistory {
  const { span, step } = RANGE_SPEC[range];
  const end = Math.floor(now / HOUR) * HOUR;
  const count = Math.round(span / step) + 1;

  const series = market.outcomes.map((o) => {
    const rand = rng(`${market.slug}:${o.id}:${range}`);
    // Walk backwards from today's price, then reverse.
    const out = [o.price];
    let v = o.price;
    const vol = 0.012 * Math.sqrt(step / HOUR);
    for (let i = 1; i < count; i++) {
      const drift = (rand() - 0.5) * 2 * vol;
      v = Math.min(0.97, Math.max(0.02, v + drift));
      out.push(v);
    }
    return out.reverse();
  });

  const points: PricePoint[] = Array.from({ length: count }, (_, i) => {
    const p: PricePoint = { t: end - (count - 1 - i) * step };
    market.outcomes.forEach((o, j) => {
      p[o.id] = Number((series[j][i] * 100).toFixed(1));
    });
    return p;
  });
  // The last point is the live price, not the rounded hour's.
  const last = points[points.length - 1];
  market.outcomes.forEach((o) => (last[o.id] = Number((o.price * 100).toFixed(1))));
  return { points, isDemo: true };
}

// ---------------------------------------------------------------------------
// Order book (AMM quote ladder)
// ---------------------------------------------------------------------------

/**
 * Fallback liquidity parameter when a market does not carry its own `b`
 * (markets from the database do). Owner decision: 20,000 (D-017).
 */
export const DEFAULT_LIQUIDITY_B = 20000;

/** Order sizes shown in the ladder, in shares. */
export const LADDER_SIZES = [10, 50, 100, 500] as const;

export interface QuoteRow {
  shares: number;
  /** Total cost in ₹ to buy `shares` now. */
  cost: number;
  /** cost / shares, in ₹ per share (0–1). */
  avgPrice: number;
  /** Outcome price after the order, 0–1. */
  priceAfter: number;
  /** priceAfter − current price, in percentage points. */
  impactPts: number;
}

export interface OrderBook {
  outcomeId: string;
  price: number;
  liquidityB: number;
  rows: QuoteRow[];
}

/**
 * There are no resting orders: an LMSR market maker quotes every trade. This
 * returns what buying each ladder size of one outcome would cost right now.
 */
export function getOrderBook(market: Market, outcomeId: string, b = DEFAULT_LIQUIDITY_B): OrderBook {
  const idx = Math.max(0, market.outcomes.findIndex((o) => o.id === outcomeId));
  const shown = market.outcomes.map((o) => Math.max(o.price, 0.001));
  const total = shown.reduce((sum, p) => sum + p, 0);
  // Demo multi-outcome prices often sum to < 1 (the long tail isn't listed).
  // Model the missing mass as one extra "rest of field" outcome so quotes
  // start from the displayed price instead of a re-normalised one.
  const modelled = total < 0.999 ? [...shown, 1 - total] : shown;
  const { q, normalized } = quantitiesForPrices(modelled, b);
  const price = normalized[idx];
  const rows = LADDER_SIZES.map((shares) => {
    const cost = costToBuy(q, b, idx, shares);
    const next = q.slice();
    next[idx] += shares;
    const priceAfter = prices(next, b)[idx];
    return {
      shares,
      cost,
      avgPrice: cost / shares,
      priceAfter,
      impactPts: (priceAfter - price) * 100,
    };
  });
  return { outcomeId: market.outcomes[idx].id, price, liquidityB: b, rows };
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export interface ActivityItem {
  id: string;
  outcomeId: string;
  side: "buy" | "sell";
  shares: number;
  price: number;
  at: number;
}

/**
 * Recent trades. There is no trade feed until the backend lands, and invented
 * rows would misrepresent the market, so this is honestly empty.
 */
export function getMarketActivity(_market: Market): ActivityItem[] {
  return [];
}

/**
 * Shares an order of `amount` would buy now, from the same LMSR model the
 * database uses (place_order). An estimate: the price can move before the
 * order lands, and the server's fill is what counts.
 */
export function estimateShares(market: Market, outcomeId: string, amount: number): number {
  if (!(amount > 0)) return 0;
  const b = market.liquidityB ?? DEFAULT_LIQUIDITY_B;
  const idx = Math.max(0, market.outcomes.findIndex((o) => o.id === outcomeId));
  const shown = market.outcomes.map((o) => Math.max(o.price, 0.001));
  const total = shown.reduce((s, p) => s + p, 0);
  const modelled = total < 0.999 ? [...shown, 1 - total] : shown;
  const { q } = quantitiesForPrices(modelled, b);
  return Math.floor(sharesForAmount(q, b, idx, amount) * 1e8) / 1e8;
}
