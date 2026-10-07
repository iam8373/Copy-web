import { NextResponse, type NextRequest } from "next/server";
import { AUTH_MODE } from "@/lib/supabase/config";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Google OAuth return URL (PKCE). Exchanges the one-time code for a session
 * cookie and sends the user back to the page they started from. `next` must
 * be a same-site path, so this cannot be used as an open redirect.
 */
/**
 * Public origin for the redirect. `request.url` carries the bind address
 * (0.0.0.0:3000 in dev, or the container's) rather than what the browser
 * used, so prefer the configured site URL, then the proxy's forwarded host.
 */
function publicOrigin(request: NextRequest): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site && /^https?:\/\/[^/]+$/.test(site)) return site;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  if (host && /^[A-Za-z0-9.\-]+(:\d+)?$/.test(host)) return `${proto === "https" ? "https" : "http"}://${host}`;
  return new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = publicOrigin(request);
  const code = url.searchParams.get("code");
  const raw = url.searchParams.get("next") ?? "/";
  const next = /^\/(?!\/)[\w\-./?=&%]*$/.test(raw) ? raw : "/";

  if (AUTH_MODE === "supabase" && code) {
    const { error } = await getServerSupabase().auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  const fail = new URL("/", origin);
  fail.searchParams.set("auth_error", "1");
  return NextResponse.redirect(fail);
}
