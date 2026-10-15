"use server";

import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { getStaff, staffWithinLimit } from "@/services/admin/auth";

/**
 * TOTP enrolment and challenge for staff (R2). Staff only: anyone else gets
 * the same refusal. Verifying upgrades the session to aal2 (new cookies).
 */

export type EnrollResult = { ok: true; factorId: string; qr: string; secret: string } | { ok: false; error: string };
export type VerifyResult = { ok: true } | { ok: false; error: string };

export async function startMfaEnroll(): Promise<EnrollResult> {
  const staff = await getStaff();
  if (!staff) return { ok: false, error: "BP_FORBIDDEN" };
  const supabase = getServerSupabase();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return { ok: false, error: "FAILED" };
  // A verified factor exists: use the challenge, never a second enrolment here.
  if (factors.totp.length > 0) return { ok: false, error: "BP_WRONG_STATUS" };
  // Drop abandoned, never-verified attempts so the new one can be created.
  for (const f of factors.all.filter((f) => f.status === "unverified")) {
    await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "BharatPredict",
    friendlyName: `Authenticator ${new Date().toISOString().slice(0, 16)}`,
  });
  if (error || !data) return { ok: false, error: "FAILED" };
  return { ok: true, factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

const Input = z.object({ factorId: z.string().uuid().optional(), code: z.string().regex(/^\d{6}$/) });

export async function verifyMfa(input: unknown): Promise<VerifyResult> {
  const p = Input.safeParse(input);
  if (!p.success) return { ok: false, error: "INVALID_CODE" };
  const staff = await getStaff();
  if (!staff) return { ok: false, error: "BP_FORBIDDEN" };
  if (!(await staffWithinLimit(staff.id, "mfa_verify", 10, 600))) return { ok: false, error: "RATE_LIMITED" };
  const supabase = getServerSupabase();
  let factorId = p.data.factorId;
  if (!factorId) {
    const { data } = await supabase.auth.mfa.listFactors();
    factorId = data?.totp[0]?.id;
  }
  if (!factorId) return { ok: false, error: "FAILED" };
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: p.data.code });
  return error ? { ok: false, error: "INVALID_CODE" } : { ok: true };
}
