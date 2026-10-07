import { NextResponse, type NextRequest } from "next/server";
import { AUTH_MODE } from "@/lib/supabase/config";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Google OAuth return URL (PKCE). Exchanges the one-time code for a session
 * cookie and sends the user back to the page they started from. `next` must
 * be a same-site path, so this cannot be used as an open redirect.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const raw = url.searchParams.get("next") ?? "/";
  const next = /^\/(?!\/)[\w\-./?=&%]*$/.test(raw) ? raw : "/";

  if (AUTH_MODE === "supabase" && code) {
    const { error } = await getServerSupabase().auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  const fail = new URL("/", url.origin);
  fail.searchParams.set("auth_error", "1");
  return NextResponse.redirect(fail);
}
