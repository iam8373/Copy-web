"use client";

import { useEffect, useState } from "react";
import "./globals.css";
import { DICTIONARIES, STORAGE_KEY, isLocale, type Locale } from "@/i18n";

/**
 * Last-resort boundary for errors thrown by the root layout itself. It
 * replaces the whole document, so it renders its own <html>/<body> and cannot
 * rely on LanguageProvider; it reads the stored language directly instead.
 * No error message or stack is ever rendered.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isLocale(stored)) setLocale(stored);
    } catch {
      /* storage unavailable — English */
    }
    console.error("Global error", error.digest ? `digest=${error.digest}` : "(client)");
  }, [error.digest]);

  const e = DICTIONARIES[locale].errors;

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-surface-1 font-sans text-primary antialiased">
        <main
          role="alert"
          className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-4 text-center"
        >
          <h1 className="text-xl font-bold tracking-tight">{e.title}</h1>
          <p className="text-14 leading-relaxed text-secondary">{e.body}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-btn bg-brand-fill px-4 py-2 text-14 font-bold text-white"
            >
              {e.retry}
            </button>
            {/* A plain anchor: the router may be the thing that broke. */}
            <a
              href="/"
              className="rounded-btn border border-subtle bg-surface-2 px-4 py-2 text-14 font-semibold"
            >
              {e.home}
            </a>
          </div>
          {error.digest && (
            <p className="mt-1 text-11 text-secondary">
              {e.reference.replace("{digest}", error.digest)}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
