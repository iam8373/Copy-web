"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useMarketStore } from "@/store/useMarketStore";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/LanguageProvider";
import type { Dictionary } from "@/i18n";
import { useOutcomeLabel } from "@/lib/market-text";

const ICONS = {
  success: CheckCircle2,
  info: Info,
  error: XCircle,
};

export function Toaster() {
  const toasts = useMarketStore((s) => s.toasts);
  const dismiss = useMarketStore((s) => s.dismissToast);
  const markets = useMarketStore((s) => s.markets);
  const { t } = useT();
  const ol = useOutcomeLabel();
  // Outcome names follow the active language at display time.
  const varsOf = (toast: (typeof toasts)[number]) => {
    if (!toast.outcomeRef) return toast.vars;
    const o = markets.find((m) => m.id === toast.outcomeRef!.marketId)?.outcomes.find((x) => x.id === toast.outcomeRef!.outcomeId);
    return o ? { ...toast.vars, outcome: ol(o) } : toast.vars;
  };

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.tone];
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 rounded-card border border-subtle bg-surface-2 p-3 shadow-dialog animate-slide-up"
          >
            <Icon
              className={cn(
                "mt-1 h-4 w-4 shrink-0",
                toast.tone === "success" && "text-success",
                toast.tone === "info" && "text-brand",
                toast.tone === "error" && "text-danger"
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-13 font-semibold text-primary">
                {t("toast", toast.titleKey as keyof Dictionary["toast"], varsOf(toast))}
              </p>
              {toast.bodyKey && (
                <p className="mt-1 text-12 text-secondary">
                  {t("toast", toast.bodyKey as keyof Dictionary["toast"], varsOf(toast))}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={t("toast", "dismiss")}
              className="shrink-0 text-secondary transition-colors hover:text-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
