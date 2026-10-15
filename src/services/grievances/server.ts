import "server-only";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { grievanceLimits, hashKey } from "@/lib/server/env";
import { clientIp } from "@/lib/server/origin";

/**
 * Grievance submission (R6). Anyone may file one, signed in or not. Limited
 * per hour to 5 per IP (GRIEVANCE_RATE_LIMIT_PER_IP) and 3 per email address
 * (fails closed). The
 * row is inserted with the secret key (grievances have no client access);
 * a signed-in filer is linked by their verified user id.
 */

export type GrievanceResult = { ok: true; reference: string } | { ok: false; reason: "invalid" | "rate_limited" | "failed" };

export async function submitGrievance(g: {
  name: string;
  email: string;
  category: "account" | "market" | "resolution" | "privacy" | "other";
  subject: string;
  message: string;
}): Promise<GrievanceResult> {
  if (!supabaseConfigured) return { ok: false, reason: "failed" };
  try {
    const admin = getAdminSupabase();
    const lim = grievanceLimits();
    const [ip, mail] = await Promise.all([
      admin.rpc("hit_rate_limit", { p_bucket: "grievance_ip", p_key_hash: hashKey("ip", clientIp()), p_limit: lim.perIp, p_window_seconds: lim.windowSeconds }),
      admin.rpc("hit_rate_limit", { p_bucket: "grievance_email", p_key_hash: hashKey("email", g.email), p_limit: lim.perEmail, p_window_seconds: lim.windowSeconds }),
    ]);
    if (ip.error || mail.error || ip.data !== true || mail.data !== true) return { ok: false, reason: "rate_limited" };
    const { data: claims } = await getServerSupabase({ readOnly: true }).auth.getClaims();
    const { data, error } = await admin
      .from("grievances")
      .insert({ ...g, user_id: claims?.claims?.sub ?? null })
      .select("reference")
      .single();
    if (error || !data) return { ok: false, reason: "failed" };
    return { ok: true, reference: data.reference };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
