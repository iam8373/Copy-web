"use client";

import { MarketCard } from "@/components/MarketCard";
import type { Market } from "@/lib/types";
import { useT } from "@/i18n/LanguageProvider";
import { EmptyState } from "@/components/ui";

export function MarketGrid({ markets }: { markets: Market[] }) {
  const { t } = useT();

  if (markets.length === 0) {
    return <EmptyState title={t("empty", "noMarketsTitle")} body={t("empty", "noMarketsBody")} />;
  }

  return (
    <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {markets.map((m) => (
        <MarketCard key={m.id} market={m} />
      ))}
    </div>
  );
}

export function MarketRow({ markets }: { markets: Market[] }) {
  return (
    // Vertical and (from sm) horizontal padding keep card focus rings inside
    // the scroll container, which would otherwise clip them.
    <div className="no-scrollbar -mx-4 -my-1 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 py-1 sm:-mx-1 sm:scroll-px-1 sm:px-1">
      {markets.map((m) => (
        <div key={m.id} className="w-72 shrink-0 snap-start sm:w-80">
          <MarketCard market={m} />
        </div>
      ))}
    </div>
  );
}
