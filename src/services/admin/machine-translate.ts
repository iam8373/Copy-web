import "server-only";
import { resolveBaseUrl, resolveConfig, translateMarket, translateOutcomes } from "@/services/translation/provider/gemini";
import { validateLocales, validateOutcomeLabels } from "@/services/translation/validate";
import { TARGET_LOCALES } from "@/services/translation/types";
import { bpCode, type ActionResult } from "./action";
import type { getServerSupabase } from "@/lib/supabase/server";

/** Whether machine translation is configured on this server (no names leak). */
export function machineTranslationConfigured(): boolean {
  return resolveConfig(process.env).ok;
}

/**
 * On-demand machine translation of one market (R5, provider: see
 * services/translation/provider), run inside adminAction
 * with the staff member's session `db`. Order: read the English source, take
 * one unit of today's cap, call Gemini (text + outcome labels), validate,
 * save as machine drafts. A current reviewed entry is never replaced (the
 * database returns false and it counts as "kept").
 */

export type GenerateSummary = { saved: number; kept: number; skipped: string[]; left: number };

type Db = ReturnType<typeof getServerSupabase>;

export async function generateForMarket(db: Db, marketId: string): Promise<ActionResult<GenerateSummary>> {
  const cfg = resolveConfig(process.env);
  if (!cfg.ok) return { ok: false, error: "TRANSLATION_NOT_CONFIGURED" };
  const { data: m, error: srcError } = await db.rpc("admin_translation_source", { p_market_id: marketId });
  if (srcError) return { ok: false, error: bpCode(srcError) };
  const src = m as { title: string; description: string; subcategory: string; outcomes: Array<{ id: string; label: string }> } | null;
  if (!src) return { ok: false, error: "BP_NOT_FOUND" };

  const quota = await db.rpc("admin_take_translation_quota", { p_market_id: marketId });
  if (quota.error) return { ok: false, error: bpCode(quota.error) };

  const opts = { apiKey: cfg.apiKey, model: cfg.model, baseUrl: resolveBaseUrl(process.env.GEMINI_BASE_URL), timeoutMs: 90_000 };
  const source = { id: marketId, title: src.title, description: src.description, subcategory: src.subcategory };
  const labels = src.outcomes.map((o) => o.label);
  let text: unknown;
  let outs: unknown;
  try {
    [text, outs] = await Promise.all([translateMarket(source, opts), translateOutcomes(labels, opts)]);
  } catch {
    return { ok: false, error: "TRANSLATION_FAILED" };
  }
  const textOk = validateLocales(source, text).length === 0;
  const labelsOk = validateOutcomeLabels(labels, outs).length === 0;
  if (!textOk && !labelsOk) return { ok: false, error: "TRANSLATION_INVALID" };

  const summary: GenerateSummary = { saved: 0, kept: 0, skipped: [], left: Number(quota.data) };
  for (const l of TARGET_LOCALES) {
    if (textOk) {
      const t = (text as Record<string, { title: string; description: string }>)[l];
      const r = await db.rpc("admin_save_market_translation", {
        p_market_id: marketId, p_locale: l, p_title: t.title, p_description: t.description, p_status: "machine-drafted",
      });
      if (r.error) return { ok: false, error: bpCode(r.error) };
      if (r.data === true) summary.saved += 1;
      else summary.kept += 1;
    }
    if (labelsOk) {
      const arr = (outs as Record<string, string[]>)[l];
      for (let i = 0; i < src.outcomes.length; i++) {
        const r = await db.rpc("admin_save_outcome_translation", {
          p_outcome_id: src.outcomes[i].id, p_locale: l, p_label: arr[i], p_status: "machine-drafted",
        });
        if (r.error) return { ok: false, error: bpCode(r.error) };
        if (r.data === true) summary.saved += 1;
        else summary.kept += 1;
      }
    }
  }
  if (!textOk) summary.skipped.push("text");
  if (!labelsOk) summary.skipped.push("outcomes");
  return { ok: true, data: summary };
}
