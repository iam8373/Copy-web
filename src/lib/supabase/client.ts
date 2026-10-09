"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabaseConfigured } from "./config";

/**
 * Browser Supabase client, publishable key only. Used for public, read-only
 * live data (Realtime price updates, B3). Sign-in goes through Server Actions;
 * nothing personal is read or written from the browser.
 */
export function getBrowserSupabase() {
  if (!supabaseConfigured) throw new Error("Supabase is not configured");
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
