"use client";

import { MarketCard } from "@/components/MarketCard";
import type { Market } from "@/lib/types";
import { useT } from "@/i18n/LanguageProvider";

export function MarketGrid({ markets }: { markets: Market[] }) {
  const { t } = useT();

  if (markets.length === 0) {
    return (
      <div className="rounded-card border border-subtle bg-surface-2 p-12 text-center">
        <p className="text-14 font-semibold text-primary">
          {t("empty", "noMarketsTitle")}
        </p>
        <p className="mt-1 text-13 text-secondary">
          {t("empty", "noMarketsBody")}
        </p>
      </div>
    );
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
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {markets.map((m) => (
        <div key={m.id} className="w-72 shrink-0 snap-start sm:w-80">
          <MarketCard market={m} />
        </div>
      ))}
    </div>
  );
}
