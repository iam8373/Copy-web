/**
 * npm run db:seed — imports src/data/markets.ts (and the committed market
 * translations) into Supabase. Idempotent: rows that already exist are left
 * untouched (insert-if-missing), so it never clobbers prices, volumes or
 * edits made since. Uses the service role; run it only on a trusted machine.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from
 * .env.local or the environment. The key is never printed.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { MARKETS } from "../src/data/markets";
import translations from "../src/data/market-translations.json";
import type { TranslationFile } from "../src/services/translation/types";
import { buildSeedRows } from "./seed-rows";

function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

async function main() {
  const env = { ...loadEnvFile(resolve(".env.local")), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (see .env.example).");
    process.exit(1);
  }
  // Safety: .env.local may hold a hosted project's keys (populate-env.sh).
  // Seeding a hosted database must be a deliberate choice.
  const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url);
  if (!local && !process.argv.includes("--remote")) {
    console.error("error: NEXT_PUBLIC_SUPABASE_URL is not a local database. Re-run with `npm run db:seed -- --remote` to seed it on purpose.");
    process.exit(1);
  }
  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: setting } = await db.from("app_settings").select("value").eq("key", "default_liquidity_b").maybeSingle();
  const liquidityB = Number(setting?.value ?? 1000);

  const { marketRows, outcomeRows, translationRows } = buildSeedRows(
    MARKETS,
    translations as TranslationFile,
    { liquidityB, now: new Date() }
  );

  // 1. Markets: insert only the ones not already present (by legacy_id).
  const ins = await db.from("markets").upsert(marketRows, { onConflict: "legacy_id", ignoreDuplicates: true }).select("id");
  if (ins.error) throw new Error(`markets: ${ins.error.message}`);

  const { data: all, error: idErr } = await db
    .from("markets")
    .select("id, legacy_id")
    .in("legacy_id", marketRows.map((r) => r.legacy_id));
  if (idErr) throw new Error(`markets lookup: ${idErr.message}`);
  const idOf = new Map((all ?? []).map((r) => [r.legacy_id as string, r.id]));

  // 2. Outcomes, keyed by (market_id, label).
  const outcomes = outcomeRows.map(({ legacy_market_id, ...o }) => ({ ...o, market_id: idOf.get(legacy_market_id)! }));
  const oIns = await db.from("outcomes").upsert(outcomes, { onConflict: "market_id,label", ignoreDuplicates: true }).select("id");
  if (oIns.error) throw new Error(`outcomes: ${oIns.error.message}`);

  // 3. Saved translations, keyed by (market_id, locale).
  const trs = translationRows.map(({ legacy_market_id, ...t }) => ({ ...t, market_id: idOf.get(legacy_market_id)! }));
  const tIns = await db.from("market_translations").upsert(trs, { onConflict: "market_id,locale", ignoreDuplicates: true }).select("id");
  if (tIns.error) throw new Error(`market_translations: ${tIns.error.message}`);

  console.log(
    `Seed complete: +${ins.data?.length ?? 0} markets, +${oIns.data?.length ?? 0} outcomes, ` +
      `+${tIns.data?.length ?? 0} translations (existing rows left untouched).`
  );
}

main().catch((err) => {
  console.error(`error: db:seed failed: ${err instanceof Error ? err.message : "unknown error"}`);
  process.exit(1);
});
