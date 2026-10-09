import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { SUPABASE_URL } from "./config";
import { supabaseSecretKey } from "@/lib/server/env";

/**
 * Privileged client (bypasses RLS). Server code only, after its own checks:
 * rate limits, scripts, later the admin panel. Never pass its results to the
 * browser without filtering. No session is stored.
 */
export function getAdminSupabase() {
  const key = supabaseSecretKey();
  if (!SUPABASE_URL || !key) throw new Error("Supabase server key is not configured");
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
