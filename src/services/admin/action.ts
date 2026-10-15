import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { getStaff, hasRole, staffWithinLimit, type Staff, type StaffRole } from "./auth";

/**
 * Wrapper for every admin Server Action (R2): staff + MFA check, a per-staff
 * write limit (60 a minute), then the work with the staff member's own
 * session client, so the database's role/MFA checks apply (D-027). Database
 * errors come back as their BP_* code; nothing else leaks.
 */

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

type Db = ReturnType<typeof getServerSupabase>;

export const bpCode = (e: { message?: string } | null | undefined) => /BP_[A-Z_]+/.exec(e?.message ?? "")?.[0] ?? "FAILED";

export async function adminAction<T>(
  min: StaffRole,
  work: (db: Db, staff: Staff) => Promise<ActionResult<T>>
): Promise<ActionResult<T>> {
  const staff = await getStaff();
  if (!staff || !hasRole(staff, min)) return { ok: false, error: "BP_FORBIDDEN" };
  if (staff.aal !== "aal2") return { ok: false, error: "BP_MFA_REQUIRED" };
  if (!(await staffWithinLimit(staff.id, "admin_write", 60, 60))) return { ok: false, error: "RATE_LIMITED" };
  try {
    return await work(getServerSupabase({ readOnly: true }), staff);
  } catch {
    return { ok: false, error: "FAILED" };
  }
}

/** Runs one RPC and maps its error to a BP_* code. */
export async function rpcResult<T>(
  call: PromiseLike<{ data: T | null; error: { message?: string } | null }>
): Promise<ActionResult<T>> {
  const { data, error } = await call;
  if (error) return { ok: false, error: bpCode(error) };
  return { ok: true, data: data as T };
}
