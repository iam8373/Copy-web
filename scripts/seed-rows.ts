/**
 * Pure builder: converts the static catalogue (src/data/markets.ts) and the
 * committed translations JSON into database rows. No I/O, so it is tested
 * directly. Only the seed script imports src/data/markets.ts at runtime.
 */
import { quantitiesForPrices } from "../src/lib/lmsr";
import type { Market } from "../src/lib/types";
import type { TranslationFile } from "../src/services/translation/types";

export interface SeedMarketRow {
  legacy_id: string;
  slug: string;
  title: string;
  description: string;
  category: Market["category"];
  subcategory: string;
  end_date: string;
  is_live: boolean;
  is_featured: boolean;
  resolution_source: string;
  status: "open" | "closed";
  is_binary: boolean;
  liquidity_b: number;
  total_volume: number;
  volume_change_24h: number;
  tags: string[];
  region: string;
}

export interface SeedOutcomeRow {
  legacy_market_id: string;
  label: string;
  sort_order: number;
  legacy_key: string;
  price: number;
  shares_outstanding: number;
  /** Seeded starting point for the 24 h change (price_history). */
  price_24h_ago: number;
}

export interface SeedTranslationRow {
  legacy_market_id: string;
  locale: string;
  title: string;
  description: string;
  source_hash: string;
  status: "machine-drafted" | "reviewed";
  translated_at: string;
}

const round = (n: number, dp: number) => Number(n.toFixed(dp));

/**
 * Markets seeded CLOSED on purpose, so the closed state (badge, disabled trade
 * panel, place_order refusal) is always testable. Everything else gets a
 * rolling end date relative to the seed date.
 */
export const CLOSED_FOR_TESTING = [
  "will-india-win-the-2026-t20-world-cup",
  "ipl-2026-winner",
  "ranji-trophy-2026-winner",
  "will-bjp-win-the-2026-west-bengal-assembly-elections",
] as const;

const DAY = 24 * 3600 * 1000;
/** Rolling window for open (non-live) markets: 3 to 180 days after the seed. */
const OPEN_FROM_DAYS = 3;
const OPEN_TO_DAYS = 180;

/**
 * End dates relative to the seed date, so seeding never produces a catalogue
 * of mostly expired markets:
 * - live markets keep the catalogue's relative times (hours ahead);
 * - CLOSED_FOR_TESTING end 7, 10, 13… days before the seed and are closed;
 * - all others are spread evenly across the next 3–180 days, in the order of
 *   their catalogue dates, at 18:30 UTC (midnight IST).
 */
export function rollingEndDates(markets: readonly Market[], now: Date): Map<string, { end: Date; closed: boolean }> {
  const out = new Map<string, { end: Date; closed: boolean }>();
  const closed = new Set<string>(CLOSED_FOR_TESTING);
  let c = 0;
  for (const m of markets) {
    if (m.isLive) out.set(m.id, { end: new Date(m.endDate), closed: false });
    else if (closed.has(m.slug)) out.set(m.id, { end: new Date(now.getTime() - (7 + 3 * c++) * DAY), closed: true });
  }
  const rest = markets
    .filter((m) => !out.has(m.id))
    .sort((a, b) => +new Date(a.endDate) - +new Date(b.endDate) || a.id.localeCompare(b.id));
  const midnightIst = (d: Date) => {
    const x = new Date(d);
    x.setUTCHours(18, 30, 0, 0);
    return x;
  };
  rest.forEach((m, i) => {
    const days = rest.length === 1 ? OPEN_FROM_DAYS : OPEN_FROM_DAYS + Math.round((i * (OPEN_TO_DAYS - OPEN_FROM_DAYS)) / (rest.length - 1));
    out.set(m.id, { end: midnightIst(new Date(now.getTime() + days * DAY)), closed: false });
  });
  return out;
}

export function buildSeedRows(
  markets: readonly Market[],
  translations: TranslationFile,
  opts: { liquidityB: number; now: Date; featuredCount?: number }
) {
  // Mirror the current UI: the featured carousel shows the top markets by volume.
  const featured = new Set(
    [...markets]
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, opts.featuredCount ?? 5)
      .map((m) => m.id)
  );

  const dates = rollingEndDates(markets, opts.now);
  const marketRows: SeedMarketRow[] = [];
  const outcomeRows: SeedOutcomeRow[] = [];
  const translationRows: SeedTranslationRow[] = [];

  for (const m of markets) {
    marketRows.push({
      legacy_id: m.id,
      slug: m.slug,
      title: m.title,
      description: m.description,
      category: m.category,
      subcategory: m.subcategory,
      end_date: dates.get(m.id)!.end.toISOString(),
      is_live: m.isLive,
      is_featured: featured.has(m.id),
      resolution_source: m.resolutionSource,
      // Only the markets closed on purpose (CLOSED_FOR_TESTING) start closed.
      status: dates.get(m.id)!.closed ? "closed" : "open",
      is_binary: m.isBinary,
      liquidity_b: opts.liquidityB,
      total_volume: round(m.totalVolume, 2),
      volume_change_24h: round(m.volumeChange24h, 2),
      tags: m.tags.slice(0, 20),
      region: m.region,
    });

    // LMSR requires prices that sum to 1; multi-outcome seed data may not.
    const { q, normalized } = quantitiesForPrices(
      m.outcomes.map((o) => o.price),
      opts.liquidityB
    );
    m.outcomes.forEach((o, i) => {
      outcomeRows.push({
        legacy_market_id: m.id,
        label: o.label,
        sort_order: i,
        legacy_key: o.id,
        price: round(normalized[i], 10),
        shares_outstanding: round(q[i], 8),
        price_24h_ago: round(Math.min(0.99, Math.max(0.01, normalized[i] - o.change24h)), 10),
      });
    });

    const t = translations[m.id];
    if (t) {
      for (const [locale, text] of Object.entries(t.locales)) {
        translationRows.push({
          legacy_market_id: m.id,
          locale,
          title: text.title,
          description: text.description,
          source_hash: t.sourceHash,
          status: t.status,
          translated_at: t.translatedAt,
        });
      }
    }
  }

  return { marketRows, outcomeRows, translationRows };
}
