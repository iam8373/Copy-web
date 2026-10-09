import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Server-only configuration. Nothing here may be imported by client code
 * (`server-only` makes that a build error). Values are read at request time,
 * so secrets set as Railway runtime variables work without a rebuild.
 */

/** The one server key: the new-style secret key (`sb_secret_…`), D-021. */
export function supabaseSecretKey(): string {
  return process.env.SUPABASE_SECRET_KEY?.trim() ?? "";
}

/**
 * Public email sign-in needs custom SMTP (D-021). Until then the sheet shows
 * Google only and the email actions refuse. Exactly "true" enables it.
 */
export function emailOtpEnabled(): boolean {
  return process.env.EMAIL_OTP_ENABLED?.trim() === "true";
}

const int = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : d;
};

/** Sign-in attempt limits (per 10-minute window). Tests raise them via env. */
export function signInLimits() {
  return {
    windowSeconds: 600,
    perIp: int(process.env.AUTH_RATE_LIMIT_PER_IP, 20),
    perEmail: int(process.env.AUTH_RATE_LIMIT_PER_EMAIL, 5),
  };
}

/**
 * Key for signing the short-lived 18+ consent cookie that survives the Google
 * redirect. AUTH_COOKIE_SECRET if set (32+ chars); otherwise derived from the
 * secret key so a deployment never runs without one.
 */
function cookieKey(): Buffer {
  const own = process.env.AUTH_COOKIE_SECRET?.trim() ?? "";
  const base = own.length >= 32 ? own : `derived:${supabaseSecretKey()}`;
  return createHash("sha256").update(`bp-consent-v1:${base}`).digest();
}

export function sign(value: string): string {
  const mac = createHmac("sha256", cookieKey()).update(value).digest("base64url");
  return `${value}.${mac}`;
}

export function verify(signed: string | undefined): string | null {
  if (!signed) return null;
  const i = signed.lastIndexOf(".");
  if (i <= 0) return null;
  const value = signed.slice(0, i);
  const expected = Buffer.from(sign(value).slice(i + 1));
  const got = Buffer.from(signed.slice(i + 1));
  return expected.length === got.length && timingSafeEqual(expected, got) ? value : null;
}

/** SHA-256 hex of a value with a purpose prefix (rate-limit keys, never raw). */
export function hashKey(purpose: string, value: string): string {
  return createHash("sha256").update(`${purpose}:${value.toLowerCase()}`).digest("hex");
}
