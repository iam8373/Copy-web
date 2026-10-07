import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

/**
 * Server Supabase client for Server Components, Server Actions and Route
 * Handlers, acting as the signed-in user (RLS applies). Create one per
 * request. Server Components cannot write cookies, so setAll is best-effort
 * there; src/middleware.ts refreshes the session on every request.
 *
 * Verify identity with `supabase.auth.getClaims()`, never getSession().
 */
export function getServerSupabase() {
  const store = cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // Called from a Server Component: the middleware writes the cookies.
        }
      },
    },
  });
}
