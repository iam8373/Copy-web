"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { AUTH_MODE, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

/**
 * Browser Supabase client (cookie session shared with the server).
 * createBrowserClient is a singleton, so calling this repeatedly is cheap.
 * Only valid in Supabase mode; callers check AUTH_MODE first.
 */
export function getBrowserSupabase() {
  if (AUTH_MODE !== "supabase") throw new Error("Supabase auth is not enabled");
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
