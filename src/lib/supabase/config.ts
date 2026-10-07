/**
 * Which sign-in the app uses (docs/DECISIONS.md D-019).
 *
 *   NEXT_PUBLIC_AUTH_MODE=supabase  real Supabase Auth (email OTP + Google)
 *   anything else / unset           the in-browser demo (no network, any code)
 *
 * Opt-in on purpose: a stray local URL in .env.local must not switch a
 * preview to a backend that is not running. Supabase mode also needs the URL
 * and the publishable (or legacy anon) key; without them it falls back to
 * the demo so the app still builds and runs with no secrets at all.
 *
 * NEXT_PUBLIC_* values are inlined at build time and are public by design;
 * RLS and SECURITY DEFINER functions protect the data. The service-role key
 * is never read here (see src/lib/supabase/admin.ts, server-only).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
// `||`, not `??`: an empty publishable key (e.g. a blank line copied from
// .env.example) must still fall back to the legacy anon key.
const key = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  ""
);

/** Placeholder values from .env.example or a secrets screen count as unset. */
const isPlaceholder = (v: string) => v === "" || /^(placeholder|changeme|your[-_])/i.test(v) || v.includes("<");

export const SUPABASE_URL = url;
export const SUPABASE_PUBLISHABLE_KEY = key;

export const supabaseConfigured = !isPlaceholder(url) && !isPlaceholder(key) && /^https?:\/\//.test(url);

export type AuthMode = "supabase" | "demo";

export const AUTH_MODE: AuthMode =
  process.env.NEXT_PUBLIC_AUTH_MODE === "supabase" && supabaseConfigured ? "supabase" : "demo";

/** Cloudflare Turnstile site key (public). Unset = no CAPTCHA widget (local). */
export const TURNSTILE_SITE_KEY = (() => {
  const v = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  return isPlaceholder(v) ? "" : v;
})();
