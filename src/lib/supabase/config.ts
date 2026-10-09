/**
 * Public Supabase configuration (D-020, D-021). Real Supabase Auth is the only
 * sign-in; there is no demo mode. NEXT_PUBLIC_* values are inlined at build
 * time and are public by design (RLS and SECURITY DEFINER functions protect
 * the data). The secret key lives in src/lib/server/env.ts (server-only).
 *
 * If the URL or publishable key is missing or a placeholder, the app still
 * builds and runs: sign-in shows "unavailable" and data reads show their
 * error/empty states.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

/** Placeholder values from .env.example or a secrets screen count as unset. */
const isPlaceholder = (v: string) => v === "" || /^(placeholder|changeme|your[-_])/i.test(v) || v.includes("<");

export const SUPABASE_URL = url;
export const SUPABASE_PUBLISHABLE_KEY = key;

export const supabaseConfigured = !isPlaceholder(url) && !isPlaceholder(key) && /^https?:\/\//.test(url);

/** Cloudflare Turnstile site key (public). Unset = no CAPTCHA widget (local/tests). */
export const TURNSTILE_SITE_KEY = (() => {
  const v = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  return isPlaceholder(v) ? "" : v;
})();

/**
 * Supabase Realtime for live prices. On by default; "off" skips the socket
 * and relies on the /api/prices poll (local stacks without Realtime, tests).
 */
export const REALTIME_ENABLED = process.env.NEXT_PUBLIC_SUPABASE_REALTIME?.trim() !== "off";
