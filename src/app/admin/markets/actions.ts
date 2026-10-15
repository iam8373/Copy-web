"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { CreateMarket, UpdateMarket, toDbPayload } from "@/lib/admin/market-schema";
import { adminAction, bpCode, rpcResult, type ActionResult } from "@/services/admin/action";
import { MARKETS_TAG, PRICES_TAG } from "@/services/markets/read";

/** Market management actions (R3). Thin: zod, then the database function. */

const Id = z.string().uuid();
const Slug = z.string().max(96);

function refresh() {
  revalidateTag(MARKETS_TAG);
  revalidateTag(PRICES_TAG);
}

export async function createMarket(input: unknown): Promise<ActionResult<string>> {
  const p = CreateMarket.safeParse(input);
  if (!p.success) return { ok: false, error: "BP_INVALID_INPUT" };
  return adminAction("moderator", async (db) => {
    const { tags, region, ...fields } = p.data;
    const created = await rpcResult(db.rpc("admin_create_market", { p: toDbPayload(fields) as never }));
    if (!created.ok) return created;
    const id = created.data as string;
    if (tags.length > 0 || region !== "India") {
      const t = await db.rpc("admin_set_market_tags", { p_market_id: id, p_tags: tags, p_region: region });
      if (t.error) return { ok: false, error: bpCode(t.error) };
    }
    refresh();
    return { ok: true, data: id };
  });
}

export async function updateMarket(id: unknown, changes: unknown): Promise<ActionResult> {
  const pid = Id.safeParse(id);
  const p = UpdateMarket.safeParse(changes);
  if (!pid.success || !p.success) return { ok: false, error: "BP_INVALID_INPUT" };
  return adminAction("moderator", async (db) => {
    const { tags, region, ...fields } = p.data;
    const payload = toDbPayload(fields);
    if (Object.keys(payload).length > 0) {
      const r = await db.rpc("admin_update_market", { p_market_id: pid.data, p: payload as never });
      if (r.error) return { ok: false, error: bpCode(r.error) };
    }
    if (tags !== undefined || region !== undefined) {
      const { data: cur } = await db.from("markets").select("tags, region").eq("id", pid.data).maybeSingle();
      const r = await db.rpc("admin_set_market_tags", {
        p_market_id: pid.data,
        p_tags: tags ?? cur?.tags ?? [],
        p_region: region ?? cur?.region ?? "India",
      });
      if (r.error) return { ok: false, error: bpCode(r.error) };
    }
    refresh();
    return { ok: true, data: undefined };
  });
}

export async function publishMarket(id: unknown, confirmSlug: unknown): Promise<ActionResult> {
  const pid = Id.safeParse(id);
  const s = Slug.safeParse(confirmSlug);
  if (!pid.success || !s.success) return { ok: false, error: "BP_INVALID_INPUT" };
  return adminAction("admin", async (db) => {
    const r = await rpcResult(db.rpc("admin_publish_market", { p_market_id: pid.data, p_confirm_slug: s.data }));
    if (r.ok) refresh();
    return r.ok ? { ok: true, data: undefined } : r;
  });
}

export async function closeMarket(id: unknown, confirmSlug: unknown): Promise<ActionResult> {
  const pid = Id.safeParse(id);
  const s = Slug.safeParse(confirmSlug);
  if (!pid.success || !s.success) return { ok: false, error: "BP_INVALID_INPUT" };
  return adminAction("admin", async (db) => {
    const r = await rpcResult(db.rpc("admin_close_market", { p_market_id: pid.data, p_confirm_slug: s.data }));
    if (r.ok) refresh();
    return r.ok ? { ok: true, data: undefined } : r;
  });
}
