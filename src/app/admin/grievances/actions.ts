"use server";

import { z } from "zod";
import { adminAction, rpcResult, type ActionResult } from "@/services/admin/action";

export async function updateGrievance(id: unknown, status: unknown, note: unknown): Promise<ActionResult> {
  const p = z
    .object({ id: z.string().uuid(), status: z.enum(["open", "in_progress", "resolved", "closed"]), note: z.string().max(5000) })
    .safeParse({ id, status, note: note ?? "" });
  if (!p.success) return { ok: false, error: "BP_INVALID_INPUT" };
  return adminAction("moderator", async (db) => {
    const r = await rpcResult(db.rpc("admin_update_grievance", { p_id: p.data.id, p_status: p.data.status, p_note: p.data.note }));
    return r.ok ? { ok: true, data: undefined } : r;
  });
}
