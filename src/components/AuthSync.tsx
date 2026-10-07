"use client";

import { useEffect } from "react";
import { AUTH_MODE } from "@/lib/supabase/config";
import { useMarketStore } from "@/store/useMarketStore";
import {
  confirmAge,
  loadOwnProfile,
  onAuthChange,
  signOutSupabase,
  takePendingAgeConsent,
} from "@/services/auth/client";

/**
 * Supabase mode only: mirrors the server-verified auth session into the store
 * that the UI already reads (header avatar, trade gating). Renders nothing.
 *
 * - Fresh sign-in (email code or Google return): adopt + welcome toast.
 * - Page load with an existing cookie session: adopt silently.
 * - Google return with the 18+ box ticked: record the consent now.
 * - Suspended account: sign out and say why.
 * - ?auth_error=1 from /auth/callback: tell the user it failed.
 */
export function AuthSync() {
  useEffect(() => {
    if (AUTH_MODE !== "supabase") return;
    const store = useMarketStore.getState;

    const params = new URLSearchParams(window.location.search);
    if (params.get("auth_error")) {
      store().pushToast({ titleKey: "authFailed", bodyKey: "authFailedBody", tone: "error" });
      params.delete("auth_error");
      const q = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
    }

    let wasSignedIn = false;
    const stop = onAuthChange((signedIn, fresh) => {
      // Supabase warns against awaiting other auth calls inside this callback
      // (it can deadlock), so the work is deferred to the next task.
      setTimeout(async () => {
        if (!signedIn) {
          if (store().session) store().signOut();
          wasSignedIn = false;
          return;
        }
        const profile = await loadOwnProfile();
        if (!profile) return;
        if (profile.status !== "active") {
          await signOutSupabase();
          store().signOut();
          store().pushToast({ titleKey: "accountSuspended", bodyKey: "accountSuspendedBody", tone: "error" });
          return;
        }
        let ageConfirmedAt = profile.ageConfirmedAt;
        if (takePendingAgeConsent()) ageConfirmedAt = (await confirmAge()) ?? ageConfirmedAt;
        const handle = profile.email || profile.handle;
        store().adoptSession(
          {
            method: profile.provider,
            handle,
            initial: handle.charAt(0).toUpperCase(),
            ageConfirmedAt: ageConfirmedAt ?? undefined,
            userId: profile.id,
          },
          { announce: fresh && !wasSignedIn }
        );
        wasSignedIn = true;
      }, 0);
    });
    return stop;
  }, []);

  return null;
}
