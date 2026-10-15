"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { adminAction, rpcResult, type ActionResult } from "@/services/admin/action";
import { MARKETS_TAG, PRICES_TAG } from "@/services/markets/read";

/** Resolution actions (R4). The database enforces roles, MFA, slug, window. */

const Id = z.string().uuid();
const Slug = z.string().max(96);
const Reason = z.string().trim().min(3).max(2000);

const refresh = () => {
  revalidateTag(MARKETS_TAG);
  revalidateTag(PRICES_TAG);
};

const Propose = z.object({
  marketId: Id,
  outcomeId: Id.nullable(), // null = void
  evidenceUrl: z.string().trim().url().max(500).refine((u) => /^https?:\/\//.test(u)),
  note: Reason,
});

export async function proposeResolution(input: unknown): Promise<ActionResult<string>> {
  const p = Propose.safeParse(input);
  if (!p.success) return { ok: false, error: "BP_INVALID_INPUT" };
  return adminAction("moderator", async (db) => {
    const r = await rpcResult(
      db.rpc("propose_resolution", {
        p_market_id: p.data.marketId,
        p_outcome_id: p.data.outcomeId as string,
        p_evidence_url: p.data.evidenceUrl,
        p_note: p.data.note,
      })
    );
    if (r.ok) refresh();
    return r as ActionResult<string>;
  });
}

export async function approveResolution(proposalId: unknown, confirmSlug: unknown): Promise<ActionResult> {
  const id = Id.safeParse(proposalId);
  const s = Slug.safeParse(confirmSlug);
  if (!id.success || !s.success) return { ok: false, error: "BP_INVALID_INPUT" };
  return adminAction("admin", async (db) => {
    const r = await rpcResult(db.rpc("approve_resolution", { p_proposal_id: id.data, p_confirm_slug: s.data }));
    if (r.ok) refresh();
    return r.ok ? { ok: true, data: undefined } : r;
  });
}

/** Rejects a pending proposal, or withdraws an approved one in its window. */
export async function rejectResolution(proposalId: unknown, reason: unknown): Promise<ActionResult> {
  const id = Id.safeParse(proposalId);
  const why = Reason.safeParse(reason);
  if (!id.success || !why.success) return { ok: false, error: "BP_INVALID_INPUT" };
  return adminAction("admin", async (db) => {
    const r = await rpcResult(db.rpc("reject_resolution", { p_proposal_id: id.data, p_reason: why.data }));
    if (r.ok) refresh();
    return r.ok ? { ok: true, data: undefined } : r;
  });
}

export async function finalizeResolution(proposalId: unknown, confirmSlug: unknown): Promise<ActionResult> {
  const id = Id.safeParse(proposalId);
  const s = Slug.safeParse(confirmSlug);
  if (!id.success || !s.success) return { ok: false, error: "BP_INVALID_INPUT" };
  return adminAction("admin", async (db) => {
    const r = await rpcResult(db.rpc("finalize_resolution", { p_proposal_id: id.data, p_confirm_slug: s.data }));
    if (r.ok) refresh();
    return r.ok ? { ok: true, data: undefined } : r;
  });
}
