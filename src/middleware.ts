import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/supabase/config";

/**
 * Refreshes the Supabase session cookie on each request,
 * per the @supabase/ssr Next.js guide: getClaims() validates and refreshes the
 * token, setAll writes the new cookies to both the request (for Server
 * Components) and the response (for the browser), with the no-store cache
 * headers so a CDN never serves one user's cookie to another.
 * Without Supabase configuration it is a pass-through.
 */
const isAdmin = (path: string) => path === "/admin" || path.startsWith("/admin/");

/** /admin is never cached or indexed, whatever the page does. */
function adminHeaders(res: NextResponse) {
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export async function middleware(request: NextRequest) {
  const admin = isAdmin(request.nextUrl.pathname);
  if (!supabaseConfigured) return admin ? adminHeaders(new NextResponse(null, { status: 404 })) : NextResponse.next();

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
  const { data } = await supabase.auth.getClaims();

  // Admin (R2): signed-out visitors go home; role and MFA are checked by the
  // admin layout/pages and again by the database on every write.
  if (admin) {
    if (!data?.claims?.sub) {
      const home = request.nextUrl.clone();
      home.pathname = "/";
      home.search = "";
      return adminHeaders(NextResponse.redirect(home));
    }
    return adminHeaders(response);
  }
  return response;
}

export const config = {
  // Skip static assets and images; everything else may need a fresh session.
  // Also skips the healthcheck, which must not depend on Supabase.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/|api/health|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)"],
};
