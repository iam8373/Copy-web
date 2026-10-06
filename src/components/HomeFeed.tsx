"use client";

import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import { useMarketStore } from "@/store/useMarketStore";
import { FeaturedCarousel } from "@/components/FeaturedCarousel";
import { MarketRow } from "@/components/MarketGrid";
import { FOCUS_RING } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";
import { NAV_KEY_BY_SLUG } from "@/i18n";
import { useT } from "@/i18n/LanguageProvider";

function SectionHeader({
  title,
  href,
  live,
}: {
  title: string;
  /** Omitted when there is no page that lists the whole section. */
  href?: string;
  live?: boolean;
}) {
  const { t } = useT();
  return (
    <div className="mb-3 flex items-center gap-2">
      {live && <span aria-hidden className="h-2 w-2 rounded-full bg-danger animate-pulse-dot" />}
      <h2 className="text-18 font-bold tracking-tight text-primary">{title}</h2>
      {href && (
        <Link
          href={href}
          aria-label={t("home", "viewAllIn", { section: title })}
          className={cn(
            "relative -mr-2 ml-auto flex min-h-touch items-center gap-1 rounded-btn px-2 text-13 font-semibold text-brand transition-colors duration-xs hover:bg-brand/10",
            FOCUS_RING
          )}
        >
          {t("home", "viewAll")}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}

const SECTIONS: Category[] = [
  "cricket",
  "politics",
  "entertainment",
  "economy",
  "finance",
  "sports",
  "esports",
  "tech",
  "world-news",
  "war",
  "ai",
];

export function HomeFeed() {
  const markets = useMarketStore((s) => s.markets);
  const { t } = useT();

  const popular = [...markets].sort((a, b) => b.totalVolume - a.totalVolume).slice(0, 6);
  const live = markets.filter((m) => m.isLive);

  return (
    <div className="flex flex-col gap-8">
      <FeaturedCarousel />

      <section>
        <SectionHeader title={t("home", "popular")} />
        <MarketRow markets={popular} />
      </section>

      {live.length > 0 && (
        <section className="rounded-card border border-danger/25 bg-danger/[0.04] p-3 sm:p-4">
          <SectionHeader title={t("home", "liveNow")} href="/markets/live" live />
          <MarketRow markets={live} />
        </section>
      )}

      {SECTIONS.map((category) => {
        const items = markets.filter((m) => m.category === category).slice(0, 6);
        if (items.length === 0) return null;
        return (
          <section key={category}>
            <SectionHeader
              title={t("nav", NAV_KEY_BY_SLUG[category])}
              href={`/markets/${category}`}
            />
            <MarketRow markets={items} />
          </section>
        );
      })}

      <Link
        href="/learn"
        className={cn(
          "flex items-center gap-4 rounded-card border border-subtle bg-surface-2 p-4 shadow-card transition-colors duration-xs hover:border-strong sm:p-6",
          FOCUS_RING
        )}
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-card bg-brand/15 text-brand">
          <GraduationCap className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-16 font-bold text-primary">{t("footer", "learn")}</p>
          <p className="mt-1 text-13 text-secondary">{t("home", "learnBody")}</p>
        </div>
        <ArrowRight className="ml-auto hidden h-4 w-4 shrink-0 text-secondary sm:block" aria-hidden />
      </Link>
    </div>
  );
}
