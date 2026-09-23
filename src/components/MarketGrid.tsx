"use client";

import { MarketCard } from "@/components/MarketCard";
import type { Market } from "@/lib/types";

export function MarketGrid({ markets }: { markets: Market[] }) {
  if (markets.length === 0) {
    return (
      <div className="rounded-xl border border-subtle bg-bg-secondary p-10 text-center">
        <p className="text-[14px] font-semibold text-content-primary">No markets here yet</p>
        <p className="mt-1 text-[13px] text-content-secondary">
          Try a different filter or check back shortly.
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
        <div key={m.id} className="w-[290px] shrink-0 snap-start sm:w-[320px]">
          <MarketCard market={m} />
        </div>
      ))}
    </div>
  );
}
