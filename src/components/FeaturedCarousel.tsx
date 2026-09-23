"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { useMarketStore } from "@/store/useMarketStore";
import { FlashValue } from "@/components/FlashValue";
import { cn, formatEndDate, formatPercent, formatVolume } from "@/lib/utils";

export function FeaturedCarousel() {
  const markets = useMarketStore((s) => s.markets);
  const featured = [...markets].sort((a, b) => b.totalVolume - a.totalVolume).slice(0, 5);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % featured.length), 7000);
    return () => clearInterval(id);
  }, [featured.length]);

  const market = featured[index];
  if (!market) return null;

  return (
    <section className="rounded-xl border border-subtle bg-bg-secondary p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-accent-blue" />
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-content-secondary">
          Featured Markets
        </h2>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous featured market"
            onClick={() => setIndex((i) => (i - 1 + featured.length) % featured.length)}
            className="grid h-7 w-7 place-items-center rounded-lg border border-subtle bg-bg-tertiary text-content-secondary transition-colors hover:text-content-primary"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next featured market"
            onClick={() => setIndex((i) => (i + 1) % featured.length)}
            className="grid h-7 w-7 place-items-center rounded-lg border border-subtle bg-bg-tertiary text-content-secondary transition-colors hover:text-content-primary"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Link href={`/market/${market.slug}`} className="mt-4 block">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-blue">
          {market.category} • {market.subcategory}
        </p>
        <h3 className="mt-1 text-xl font-bold leading-tight text-content-primary sm:text-2xl">
          {market.title}
        </h3>
        <p className="mt-2 line-clamp-2 max-w-3xl text-[13px] leading-relaxed text-content-secondary">
          {market.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {market.outcomes.slice(0, 4).map((o, i) => (
            <span
              key={o.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-bold",
                market.isBinary && i === 0 && "border-accent-green/30 bg-accent-green/10 text-accent-green",
                market.isBinary && i === 1 && "border-accent-red/30 bg-accent-red/10 text-accent-red",
                !market.isBinary && "border-subtle bg-bg-tertiary text-content-primary"
              )}
            >
              <span className="max-w-[160px] truncate">{o.label}</span>
              <FlashValue value={o.price}>{formatPercent(o.price, 1)}</FlashValue>
            </span>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-content-secondary">
          <span className="tnum">Vol {formatVolume(market.totalVolume)}</span>
          <span>Ends {formatEndDate(market.endDate)}</span>
          <span className="truncate">Resolves via {market.resolutionSource}</span>
        </div>
      </Link>

      <div className="mt-4 flex gap-1.5">
        {featured.map((f, i) => (
          <button
            key={f.id}
            type="button"
            aria-label={`Show featured market ${i + 1}`}
            onClick={() => setIndex(i)}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i === index ? "bg-accent-blue" : "bg-subtle"
            )}
          />
        ))}
      </div>
    </section>
  );
}
