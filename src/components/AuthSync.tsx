"use client";

import { useEffect } from "react";
import { useMarketStore } from "@/store/useMarketStore";
import { signOut } from "@/app/actions/auth";
import type { SessionProfile } from "@/services/auth/server";

async function fetchProfile(): Promise<SessionProfile | null> {
  const res = await fetch("/api/session", { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) return null;
  return ((await res.json()) as { profile: SessionProfile | null }).profile;
}

const EVENT = "bp-auth-changed";

/** Call after a sign-in or sign-out action so the header picks it up. */
export function notifyAuthChanged(opts: { fresh?: boolean } = {}) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: opts }));
}

/**
 * Mirrors the server-verified session into the store the UI reads (header
 * avatar, trade gating). The session itself is the Supabase auth cookie,
 * refreshed by the middleware; this only asks the server who the user is
 * (getClaims + own profile) via GET /api/session. Renders nothing.
 *
 * Also: removes the old demo session from localStorage, signs out suspended
 * accounts with a message, and reports ?auth_error=1 from /auth/callback.
 */
export function AuthSync() {
  useEffect(() => {
    const store = useMarketStore.getState;
    try {
      // Left over from the removed demo sign-in (D-021). Never trusted.
      window.localStorage.removeItem("bp-session");
    } catch {
      /* storage blocked */
    }

    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (authError) {
      store().pushToast({ titleKey: "authFailed", bodyKey: "authFailedBody", tone: "error" });
      params.delete("auth_error");
      const q = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
    }

    let alive = true;
    const sync = async (fresh: boolean) => {
      const profile = await fetchProfile().catch(() => null);
      if (!alive) return;
      if (!profile) {
        if (store().session) store().signOut();
        return;
      }
      if (profile.status !== "active") {
        await signOut().catch(() => undefined);
        store().signOut();
        store().pushToast({ titleKey: "accountSuspended", bodyKey: "accountSuspendedBody", tone: "error" });
        return;
      }
      const handle = profile.email || profile.handle;
      const known = store().session?.handle === handle;
      store().adoptSession(
        {
          method: profile.provider,
          handle,
          initial: handle.charAt(0).toUpperCase(),
          ageConfirmedAt: profile.ageConfirmedAt ?? undefined,
        },
        { announce: fresh && !known }
      );
    };

    // /auth/callback adds ?welcome=1 after a successful Google sign-in.
    const welcome = params.get("welcome") === "1";
    if (welcome) {
      params.delete("welcome");
      const q = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
    }
    void sync(welcome);
    const onChange = (e: Event) => void sync(Boolean((e as CustomEvent<{ fresh?: boolean }>).detail?.fresh));
    const onVisible = () => document.visibilityState === "visible" && void sync(false);
    window.addEventListener(EVENT, onChange);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, onChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
