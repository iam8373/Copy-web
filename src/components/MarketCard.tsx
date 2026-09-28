"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import type { Market } from "@/lib/types";
import { Countdown } from "@/components/Countdown";
import { FlashValue } from "@/components/FlashValue";
import {
  CATEGORY_TINT,
  cn,
  formatChange,
  formatEndDate,
  formatPercent,
  formatVolume,
  formatVolumeChange,
} from "@/lib/utils";
import { useMarketStore } from "@/store/useMarketStore";
import { useT } from "@/i18n/LanguageProvider";

function CategoryBadge({ market }: { market: Market }) {
  return (
    <span className="flex min-w-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wide">
      <span className={cn("shrink-0", CATEGORY_TINT[market.category])}>{market.category}</span>
      <span className="text-content-secondary">•</span>
      <span className="truncate text-content-secondary">{market.subcategory}</span>
    </span>
  );
}

function BinaryOutcomes({ market }: { market: Market }) {
  const openTrade = useMarketStore((s) => s.openTrade);
  const { t } = useT();
  const [yes, no] = market.outcomes;

  const cells = [
    { o: yes, tone: "green" as const },
    { o: no, tone: "red" as const },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {cells.map(({ o, tone }) => (
        <button
          key={o.id}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openTrade(market, o.id);
          }}
          className={cn(
            "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors active:opacity-80",
            tone === "green"
              ? "border-accent-green/25 bg-accent-green/10 hover:bg-accent-green/20"
              : "border-accent-red/25 bg-accent-red/10 hover:bg-accent-red/20"
          )}
        >
          <span
            className={cn(
              "text-[13px] font-bold",
              tone === "green" ? "text-accent-green" : "text-accent-red"
            )}
          >
            {o.label}{" "}
            <FlashValue value={o.price}>{formatPercent(o.price)}</FlashValue>
          </span>
          <span className="tnum text-[11px] text-content-secondary">
            {formatChange(o.change24h)} {t("card", "pts24h")}
          </span>
        </button>
      ))}
    </div>
  );
}

function MultiOutcomes({ market }: { market: Market }) {
  const openTrade = useMarketStore((s) => s.openTrade);
  const { t } = useT();
  const top = market.outcomes.slice(0, 4);

  return (
    <div className="flex flex-col gap-1.5">
      {top.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openTrade(market, o.id);
          }}
          className="group/row relative flex items-center gap-2 overflow-hidden rounded-lg bg-bg-tertiary px-2.5 py-1.5 text-left transition-colors hover:bg-subtle"
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 bg-accent-blue/15"
            style={{ width: `${Math.min(100, o.price * 100)}%` }}
          />
          <span className="relative min-w-0 flex-1 truncate text-[13px] font-medium text-content-primary">
            {o.label}
          </span>
          <FlashValue
            value={o.price}
            className="relative text-[13px] font-bold text-content-primary"
          >
            {formatPercent(o.price, 1)}
          </FlashValue>
          <span
            className={cn(
              "tnum relative w-9 text-right text-[11px] font-semibold",
              o.change24h >= 0 ? "text-accent-green" : "text-accent-red"
            )}
          >
            {formatChange(o.change24h)}
          </span>
        </button>
      ))}
      {market.outcomes.length > top.length && (
        <span className="px-2.5 text-[11px] text-content-secondary">
          {t(
            "card",
            market.outcomes.length - top.length === 1 ? "moreOutcome" : "moreOutcomes",
            { count: market.outcomes.length - top.length }
          )}
        </span>
      )}
    </div>
  );
}

export function MarketCard({ market }: { market: Market }) {
  const openTrade = useMarketStore((s) => s.openTrade);
  const { t } = useT();

  return (
    <Link
      href={`/market/${market.slug}`}
      className="group flex flex-col gap-3 rounded-xl border border-subtle bg-bg-secondary p-3.5 transition-colors hover:border-accent-blue/60 hover:bg-bg-tertiary/60 sm:p-4"
    >
      <div className="flex items-center gap-2">
        <CategoryBadge market={market} />
        <span className="ml-auto flex shrink-0 items-center gap-2 text-[11px] font-medium text-content-secondary">
          {market.isLive ? (
            <>
              <span className="flex items-center gap-1 rounded-md bg-accent-red/15 px-1.5 py-0.5 font-bold uppercase text-accent-red">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-red animate-pulse-dot" />
                {t("card", "live")}
              </span>
              <Countdown endDate={market.endDate} />
            </>
          ) : (
            <>{t("card", "ends", { date: formatEndDate(market.endDate) })}</>
          )}
        </span>
      </div>

      <h3 className="line-clamp-2 min-h-[42px] text-[15px] font-bold leading-[1.35] text-content-primary sm:text-base">
        {market.title}
      </h3>

      {market.isBinary ? <BinaryOutcomes market={market} /> : <MultiOutcomes market={market} />}

      <div className="mt-auto flex items-center gap-2 border-t border-subtle pt-2.5">
        <span className="tnum truncate text-[12px] text-content-secondary">
          {t("card", "volume")} {formatVolume(market.totalVolume)}
        </span>
        <span
          className={cn(
            "tnum shrink-0 text-[12px] font-semibold",
            market.volumeChange24h >= 0 ? "text-accent-green" : "text-accent-red"
          )}
        >
          {formatVolumeChange(market.volumeChange24h)}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openTrade(market, market.outcomes[0].id);
          }}
          className="ml-auto flex shrink-0 items-center gap-1 rounded-lg border border-subtle bg-bg-tertiary px-2.5 py-1 text-[12px] font-semibold text-content-primary transition-colors hover:border-accent-blue hover:text-accent-blue active:opacity-80"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("card", "trade")}
        </button>
      </div>
    </Link>
  );
}
