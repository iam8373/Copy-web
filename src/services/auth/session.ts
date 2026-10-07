"use client";

import { AUTH_MODE } from "@/lib/supabase/config";
import { useMarketStore } from "@/store/useMarketStore";
import { signOutSupabase } from "./client";

/**
 * Signs out in whichever mode is active. Supabase mode revokes the session
 * (cookie) first; the store is cleared either way.
 */
export async function signOutEverywhere() {
  if (AUTH_MODE === "supabase") {
    try {
      await signOutSupabase();
    } catch {
      /* network failure: still clear the local view of the session */
    }
  }
  useMarketStore.getState().signOut();
}
