import { NextResponse, type NextRequest } from "next/server";
import { finishOAuth } from "@/services/auth/server";
import { publicOrigin, safeNext } from "@/lib/server/origin";

/**
 * Google OAuth return URL (PKCE). Exchanges the one-time code for a session
 * cookie, records the 18+ consent captured before the redirect (signed
 * cookie), then sends the user back. `next` must be a same-site path, so this
 * is not an open redirect. Failures land on "/?auth_error=1".
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = publicOrigin(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (code && (await finishOAuth(code))) {
    const to = new URL(next, origin);
    to.searchParams.set("welcome", "1"); // AuthSync shows the welcome toast once
    return NextResponse.redirect(to);
  }
  const fail = new URL("/", origin);
  fail.searchParams.set("auth_error", "1");
  return NextResponse.redirect(fail);
}
