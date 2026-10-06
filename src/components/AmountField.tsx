"use client";

import {
  MAX_TRADE,
  MIN_TRADE,
  TRADE_PRESETS,
  TRADE_STEP,
  clampAmount,
  formatLimit,
  validateAmount,
} from "@/lib/trade-limits";
import { useT } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

/**
 * Phase 5: shared amount control for the quick-trade modal and the market
 * detail panel. The parent owns the raw string (so "" is representable); the
 * number input, slider, presets and Max all read/write that one value and use
 * the same min/max/step from trade-limits.ts, so they can never disagree.
 *
 * Out-of-range typing is NOT silently clamped: the input keeps what the user
 * typed, an inline error explains the limit, and the parent disables Place
 * order. The slider shows the nearest in-range position meanwhile.
 */
export function AmountField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (raw: string) => void;
}) {
  const { t } = useT();
  const v = validateAmount(value);
  const sliderValue = v.ok ? v.value : clampAmount(Number(value));
  const errorId = `${id}-error`;
  const limitsId = `${id}-limits`;
  const min = formatLimit(MIN_TRADE);
  const max = formatLimit(MAX_TRADE);

  const message = v.ok
    ? null
    : v.reason === "belowMin"
      ? t("trade", "errorMin", { min })
      : v.reason === "aboveMax"
        ? t("trade", "errorMax", { max })
        : t("trade", "errorInvalid");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-12 font-medium text-secondary" htmlFor={id}>
          {t("trade", "amount")}
        </label>
        <span id={limitsId} className="tnum text-11 text-secondary">
          {t("trade", "limits", { min, max })}
        </span>
      </div>

      <input
        id={id}
        data-testid="amount-input"
        type="number"
        inputMode="decimal"
        min={MIN_TRADE}
        max={MAX_TRADE}
        step={TRADE_STEP}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!v.ok}
        aria-describedby={v.ok ? limitsId : `${errorId} ${limitsId}`}
        className={cn(
          "tnum h-11 w-full rounded-btn border bg-surface-3 px-3 text-16 font-semibold text-primary outline-none",
          v.ok ? "border-subtle focus:border-brand" : "border-danger focus:border-danger"
        )}
      />

      {message && (
        <p id={errorId} data-testid="amount-error" className="text-12 font-medium text-danger">
          {message}
        </p>
      )}

      <input
        type="range"
        data-testid="amount-slider"
        min={MIN_TRADE}
        max={MAX_TRADE}
        step={TRADE_STEP}
        value={sliderValue}
        onChange={(e) => onChange(e.target.value)}
        className="h-1.5 w-full accent-brand"
        aria-label={t("trade", "slider")}
      />

      <div className="flex gap-2">
        {TRADE_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(String(p))}
            className="flex-1 rounded-btn border border-subtle bg-surface-3 py-1.5 text-12 font-semibold text-secondary transition-colors hover:text-primary"
          >
            {formatLimit(p)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(String(MAX_TRADE))}
          className="flex-1 rounded-btn border border-subtle bg-surface-3 py-1.5 text-12 font-semibold text-secondary transition-colors hover:text-primary"
        >
          {t("trade", "max")}
        </button>
      </div>
    </div>
  );
}
