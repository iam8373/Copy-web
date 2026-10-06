"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { useMarketStore } from "@/store/useMarketStore";
import { FlashValue } from "@/components/FlashValue";
import { cn, formatEndDate, formatPercent, formatVolume } from "@/lib/utils";
import { useT } from "@/i18n/LanguageProvider";
import { getMarketText } from "@/lib/market-text";

export function FeaturedCarousel() {
  const markets = useMarketStore((s) => s.markets);
  const featured = [...markets].sort((a, b) => b.totalVolume - a.totalVolume).slice(0, 5);
  const [index, setIndex] = useState(0);
  const { locale } = useT();

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % featured.length), 7000);
    return () => clearInterval(id);
  }, [featured.length]);

  const market = featured[index];
  if (!market) return null;
  const text = getMarketText(market, locale);

  return (
    <section className="rounded-card border border-subtle bg-surface-2 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-brand" />
        <h2 className="text-13 font-bold uppercase tracking-wide text-secondary">
          Featured Markets
        </h2>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous featured market"
            onClick={() => setIndex((i) => (i - 1 + featured.length) % featured.length)}
            className="grid h-7 w-7 place-items-center rounded-btn border border-subtle bg-surface-3 text-secondary transition-colors hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next featured market"
            onClick={() => setIndex((i) => (i + 1) % featured.length)}
            className="grid h-7 w-7 place-items-center rounded-btn border border-subtle bg-surface-3 text-secondary transition-colors hover:text-primary"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Link href={`/market/${market.slug}`} className="mt-4 block">
        <p className="text-11 font-semibold uppercase tracking-wide text-brand">
          {market.category} • {market.subcategory}
        </p>
        <h3 className="mt-1 text-xl font-bold leading-tight text-primary sm:text-2xl">
          {text.title}
        </h3>
        <p className="mt-2 line-clamp-2 max-w-3xl text-13 leading-relaxed text-secondary">
          {text.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {market.outcomes.slice(0, 4).map((o, i) => (
            <span
              key={o.id}
              className={cn(
                "flex items-center gap-2 rounded-btn border px-3 py-1.5 text-13 font-bold",
                market.isBinary && i === 0 && "border-success/30 bg-success/10 text-success",
                market.isBinary && i === 1 && "border-danger/30 bg-danger/10 text-danger",
                !market.isBinary && "border-subtle bg-surface-3 text-primary"
              )}
            >
              <span className="max-w-40 truncate">{o.label}</span>
              <FlashValue value={o.price}>{formatPercent(o.price, 1)}</FlashValue>
            </span>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-12 text-secondary">
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
              i === index ? "bg-brand-fill" : "bg-surface-3"
            )}
          />
        ))}
      </div>
    </section>
  );
}
