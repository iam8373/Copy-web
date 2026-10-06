"use client";

import { useT } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

/** A single placeholder block. Pulses only when the user allows motion. */
export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("rounded-btn bg-surface-3 motion-safe:animate-pulse", className)}
    />
  );
}

/**
 * Wraps a skeleton layout. aria-busy + a translated, visually hidden label
 * tell assistive tech the region is loading. Deliberately not role="status":
 * that role is reserved for the trade confirmation overlay.
 */
export function SkeletonRegion({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  return (
    <div aria-busy="true" aria-live="polite" data-testid="loading-skeleton">
      <span className="sr-only">{t("loading", "label")}</span>
      {children}
    </div>
  );
}

/** Card-shaped placeholder matching MarketCard's footprint. */
export function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-subtle bg-surface-2 p-4">
      <SkeletonBlock className="h-3 w-1/3" />
      <SkeletonBlock className="h-4 w-5/6" />
      <SkeletonBlock className="h-4 w-2/3" />
      <div className="grid grid-cols-2 gap-2">
        <SkeletonBlock className="h-12" />
        <SkeletonBlock className="h-12" />
      </div>
      <SkeletonBlock className="h-3 w-1/2" />
    </div>
  );
}

export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
