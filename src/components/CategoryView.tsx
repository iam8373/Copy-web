"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import { useMarketStore } from "@/store/useMarketStore";
import { MarketGrid } from "@/components/MarketGrid";
import { SORT_OPTIONS, type CategoryMeta, type SortOption } from "@/lib/types";
import { cn, formatVolume } from "@/lib/utils";
import { NAV_KEY_BY_SLUG, type Dictionary } from "@/i18n";
import { useT } from "@/i18n/LanguageProvider";

export function CategoryView({ meta }: { meta: CategoryMeta }) {
  const markets = useMarketStore((s) => s.markets);
  const [subFilter, setSubFilter] = useState(meta.subFilters[0].label);
  const [sort, setSort] = useState<SortOption>("Popular");
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
    if (sort === "Popular") sorted.sort((a, b) => b.totalVolume - a.totalVolume);
    else if (sort === "Starting Soon")
      sorted.sort((a, b) => +new Date(a.endDate) - +new Date(b.endDate));
    return sorted;
  }, [meta.subFilters, scoped, sort, subFilter]);

  const liveMarkets = filtered.filter((m) => m.isLive);
  const restMarkets = meta.slug === "live" ? [] : filtered.filter((m) => !m.isLive);
  const totalVolume = scoped.reduce((sum, m) => sum + m.totalVolume, 0);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-primary">
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

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {meta.subFilters.map((f) => {
          const active = f.label === subFilter;
          return (
            <button
              key={f.label}
              type="button"
              data-testid="subfilter-chip"
              data-filter={f.label}
              data-highlighted={f.isHighlighted ? "true" : "false"}
              data-active={active ? "true" : "false"}
              onClick={() => setSubFilter(f.label)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-btn border px-3 py-1.5 text-12 font-semibold transition-colors",
                active && "border-brand bg-brand/15 text-brand",
                !active &&
                  f.isHighlighted &&
                  "border-warning/40 bg-warning/10 text-warning hover:border-warning",
                !active &&
                  !f.isHighlighted &&
                  "border-subtle bg-surface-2 text-secondary hover:text-primary"
              )}
            >
              {f.isHighlighted && <Star className="h-3 w-3 shrink-0" />}
              {/* Display text is translated; f.label stays the filter key. */}
              {t("chips", f.label as keyof Dictionary["chips"])}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 border-b border-subtle pb-2">
        {SORT_OPTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSort(s)}
            data-testid="sort-option"
            className={cn(
              "rounded-btn px-3 py-1 text-13 font-semibold transition-colors",
              s === sort
                ? "bg-surface-3 text-primary"
                : "text-secondary hover:text-primary"
            )}
          >
            {s === "Starting Soon"
              ? t("sort", "startingSoon")
              : s === "All"
                ? t("sort", "all")
                : t("sort", "popular")}
          </button>
        ))}
        <span
          className="tnum ml-auto whitespace-nowrap pl-2 text-12 text-secondary"
          data-testid="shown-count"
        >
          {t("category", "shown", { count: filtered.length })}
        </span>
      </div>

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
