import "server-only";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { outcomeHashFor, sourceHashFor } from "@/services/translation/hash";
import { TARGET_LOCALES, type TargetLocale } from "@/services/translation/types";
import type { MarketStatus } from "@/lib/admin/market-schema";
import type { Staff } from "./auth";

/**
 * Translation admin reads (R5). Secret key, after requireStaff. State per
 * locale combines the market text and every outcome label: the worst wins.
 */

export type LocaleState = "missing" | "stale" | "machine" | "reviewed";
const RANK: Record<LocaleState, number> = { missing: 0, stale: 1, machine: 2, reviewed: 3 };
const worst = (xs: LocaleState[]) => xs.reduce((a, b) => (RANK[b] < RANK[a] ? b : a), "reviewed" as LocaleState);

type Saved = { locale: string; source_hash: string; status: string };
const stateOf = (saved: Saved | undefined, hash: string): LocaleState =>
  !saved ? "missing" : saved.source_hash !== hash ? "stale" : saved.status === "reviewed" ? "reviewed" : "machine";

export interface TranslationRow {
  id: string;
  slug: string;
  title: string;
  status: MarketStatus;
  states: Record<TargetLocale, LocaleState>;
}

export interface TranslationDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  subcategory: string;
  status: MarketStatus;
  isBinary: boolean;
  locales: Record<
    TargetLocale,
    { state: LocaleState; title: string; description: string; textState: LocaleState }
  >;
  outcomes: Array<{
    id: string;
    label: string;
    locales: Record<TargetLocale, { label: string; state: LocaleState }>;
  }>;
}

type MarketDb = {
  id: string;
  slug: string;
  title: string;
  description: string;
  subcategory: string;
  status: string;
  is_binary: boolean;
  market_translations: Array<Saved & { title: string; description: string }>;
  outcomes: Array<{ id: string; label: string; sort_order: number; outcome_translations: Array<Saved & { label: string }> }>;
};

const COLUMNS =
  "id, slug, title, description, subcategory, status, is_binary, " +
  "market_translations(locale, source_hash, status, title, description), " +
  "outcomes!outcomes_market_id_fkey(id, label, sort_order, outcome_translations(locale, source_hash, status, label))";

function detailOf(m: MarketDb): TranslationDetail {
  const hash = sourceHashFor(m);
  const outcomes = [...m.outcomes]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((o) => {
      const h = outcomeHashFor(o.label);
      return {
        id: o.id,
        label: o.label,
        locales: Object.fromEntries(
          TARGET_LOCALES.map((l) => {
            const saved = o.outcome_translations.find((t) => t.locale === l);
            return [l, { label: saved?.label ?? "", state: stateOf(saved, h) }];
          })
        ) as TranslationDetail["outcomes"][number]["locales"],
      };
    });
  const locales = Object.fromEntries(
    TARGET_LOCALES.map((l) => {
      const saved = m.market_translations.find((t) => t.locale === l);
      const textState = stateOf(saved, hash);
      return [
        l,
        {
          textState,
          state: worst([textState, ...outcomes.map((o) => o.locales[l].state)]),
          title: saved?.title ?? "",
          description: saved?.description ?? "",
        },
      ];
    })
  ) as TranslationDetail["locales"];
  return {
    id: m.id, slug: m.slug, title: m.title, description: m.description, subcategory: m.subcategory,
    status: m.status as MarketStatus, isBinary: m.is_binary, locales, outcomes,
  };
}

export async function listTranslations(
  _staff: Staff,
  opts: { filter: "needs" | "all"; page: number; q?: string }
): Promise<{ rows: TranslationRow[]; total: number } | null> {
  let query = getAdminSupabase()
    .from("markets")
    .select(COLUMNS)
    .not("status", "in", "(resolved,voided)")
    .order("total_volume", { ascending: false })
    .limit(1000);
  const q = (opts.q ?? "").replace(/[%_\\,()*]/g, " ").trim().slice(0, 80);
  if (q) query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);
  const { data, error } = await query;
  if (error) return null;
  let rows = (data as unknown as MarketDb[]).map((m) => {
    const d = detailOf(m);
    return {
      id: d.id, slug: d.slug, title: d.title, status: d.status,
      states: Object.fromEntries(TARGET_LOCALES.map((l) => [l, d.locales[l].state])) as TranslationRow["states"],
    };
  });
  if (opts.filter === "needs") rows = rows.filter((r) => TARGET_LOCALES.some((l) => RANK[r.states[l]] < RANK.machine));
  const size = 50;
  return { total: rows.length, rows: rows.slice((opts.page - 1) * size, opts.page * size) };
}

export async function getTranslationDetail(_staff: Staff, id: string): Promise<TranslationDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await getAdminSupabase().from("markets").select(COLUMNS).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return detailOf(data as unknown as MarketDb);
}

/** Machine-translation units used today (IST) and the cap. */
export async function getQuota(_staff: Staff): Promise<{ used: number; cap: number } | null> {
  const db = getAdminSupabase();
  const now = new Date();
  // Midnight IST = 18:30 UTC of the previous day.
  const ist = new Date(now.getTime() + 330 * 60_000);
  const midnight = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 330 * 60_000);
  const [used, cap] = await Promise.all([
    db.from("audit_log").select("id", { count: "exact", head: true }).eq("action", "translation.generate").gte("created_at", midnight.toISOString()),
    db.from("app_settings").select("value").eq("key", "daily_translation_cap").maybeSingle(),
  ]);
  if (used.error) return null;
  const n = Number(cap.data?.value);
  return { used: used.count ?? 0, cap: Number.isFinite(n) ? n : 50 };
}
