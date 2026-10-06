"use client";

import { MarketCard } from "@/components/MarketCard";
import type { Market } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/LanguageProvider";
import { EmptyState } from "@/components/ui";
import { motion } from "@/lib/tokens";
import { useFirstPaint } from "@/lib/useFirstPaint";

/**
 * Entry stagger for the first cards of a list: 30ms steps, at most 8 cards,
 * first paint only (docs/DESIGN.md → Motion). Later cards and re-renders
 * appear without animation.
 */
function useStagger() {
  const first = useFirstPaint();
  return (i: number) =>
    first && i < motion.staggerMax
      ? { className: "animate-fade-in-up", style: { animationDelay: `${i * motion.staggerStep}ms` } }
      : { className: undefined, style: undefined };
}

export function MarketGrid({ markets }: { markets: Market[] }) {
  const { t } = useT();
  const stagger = useStagger();

  if (markets.length === 0) {
    return <EmptyState title={t("empty", "noMarketsTitle")} body={t("empty", "noMarketsBody")} />;
  }

  return (
    <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {markets.map((m, i) => (
        <div key={m.id} data-testid="grid-item" {...stagger(i)}>
          <MarketCard market={m} />
        </div>
      ))}
    </div>
  );
}

export function MarketRow({ markets }: { markets: Market[] }) {
  const stagger = useStagger();
  return (
    // Vertical and (from sm) horizontal padding keep card focus rings inside
    // the scroll container, which would otherwise clip them.
    <div className="no-scrollbar -mx-4 -my-1 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 py-1 sm:-mx-1 sm:scroll-px-1 sm:px-1">
      {markets.map((m, i) => {
        const s = stagger(i);
        return (
          <div key={m.id} className={cn("w-72 shrink-0 snap-start sm:w-80", s.className)} style={s.style}>
            <MarketCard market={m} />
          </div>
        );
      })}
    </div>
  );
}
