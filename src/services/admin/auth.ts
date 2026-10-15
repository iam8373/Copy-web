import "server-only";
import { notFound, redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/config";
import { hashKey } from "@/lib/server/env";

/**
 * Staff sessions for /admin (R2). The database re-checks role, status and MFA
 * on every write (D-027); these checks decide what the server renders and
 * stop pointless calls early.
 */

export type StaffRole = "moderator" | "admin";

export interface Staff {
  id: string;
  email: string;
  handle: string;
  role: StaffRole;
  /** "aal2" once the session has passed a TOTP challenge. */
  aal: "aal1" | "aal2";
}

export const ROLE_RANK: Record<StaffRole, number> = { moderator: 1, admin: 2 };

export function hasRole(staff: Pick<Staff, "role">, min: StaffRole): boolean {
  return ROLE_RANK[staff.role] >= ROLE_RANK[min];
}

/** The signed-in staff member (any assurance level), or null. */
export async function getStaff(): Promise<Staff | null> {
  if (!supabaseConfigured) return null;
  const supabase = getServerSupabase({ readOnly: true });
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  const { data: prof } = await supabase
    .from("profiles")
    .select("handle, role, status")
    .eq("id", claims.sub)
    .maybeSingle();
  if (!prof || prof.status !== "active" || (prof.role !== "admin" && prof.role !== "moderator")) return null;
  return {
    id: claims.sub,
    email: String(claims.email ?? ""),
    handle: prof.handle,
    role: prof.role,
    aal: claims.aal === "aal2" ? "aal2" : "aal1",
  };
}

/**
 * For admin pages. Not staff (or below `min`): 404, so /admin does not
 * advertise itself. Staff without MFA in this session: to /admin/mfa.
 */
export async function requireStaff(min: StaffRole = "moderator"): Promise<Staff> {
  const staff = await getStaff();
  if (!staff || !hasRole(staff, min)) notFound();
  if (staff.aal !== "aal2") redirect("/admin/mfa");
  return staff;
}

/**
 * Per-staff rate limit for admin writes (and MFA attempts). Fails closed.
 */
export async function staffWithinLimit(staffId: string, bucket: string, limit: number, windowSeconds: number) {
  try {
    const { data, error } = await getAdminSupabase().rpc("hit_rate_limit", {
      p_bucket: bucket,
      p_key_hash: hashKey("staff", staffId),
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}
