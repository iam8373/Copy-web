"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import { Chip, Segmented } from "@/components/ui";
import { useMarketStore } from "@/store/useMarketStore";
import { MarketGrid } from "@/components/MarketGrid";
import { MarketsUnavailable } from "@/components/MarketsUnavailable";
import { SORT_OPTIONS, type CategoryMeta, type SortOption } from "@/lib/types";
import { formatVolume } from "@/lib/utils";
import { NAV_KEY_BY_SLUG, type Dictionary } from "@/i18n";
import { useT } from "@/i18n/LanguageProvider";

const SORT_KEY: Record<SortOption, keyof Dictionary["sort"]> = {
  Trending: "trending",
  Popular: "popular",
  "Starting Soon": "startingSoon",
};

export function CategoryView({ meta }: { meta: CategoryMeta }) {
  const markets = useMarketStore((s) => s.markets);
  const status = useMarketStore((s) => s.marketsStatus);
  const [subFilter, setSubFilter] = useState(meta.subFilters[0].label);
  const [sort, setSort] = useState<SortOption>("Trending");
  const { t } = useT();

  const scoped = useMemo(
    () =>
      meta.slug === "live"
        ? markets.filter((m) => m.isLive)
        : markets.filter((m) => m.category === meta.slug),
    [markets, meta.slug]
  );

  const filtered = useMemo(() => {
    // The first chip in every category is the category name itself and shows everything.
    const isAll = subFilter === meta.subFilters[0].label;
    let out = scoped;
    if (!isAll && subFilter === "Live") out = scoped.filter((m) => m.isLive);
    else if (!isAll)
      out = scoped.filter(
        (m) =>
          m.subcategory.toLowerCase() === subFilter.toLowerCase() ||
          m.category.toLowerCase() === subFilter.toLowerCase() ||
          m.category.replace(/-/g, " ").toLowerCase() === subFilter.toLowerCase() ||
          m.tags.some((t) => t.replace(/-/g, " ") === subFilter.toLowerCase())
      );

    const sorted = [...out];
    if (sort === "Trending") sorted.sort((a, b) => b.volumeChange24h - a.volumeChange24h);
    else if (sort === "Popular") sorted.sort((a, b) => b.totalVolume - a.totalVolume);
    else {
      const now = Date.now();
      const end = (m: (typeof out)[number]) => {
        const t = +new Date(m.endDate);
        // Ended markets sort after every open one.
        return t < now ? Number.MAX_SAFE_INTEGER - (now - t) : t;
      };
      sorted.sort((a, b) => end(a) - end(b));
    }
    return sorted;
  }, [meta.subFilters, scoped, sort, subFilter]);

  const liveMarkets = filtered.filter((m) => m.isLive);
  const restMarkets = meta.slug === "live" ? [] : filtered.filter((m) => !m.isLive);
  const totalVolume = scoped.reduce((sum, m) => sum + m.totalVolume, 0);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-24 font-bold tracking-tight text-primary">
          {t("nav", NAV_KEY_BY_SLUG[meta.slug])}
        </h1>
        <p className="text-13 text-secondary">
          {meta.blurb}{" "}
          <span className="tnum whitespace-nowrap">
            {t("category", "marketsAndVolume", {
              count: scoped.length,
              volume: formatVolume(totalVolume),
            })}
          </span>
        </p>
      </header>

      {/* py-1.5 leaves room for the chips' touch-size hit areas and focus rings,
          which an overflow-x container would otherwise clip. */}
      <div className="no-scrollbar -mx-4 -my-1.5 flex gap-2 overflow-x-auto px-4 py-1.5 sm:mx-0 sm:flex-wrap sm:px-0">
        {meta.subFilters.map((f) => (
          <Chip
            key={f.label}
            data-testid="subfilter-chip"
            data-filter={f.label}
            data-highlighted={f.isHighlighted ? "true" : "false"}
            selected={f.label === subFilter}
            tone={f.isHighlighted ? "highlight" : "neutral"}
            icon={f.isHighlighted ? <Star /> : undefined}
            onClick={() => setSubFilter(f.label)}
          >
            {/* Display text is translated; f.label stays the filter key. */}
            {t("chips", f.label as keyof Dictionary["chips"])}
          </Chip>
        ))}
      </div>

      <div className="flex items-center gap-3 border-b border-subtle pb-3">
        {/* Segmented control, so sorting reads differently from the filter chips. */}
        <Segmented
          label={t("category", "sortBy")}
          value={sort}
          onValueChange={setSort}
          options={SORT_OPTIONS.map((s) => ({ value: s, label: t("sort", SORT_KEY[s]) }))}
          optionProps={(s) => ({ "data-testid": "sort-option", "data-sort": s })}
        />
        <span
          className="tnum ml-auto shrink-0 whitespace-nowrap text-12 text-secondary"
          data-testid="shown-count"
        >
          {t("category", "shown", { count: filtered.length })}
        </span>
      </div>

      {status === "error" && <MarketsUnavailable />}

      {liveMarkets.length > 0 && (
        <section
          className="rounded-card border border-danger/25 bg-danger/[0.04] p-3 sm:p-4"
          data-testid="live-section"
        >
          <div className="mb-3 flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full bg-danger animate-pulse-dot"
              data-testid="live-pulse"
            />
            <h2 className="text-16 font-bold text-primary">
              {t("category", "liveHeading")}
            </h2>
            <span className="tnum ml-auto text-12 text-secondary">
              {t("category", "liveCount", { count: liveMarkets.length })}
            </span>
          </div>
          <MarketGrid markets={liveMarkets} />
        </section>
      )}

      {meta.slug !== "live" && (
        <section>
          {liveMarkets.length > 0 && (
            <h2 className="mb-3 text-16 font-bold text-primary">
              {t("category", "allMarkets", {
                category: t("nav", NAV_KEY_BY_SLUG[meta.slug]).toLowerCase(),
              })}
            </h2>
          )}
          <MarketGrid markets={restMarkets} />
        </section>
      )}
    </div>
  );
}
