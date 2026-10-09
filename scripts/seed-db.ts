/**
 * Idempotent database seed from the static catalogue. Shared by
 * `npm run db:seed` (scripts/db-seed.ts) and the e2e global setup, which
 * seeds the LOCAL stand-in before every run. Insert-if-missing everywhere:
 * re-runs never change existing rows (prices, volumes, translations).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { MARKETS } from "../src/data/markets";
import translations from "../src/data/market-translations.json";
import type { Database } from "../src/types/database";
import type { TranslationFile } from "../src/services/translation/types";
import { buildSeedRows } from "./seed-rows";

export async function seedDatabase(db: SupabaseClient<Database>, now = new Date()) {
  const { data: setting } = await db.from("app_settings").select("value").eq("key", "default_liquidity_b").maybeSingle();
  const liquidityB = Number(setting?.value ?? 20000);

  const { marketRows, outcomeRows, translationRows } = buildSeedRows(MARKETS, translations as TranslationFile, {
    liquidityB,
    now,
  });

  // 1. Markets: only the ones not already present (by legacy_id).
  const ins = await db.from("markets").upsert(marketRows, { onConflict: "legacy_id", ignoreDuplicates: true }).select("id");
  if (ins.error) throw new Error(`markets: ${ins.error.message}`);

  const { data: all, error: idErr } = await db
    .from("markets")
    .select("id, legacy_id")
    .in("legacy_id", marketRows.map((r) => r.legacy_id));
  if (idErr) throw new Error(`markets lookup: ${idErr.message}`);
  const idOf = new Map((all ?? []).map((r) => [r.legacy_id as string, r.id]));

  // 2. Outcomes, keyed by (market_id, label).
  const outcomes = outcomeRows.map(({ legacy_market_id, price_24h_ago: _p, ...o }) => ({
    ...o,
    market_id: idOf.get(legacy_market_id)!,
  }));
  const oIns = await db.from("outcomes").upsert(outcomes, { onConflict: "market_id,label", ignoreDuplicates: true }).select("id, market_id, label");
  if (oIns.error) throw new Error(`outcomes: ${oIns.error.message}`);

  // 3. Starting price history for newly created outcomes only: one point 24 h
  //    ago (from the catalogue's 24 h change) and one now.
  const fresh = oIns.data ?? [];
  if (fresh.length) {
    const byKey = new Map(outcomeRows.map((o) => [`${idOf.get(o.legacy_market_id)}:${o.label}`, o]));
    const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
    const rows = fresh.flatMap((o) => {
      const src = byKey.get(`${o.market_id}:${o.label}`)!;
      return [
        { market_id: o.market_id, outcome_id: o.id, price: src.price_24h_ago, at: dayAgo },
        { market_id: o.market_id, outcome_id: o.id, price: src.price, at: now.toISOString() },
      ];
    });
    const ph = await db.from("price_history").insert(rows);
    if (ph.error) throw new Error(`price_history: ${ph.error.message}`);
  }

  // 4. Saved translations, keyed by (market_id, locale).
  const trs = translationRows.map(({ legacy_market_id, ...t }) => ({ ...t, market_id: idOf.get(legacy_market_id)! }));
  const tIns = await db.from("market_translations").upsert(trs, { onConflict: "market_id,locale", ignoreDuplicates: true }).select("id");
  if (tIns.error) throw new Error(`market_translations: ${tIns.error.message}`);

  return { markets: ins.data?.length ?? 0, outcomes: fresh.length, translations: tIns.data?.length ?? 0 };
}
