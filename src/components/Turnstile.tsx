"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useTheme } from "@/components/ThemeProvider";

/**
 * Cloudflare Turnstile, loaded as the plain script with explicit rendering
 * (owner decision: no wrapper package). The token goes to Supabase Auth as
 * `captchaToken`; Supabase verifies it server-side with the secret configured
 * in the project (Auth > Bot and Abuse Protection).
 *
 * Tokens are single-use and expire after 300 s, so callers reset() after each
 * attempt. `size: "flexible"` keeps it inside a 360 px sheet.
 */

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    // The API is usable once the script has run. turnstile.ready() is not
    // allowed for scripts loaded with async/defer, so resolve on load.
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile missing")));
    s.onerror = () => {
      loading = null;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export interface TurnstileHandle {
  reset: () => void;
}

export const Turnstile = forwardRef<
  TurnstileHandle,
  { siteKey: string; onToken: (token: string | null) => void }
>(function Turnstile({ siteKey, onToken }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const tokenCb = useRef(onToken);
  tokenCb.current = onToken;
  const { theme } = useTheme();

  useImperativeHandle(ref, () => ({
    reset: () => {
      tokenCb.current(null);
      if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
    },
  }));

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled || !box.current) return;
        widget.current = api.render(box.current, {
          sitekey: siteKey,
          theme,
          size: "flexible",
          action: "email_code",
          callback: (t: string) => tokenCb.current(t),
          "expired-callback": () => tokenCb.current(null),
          "error-callback": () => tokenCb.current(null),
        });
      })
      .catch(() => tokenCb.current(null));
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey, theme]);

  return <div ref={box} data-testid="turnstile" className="min-h-touch w-full" />;
});
