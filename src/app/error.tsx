"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useT } from "@/i18n/LanguageProvider";

/**
 * Route-level error boundary. Renders inside the root layout, so header,
 * nav and the language choice remain available.
 *
 * Never shows `error.message` or a stack: those can contain internals. Only
 * the opaque `digest` Next attaches to server errors is shown and logged,
 * which lets support correlate with server logs without leaking anything.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useT();

  useEffect(() => {
    console.error("Route error", error.digest ? `digest=${error.digest}` : "(client)");
  }, [error.digest]);

  return (
    <div
      role="alert"
      data-testid="error-boundary"
      className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 text-center"
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-danger/15 text-danger">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="text-xl font-bold tracking-tight text-primary">
        {t("errors", "title")}
      </h1>
      <p className="text-14 leading-relaxed text-secondary">{t("errors", "body")}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 rounded-btn bg-brand-fill px-4 py-2 text-14 font-bold text-white transition-colors hover:bg-brand-fill-hover"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {t("errors", "retry")}
        </button>
        <Link
          href="/"
          className="rounded-btn border border-subtle bg-surface-2 px-4 py-2 text-14 font-semibold text-primary transition-colors hover:border-brand"
        >
          {t("errors", "home")}
        </Link>
      </div>
      {error.digest && (
        <p className="tnum mt-1 text-11 text-secondary">
          {t("errors", "reference", { digest: error.digest })}
        </p>
      )}
    </div>
  );
}
