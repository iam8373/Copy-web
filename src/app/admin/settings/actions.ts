"use server";

import { z } from "zod";
import { adminAction, rpcResult, type ActionResult } from "@/services/admin/action";
import { SETTING_KEYS } from "@/services/admin/people";

/** One setting at a time; the database validates the key and the range. */
export async function updateSetting(key: unknown, value: unknown): Promise<ActionResult> {
  const p = z.object({ key: z.enum(SETTING_KEYS), value: z.union([z.boolean(), z.number().finite()]) }).safeParse({ key, value });
  if (!p.success) return { ok: false, error: "BP_INVALID_INPUT" };
  return adminAction("admin", async (db) => {
    const r = await rpcResult(db.rpc("admin_update_setting", { p_key: p.data.key, p_value: p.data.value }));
    return r.ok ? { ok: true, data: undefined } : r;
  });
}
