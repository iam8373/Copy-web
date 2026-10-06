"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pause, Play, TrendingUp } from "lucide-react";
import { useMarketStore } from "@/store/useMarketStore";
import { FlashValue } from "@/components/FlashValue";
import { FOCUS_RING, HIT_AREA, IconButton } from "@/components/ui";
import { cn, formatEndDate, formatPercent, formatVolume } from "@/lib/utils";
import { NAV_KEY_BY_SLUG } from "@/i18n";
import { useT } from "@/i18n/LanguageProvider";
import { getMarketText } from "@/lib/market-text";
import { useReducedMotion } from "@/lib/useReducedMotion";

const ROTATE_MS = 7000;

/**
 * Top markets by volume. Auto-rotates every 7s, but (WCAG 2.2.2) it can be
 * paused with a button, pauses while hovered or focused, and never
 * auto-rotates under prefers-reduced-motion.
 */
export function FeaturedCarousel() {
  const markets = useMarketStore((s) => s.markets);
  const featured = [...markets].sort((a, b) => b.totalVolume - a.totalVolume).slice(0, 5);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reduced = useReducedMotion();
  const { t, locale } = useT();

  const rotating = !paused && !reduced && !hovered && !focused && featured.length > 1;

  useEffect(() => {
    if (!rotating) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") setIndex((i) => (i + 1) % featured.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [rotating, featured.length]);

  const market = featured[index];
  if (!market) return null;
  const text = getMarketText(market, locale);
  const go = (i: number) => setIndex((i + featured.length) % featured.length);

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("home", "featured")}
      data-testid="featured-carousel"
      data-rotating={rotating ? "true" : "false"}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      className="rounded-card border border-subtle bg-surface-2 p-4 shadow-card sm:p-6"
    >
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-brand" aria-hidden />
        <h2 className="text-13 font-bold uppercase tracking-wide text-secondary">
          {t("home", "featured")}
        </h2>
        <div className="ml-auto flex items-center gap-1">
          {!reduced && (
            <IconButton
              label={t("home", paused ? "resumeRotation" : "pauseRotation")}
              icon={paused ? <Play /> : <Pause />}
              aria-pressed={paused}
              data-testid="featured-pause"
              onClick={() => setPaused((p) => !p)}
            />
          )}
          <IconButton
            label={t("home", "prevFeatured")}
            icon={<ChevronLeft />}
            variant="secondary"
            onClick={() => go(index - 1)}
          />
          <IconButton
            label={t("home", "nextFeatured")}
            icon={<ChevronRight />}
            variant="secondary"
            onClick={() => go(index + 1)}
          />
        </div>
      </div>

      {/* Announce slide changes only when the user drives them. */}
      <div aria-live={rotating ? "off" : "polite"}>
        <Link
          key={market.id}
          href={`/market/${market.slug}`}
          role="group"
          aria-roledescription="slide"
          aria-label={t("home", "showFeatured", { n: index + 1, total: featured.length })}
          className={cn("mt-4 block rounded-btn animate-fade-in", FOCUS_RING)}
        >
          <p className="text-11 font-semibold uppercase tracking-wide text-brand">
            {t("nav", NAV_KEY_BY_SLUG[market.category])} • {market.subcategory}
          </p>
          <h3 className="mt-1 text-20 font-bold text-primary sm:text-24">{text.title}</h3>
          <p className="mt-2 line-clamp-2 max-w-3xl text-13 text-secondary">{text.description}</p>

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
            <span className="tnum">
              {t("card", "volume")} {formatVolume(market.totalVolume)}
            </span>
            <span>{t("card", "ends", { date: formatEndDate(market.endDate) })}</span>
            <span className="truncate">
              {t("home", "resolvesVia", { source: market.resolutionSource })}
            </span>
          </div>
        </Link>
      </div>

      <div className="mt-4 flex gap-1.5">
        {featured.map((f, i) => (
          <button
            key={f.id}
            type="button"
            aria-label={t("home", "showFeatured", { n: i + 1, total: featured.length })}
            aria-current={i === index ? "true" : undefined}
            onClick={() => setIndex(i)}
            // Thin bar visual, touch-size hit area (HIT_AREA).
            className={cn("relative h-1 flex-1 rounded-full", HIT_AREA, FOCUS_RING)}
          >
            <span
              aria-hidden
              className={cn(
                "absolute inset-0 rounded-full transition-colors duration-sm",
                i === index ? "bg-brand-fill" : "bg-surface-3"
              )}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
