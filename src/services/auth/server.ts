import "server-only";
import { cookies } from "next/headers";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/config";
import { emailOtpEnabled, hashKey, sign, signInLimits, verify } from "@/lib/server/env";
import { clientIp, publicOrigin, safeNext } from "@/lib/server/origin";
import { TERMS_VERSION } from "@/lib/legal";

/**
 * Sign-in service (D-019, D-021). Runs only on the server: Server Actions in
 * src/app/actions/auth.ts call it after validating input with zod. Session
 * cookies are written by the @supabase/ssr server client.
 */

export type SendResult =
  | { ok: true }
  | { ok: false; reason: "disabled" | "rate_limited" | "captcha" | "invalid_email" | "unavailable" | "failed" };
export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "disabled" | "rate_limited" | "invalid" | "unavailable" | "failed" };
export type GoogleResult = { ok: true; url: string } | { ok: false; reason: "unavailable" | "failed" };

export interface SessionProfile {
  email: string;
  handle: string;
  provider: "email" | "google";
  ageConfirmedAt: string | null;
  status: "active" | "suspended";
}

const CONSENT_COOKIE = "bp_age_consent";
const CONSENT_MAX_AGE = 600; // seconds: long enough for a Google round trip

type AuthErr = { status?: number; code?: string } | null | undefined;
const rateLimited = (e: AuthErr) =>
  e?.status === 429 || e?.code === "over_email_send_rate_limit" || e?.code === "over_request_rate_limit";

/**
 * Counts an attempt against the per-IP and per-email windows. Fails closed:
 * if the limiter cannot be reached, the attempt is refused.
 */
async function withinLimits(bucket: "otp_send" | "otp_verify", email: string): Promise<boolean> {
  const { windowSeconds, perIp, perEmail } = signInLimits();
  try {
    const admin = getAdminSupabase();
    const [ip, mail] = await Promise.all([
      admin.rpc("hit_rate_limit", {
        p_bucket: `${bucket}_ip`,
        p_key_hash: hashKey("ip", clientIp()),
        p_limit: perIp,
        p_window_seconds: windowSeconds,
      }),
      admin.rpc("hit_rate_limit", {
        p_bucket: `${bucket}_email`,
        p_key_hash: hashKey("email", email),
        p_limit: perEmail,
        p_window_seconds: windowSeconds,
      }),
    ]);
    return !ip.error && !mail.error && ip.data === true && mail.data === true;
  } catch {
    return false;
  }
}

export async function sendEmailCode(email: string, captchaToken: string | undefined): Promise<SendResult> {
  if (!emailOtpEnabled()) return { ok: false, reason: "disabled" };
  if (!supabaseConfigured) return { ok: false, reason: "unavailable" };
  if (!(await withinLimits("otp_send", email))) return { ok: false, reason: "rate_limited" };

  const { error } = await getServerSupabase().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, captchaToken },
  });
  if (!error) return { ok: true };
  if (rateLimited(error)) return { ok: false, reason: "rate_limited" };
  if (error.code === "captcha_failed") return { ok: false, reason: "captcha" };
  if (error.code === "email_address_invalid" || error.code === "validation_failed") {
    return { ok: false, reason: "invalid_email" };
  }
  return { ok: false, reason: "failed" };
}

/** Verifies the code (sets the session cookie) and records the 18+ consent. */
export async function verifyEmailCode(email: string, code: string): Promise<VerifyResult> {
  if (!emailOtpEnabled()) return { ok: false, reason: "disabled" };
  if (!supabaseConfigured) return { ok: false, reason: "unavailable" };
  if (!(await withinLimits("otp_verify", email))) return { ok: false, reason: "rate_limited" };

  const supabase = getServerSupabase();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) {
    if (rateLimited(error)) return { ok: false, reason: "rate_limited" };
    if (error.code === "otp_expired" || [400, 401, 403].includes(error.status ?? 0)) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: false, reason: "failed" };
  }
  await supabase.rpc("confirm_age", { p_terms_version: TERMS_VERSION });
  return { ok: true };
}

/**
 * Starts Google OAuth (PKCE; the verifier is kept in a cookie by the server
 * client). The ticked 18+ box travels as a signed, short-lived, httpOnly
 * cookie and is recorded in /auth/callback after the code exchange.
 */
export async function startGoogle(next: string): Promise<GoogleResult> {
  if (!supabaseConfigured) return { ok: false, reason: "unavailable" };
  cookies().set(CONSENT_COOKIE, sign(`${Date.now()}`), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth/callback",
    maxAge: CONSENT_MAX_AGE,
  });
  const redirectTo = `${publicOrigin()}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;
  const { data, error } = await getServerSupabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  return !error && data.url ? { ok: true, url: data.url } : { ok: false, reason: "failed" };
}

/** Used by /auth/callback: exchange, then record a valid pending consent. */
export async function finishOAuth(code: string): Promise<boolean> {
  const supabase = getServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return false;
  const store = cookies();
  const signed = verify(store.get(CONSENT_COOKIE)?.value);
  store.delete({ name: CONSENT_COOKIE, path: "/auth/callback" });
  const at = signed ? Number(signed) : NaN;
  if (Number.isFinite(at) && Date.now() - at < CONSENT_MAX_AGE * 1000) {
    await supabase.rpc("confirm_age", { p_terms_version: TERMS_VERSION });
  }
  return true;
}

/** Re-confirmation before trading, for accounts without a recorded consent. */
export async function confirmAgeNow(): Promise<string | null> {
  const { data, error } = await getServerSupabase({ readOnly: true }).rpc("confirm_age", {
    p_terms_version: TERMS_VERSION,
  });
  return error ? null : (data as string);
}

/** The signed-in user (verified with getClaims) and their own profile. */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  if (!supabaseConfigured) return null;
  const supabase = getServerSupabase({ readOnly: true });
  const { data: claims, error } = await supabase.auth.getClaims();
  const sub = claims?.claims?.sub;
  if (error || !sub) return null;
  const { data } = await supabase
    .from("profiles")
    .select("handle, age_confirmed_at, status")
    .eq("id", sub)
    .maybeSingle();
  if (!data) return null;
  const provider = (claims.claims.app_metadata as { provider?: string } | undefined)?.provider;
  return {
    email: String(claims.claims.email ?? ""),
    handle: data.handle,
    provider: provider === "google" ? "google" : "email",
    ageConfirmedAt: data.age_confirmed_at,
    status: data.status === "suspended" ? "suspended" : "active",
  };
}

export async function signOutServer(): Promise<void> {
  if (!supabaseConfigured) return;
  await getServerSupabase().auth.signOut();
}
