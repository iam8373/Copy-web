"use client";

import { Languages } from "lucide-react";
import { LOCALES, LOCALE_META } from "@/i18n";
import { useT } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";
import { Chip, FOCUS_RING } from "@/components/ui";

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
          className={cn(
            "h-10 rounded-btn border border-subtle bg-surface-2 px-2 text-13 font-semibold text-primary transition-colors duration-xs hover:border-strong",
            FOCUS_RING
          )}
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
    <div className="mt-3 flex flex-wrap gap-2">
      {LOCALES.map((l) => (
        <Chip
          key={l}
          data-testid="language-chip"
          selected={l === locale}
          onClick={() => {
            setLocale(l);
            onPick?.();
          }}
          className="text-13"
        >
          {LOCALE_META[l].label}
        </Chip>
      ))}
    </div>
  );
}
