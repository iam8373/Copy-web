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
      end_date: new Date(m.endDate).toISOString(),
      is_live: m.isLive,
      is_featured: featured.has(m.id),
      resolution_source: m.resolutionSource,
      // Markets whose end date has passed are seeded closed, so place_order
      // (which requires status 'open' and a future end_date) refuses them.
      status: new Date(m.endDate) > opts.now ? "open" : "closed",
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
