"use client";

import { Languages } from "lucide-react";
import { LOCALES, LOCALE_META } from "@/i18n";
import { useT } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

/**
 * Shared language selector. `variant="chips"` is used in the mobile More
 * sheet; `variant="select"` gives desktop (header/footer) a compact control,
 * which previously had no way to change language at all.
 */
export function LanguagePicker({
  variant = "chips",
  onPick,
}: {
  variant?: "chips" | "select";
  onPick?: () => void;
}) {
  const { locale, setLocale, t } = useT();

  if (variant === "select") {
    return (
      <label className="flex items-center gap-2 text-13 text-secondary">
        <Languages className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">{t("header", "language")}</span>
        <select
          aria-label={t("header", "language")}
          data-testid="language-select"
          value={locale}
          onChange={(e) => {
            setLocale(e.target.value as (typeof LOCALES)[number]);
            onPick?.();
          }}
          className="rounded-btn border border-subtle bg-surface-2 px-2 py-1 text-13 font-semibold text-primary outline-none focus:border-brand"
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {LOCALE_META[l].label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2 px-1">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          data-testid="language-chip"
          aria-pressed={l === locale}
          onClick={() => {
            setLocale(l);
            onPick?.();
          }}
          className={cn(
            "rounded-btn border px-3 py-1.5 text-12 font-semibold transition-colors",
            l === locale
              ? "border-brand bg-brand/15 text-brand"
              : "border-subtle bg-surface-3 text-secondary"
          )}
        >
          {LOCALE_META[l].label}
        </button>
      ))}
    </div>
  );
}
