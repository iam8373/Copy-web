"use server";

import { z } from "zod";
import { adminAction, rpcResult, type ActionResult } from "@/services/admin/action";

/** User actions (R6). Admin + MFA; self-protection is in the database. */

const Id = z.string().uuid();
const Reason = z.string().trim().min(3).max(500);

export async function adjustCredits(userId: unknown, amount: unknown, reason: unknown): Promise<ActionResult<number>> {
  const p = z.object({ userId: Id, amount: z.number().finite(), reason: Reason }).safeParse({ userId, amount, reason });
  if (!p.success) return { ok: false, error: "BP_INVALID_INPUT" };
  return adminAction("admin", (db) =>
    rpcResult(db.rpc("admin_adjust_credits", { p_user_id: p.data.userId, p_amount: p.data.amount, p_reason: p.data.reason }))
  ) as Promise<ActionResult<number>>;
}

export async function setUserStatus(userId: unknown, status: unknown, reason: unknown): Promise<ActionResult> {
  const p = z
    .object({ userId: Id, status: z.enum(["active", "suspended"]), reason: z.string().trim().max(500) })
    .safeParse({ userId, status, reason: reason ?? "" });
  if (!p.success) return { ok: false, error: "BP_INVALID_INPUT" };
  return adminAction("admin", async (db) => {
    const r = await rpcResult(db.rpc("admin_set_user_status", { p_user_id: p.data.userId, p_status: p.data.status, p_reason: p.data.reason }));
    return r.ok ? { ok: true, data: undefined } : r;
  });
}

export async function setUserRole(userId: unknown, role: unknown): Promise<ActionResult> {
  const p = z.object({ userId: Id, role: z.enum(["user", "moderator", "admin"]) }).safeParse({ userId, role });
  if (!p.success) return { ok: false, error: "BP_INVALID_INPUT" };
  return adminAction("admin", async (db) => {
    const r = await rpcResult(db.rpc("admin_set_role", { p_user_id: p.data.userId, p_role: p.data.role }));
    return r.ok ? { ok: true, data: undefined } : r;
  });
}
