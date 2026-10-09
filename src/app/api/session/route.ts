import { NextResponse } from "next/server";
import { getSessionProfile } from "@/services/auth/server";

/**
 * Who is signed in (read-only). The caller's own identity from the verified
 * session cookie (getClaims) plus their own profile row; nothing else, never
 * cached. A route handler rather than a Server Action on purpose: calling an
 * action on mount makes the Next 14 router re-render the current route, which
 * broke error boundaries (React "more hooks" error on a page in its error state).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getSessionProfile();
  return NextResponse.json(
    { profile },
    { headers: { "Cache-Control": "no-store, max-age=0", Vary: "Cookie" } }
  );
}
