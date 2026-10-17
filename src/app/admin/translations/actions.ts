"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { adminAction, bpCode, type ActionResult } from "@/services/admin/action";
import { MARKETS_TAG } from "@/services/markets/read";
import { generateForMarket, type GenerateSummary } from "@/services/admin/machine-translate";
import { TARGET_LOCALES } from "@/services/translation/types";

/**
 * Translation admin actions (R5). Machine translation on demand (provider:
 * D-018), capped per IST day. Machine drafts never replace a current reviewed entry (the
 * database decides, see 20261013000100_admin_translations.sql).
 */

const Id = z.string().uuid();
const Locale = z.enum(TARGET_LOCALES);

export type { GenerateSummary } from "@/services/admin/machine-translate";

export async function generateTranslations(marketId: unknown): Promise<ActionResult<GenerateSummary>> {
  const id = Id.safeParse(marketId);
  if (!id.success) return { ok: false, error: "BP_INVALID_INPUT" };
  return adminAction("moderator", async (db) => {
    const r = await generateForMarket(db, id.data);
    if (r.ok) revalidateTag(MARKETS_TAG);
    return r;
  });
}

const SaveLocale = z.object({
  marketId: Id,
  locale: Locale,
  title: z.string().trim().min(1).max(400),
  description: z.string().max(8000),
  outcomes: z.array(z.object({ id: Id, label: z.string().trim().min(1).max(200) })).max(20),
});

/** A reviewer's edit of one locale: saved as "reviewed". */
export async function saveReviewedLocale(input: unknown): Promise<ActionResult> {
  const p = SaveLocale.safeParse(input);
  if (!p.success) return { ok: false, error: "BP_INVALID_INPUT" };
  return adminAction("moderator", async (db) => {
    const r = await db.rpc("admin_save_market_translation", {
      p_market_id: p.data.marketId, p_locale: p.data.locale, p_title: p.data.title,
      p_description: p.data.description, p_status: "reviewed",
    });
    if (r.error) return { ok: false, error: bpCode(r.error) };
    for (const o of p.data.outcomes) {
      const x = await db.rpc("admin_save_outcome_translation", {
        p_outcome_id: o.id, p_locale: p.data.locale, p_label: o.label, p_status: "reviewed",
      });
      if (x.error) return { ok: false, error: bpCode(x.error) };
    }
    revalidateTag(MARKETS_TAG);
    return { ok: true, data: undefined };
  });
}
