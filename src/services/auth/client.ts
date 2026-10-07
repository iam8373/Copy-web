"use client";

import { getBrowserSupabase } from "@/lib/supabase/client";
import { TERMS_VERSION } from "@/lib/legal";

/**
 * Browser-side sign-in for Supabase mode (D-019): email OTP and Google OAuth.
 * UI components call these functions and never touch Supabase directly. All
 * writes go through Supabase Auth or SECURITY DEFINER functions; identity is
 * always auth.uid() on the server, never something the client sends.
 */

export type SendResult = { ok: true } | { ok: false; reason: "rate_limited" | "captcha" | "invalid_email" | "failed" };
export type VerifyResult = { ok: true } | { ok: false; reason: "invalid" | "rate_limited" | "failed" };

/** Set before leaving for Google so the 18+ consent survives the redirect. */
const AGE_PENDING_KEY = "bp-age-pending";

type AuthErr = { status?: number; code?: string } | null | undefined;

function isRateLimited(e: AuthErr) {
  return e?.status === 429 || e?.code === "over_email_send_rate_limit" || e?.code === "over_request_rate_limit";
}

/** Step 1: email a 6-digit code. Creates the account on first use. */
export async function sendEmailCode(email: string, captchaToken?: string): Promise<SendResult> {
  const { error } = await getBrowserSupabase().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, captchaToken },
  });
  if (!error) return { ok: true };
  if (isRateLimited(error)) return { ok: false, reason: "rate_limited" };
  if (error.code === "captcha_failed") return { ok: false, reason: "captcha" };
  if (error.code === "email_address_invalid" || error.code === "validation_failed") {
    return { ok: false, reason: "invalid_email" };
  }
  return { ok: false, reason: "failed" };
}

/** Step 2: exchange the code for a session (cookie), then record the 18+ consent. */
export async function verifyEmailCode(email: string, code: string): Promise<VerifyResult> {
  const supabase = getBrowserSupabase();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) {
    if (isRateLimited(error)) return { ok: false, reason: "rate_limited" };
    if (error.code === "otp_expired" || error.status === 401 || error.status === 403 || error.status === 400) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: false, reason: "failed" };
  }
  await confirmAge();
  return { ok: true };
}

/**
 * Google: redirects away; /auth/callback finishes the PKCE exchange and the
 * AuthSync component records the consent when the session appears.
 */
export async function startGoogleSignIn(returnTo: string): Promise<{ ok: false } | never> {
  try {
    window.sessionStorage.setItem(AGE_PENDING_KEY, "1");
  } catch {
    /* storage blocked: consent is asked again before trading */
  }
  const next = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  const { error } = await getBrowserSupabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  return error ? { ok: false } : (undefined as never);
}

/** Records the self-declared 18+ confirmation for the signed-in user. */
export async function confirmAge(): Promise<string | null> {
  const { data, error } = await getBrowserSupabase().rpc("confirm_age", { p_terms_version: TERMS_VERSION });
  return error ? null : (data as string);
}

/** True once, right after a Google redirect where the box was ticked. */
export function takePendingAgeConsent(): boolean {
  try {
    const pending = window.sessionStorage.getItem(AGE_PENDING_KEY) === "1";
    window.sessionStorage.removeItem(AGE_PENDING_KEY);
    return pending;
  } catch {
    return false;
  }
}

export interface ProfileSummary {
  id: string;
  email: string;
  handle: string;
  provider: "email" | "google";
  ageConfirmedAt: string | null;
  status: string;
}

/** The signed-in user's own profile (RLS: own row only). */
export async function loadOwnProfile(): Promise<ProfileSummary | null> {
  const supabase = getBrowserSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  const sub = claims?.claims?.sub;
  if (!sub) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, handle, age_confirmed_at, status")
    .eq("id", sub)
    .maybeSingle();
  if (!data) return null;
  const provider = (claims.claims.app_metadata as { provider?: string } | undefined)?.provider;
  return {
    id: data.id,
    email: String(claims.claims.email ?? ""),
    handle: data.handle,
    provider: provider === "google" ? "google" : "email",
    ageConfirmedAt: data.age_confirmed_at,
    status: data.status,
  };
}

/**
 * Calls back with (signedIn, fresh). `fresh` is true for a sign-in that just
 * happened (SIGNED_IN), false for a session restored on page load.
 */
export function onAuthChange(cb: (signedIn: boolean, fresh: boolean) => void) {
  const { data } = getBrowserSupabase().auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") cb(false, false);
    else if (event === "INITIAL_SESSION") cb(Boolean(session), false);
    else if (session && event === "SIGNED_IN") cb(true, true);
  });
  return () => data.subscription.unsubscribe();
}

export async function signOutSupabase() {
  await getBrowserSupabase().auth.signOut();
}
