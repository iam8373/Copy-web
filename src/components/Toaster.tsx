"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useMarketStore } from "@/store/useMarketStore";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/LanguageProvider";
import type { Dictionary } from "@/i18n";

const ICONS = {
  success: CheckCircle2,
  info: Info,
  error: XCircle,
};

export function Toaster() {
  const toasts = useMarketStore((s) => s.toasts);
  const dismiss = useMarketStore((s) => s.dismissToast);
  const { t } = useT();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.tone];
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-subtle bg-bg-secondary p-3 shadow-2xl animate-slide-up"
          >
            <Icon
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                toast.tone === "success" && "text-accent-green",
                toast.tone === "info" && "text-accent-blue",
                toast.tone === "error" && "text-accent-red"
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-content-primary">
                {t("toast", toast.titleKey as keyof Dictionary["toast"], toast.vars)}
              </p>
              {toast.bodyKey && (
                <p className="mt-0.5 text-[12px] text-content-secondary">
                  {t("toast", toast.bodyKey as keyof Dictionary["toast"], toast.vars)}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={t("toast", "dismiss")}
              className="shrink-0 text-content-secondary transition-colors hover:text-content-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
