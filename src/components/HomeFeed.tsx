"use client";

import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import { useMarketStore } from "@/store/useMarketStore";
import { FeaturedCarousel } from "@/components/FeaturedCarousel";
import { MarketRow } from "@/components/MarketGrid";
import type { Category } from "@/lib/types";

function SectionHeader({
  title,
  href,
  live,
}: {
  title: string;
  href: string;
  live?: boolean;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {live && <span className="h-2 w-2 rounded-full bg-accent-red animate-pulse-dot" />}
      <h2 className="text-[17px] font-bold tracking-tight text-content-primary">{title}</h2>
      <Link
        href={href}
        className="ml-auto flex items-center gap-1 text-[13px] font-semibold text-accent-blue transition-opacity hover:opacity-80"
      >
        View all
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

const SECTIONS: Array<{ title: string; category: Category }> = [
  { title: "Cricket", category: "cricket" },
  { title: "Politics", category: "politics" },
  { title: "Entertainment", category: "entertainment" },
  { title: "Economy", category: "economy" },
  { title: "Finance", category: "finance" },
  { title: "Sports", category: "sports" },
  { title: "Esports", category: "esports" },
  { title: "Tech", category: "tech" },
  { title: "World News", category: "world-news" },
  { title: "War", category: "war" },
  { title: "AI", category: "ai" },
];

export function HomeFeed() {
  const markets = useMarketStore((s) => s.markets);

  const popular = [...markets].sort((a, b) => b.totalVolume - a.totalVolume).slice(0, 6);
  const live = markets.filter((m) => m.isLive);

  return (
    <div className="flex flex-col gap-8">
      <FeaturedCarousel />

      <section>
        <SectionHeader title="Popular" href="/markets/cricket" />
        <MarketRow markets={popular} />
      </section>

      {live.length > 0 && (
        <section className="rounded-xl border border-accent-red/25 bg-accent-red/[0.04] p-3 sm:p-4">
          <SectionHeader title="Live now" href="/markets/live" live />
          <MarketRow markets={live} />
        </section>
      )}

      {SECTIONS.map((s) => {
        const items = markets.filter((m) => m.category === s.category).slice(0, 6);
        if (items.length === 0) return null;
        return (
          <section key={s.category}>
            <SectionHeader title={s.title} href={`/markets/${s.category}`} />
            <MarketRow markets={items} />
          </section>
        );
      })}

      <Link
        href="/learn"
        className="flex items-center gap-4 rounded-xl border border-subtle bg-bg-secondary p-4 transition-colors hover:border-accent-blue/60 sm:p-6"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-blue/15 text-accent-blue">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-content-primary">Predictions 101</p>
          <p className="mt-0.5 text-[13px] text-content-secondary">
            How shares, odds and resolution work — in plain language, with ₹ examples.
          </p>
        </div>
        <ArrowRight className="ml-auto hidden h-4 w-4 shrink-0 text-content-secondary sm:block" />
      </Link>
    </div>
  );
}
