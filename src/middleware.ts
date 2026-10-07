import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { AUTH_MODE, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

/**
 * Refreshes the Supabase session cookie on each request (Supabase mode only),
 * per the @supabase/ssr Next.js guide: getClaims() validates and refreshes the
 * token, setAll writes the new cookies to both the request (for Server
 * Components) and the response (for the browser), with the no-store cache
 * headers so a CDN never serves one user's cookie to another.
 * In demo mode this is a pass-through.
 */
export async function middleware(request: NextRequest) {
  if (AUTH_MODE !== "supabase") return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet, headers) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  // Must run before anything else reads the session. Do not remove.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // Skip static assets and images; everything else may need a fresh session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)"],
};
