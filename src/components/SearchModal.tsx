"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useMarketStore } from "@/store/useMarketStore";
import { cn, formatPercent, formatVolume } from "@/lib/utils";
import { useT } from "@/i18n/LanguageProvider";
import { getMarketText } from "@/lib/market-text";
import { NAV_KEY_BY_SLUG } from "@/i18n";

export function SearchModal() {
  const open = useMarketStore((s) => s.searchOpen);
  const setOpen = useMarketStore((s) => s.setSearchOpen);
  const markets = useMarketStore((s) => s.markets);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const { t, locale } = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA"].includes(e.target.tagName);
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "/" && e.shiftKey && !typing) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    // Lock page scroll and give focus back to the trigger on close.
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  // Keep the highlighted option in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`search-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = [...markets].sort((a, b) => b.totalVolume - a.totalVolume);
    if (!q) return pool.slice(0, 8);
    return pool
      .map((m) => {
        const title = m.title.toLowerCase();
        const haystack = `${m.title} ${m.category} ${m.subcategory}`.toLowerCase();
        // Also match the active locale's saved title (English always matches).
        const local = getMarketText(m, locale);
        const localTitle = local.translated ? local.title.toLowerCase() : "";
        let score = 0;
        if (title.startsWith(q) || (localTitle && localTitle.startsWith(q))) score += 20;
        if (haystack.includes(q) || (localTitle && localTitle.includes(q))) score += 10;
        // token-prefix match, so "verst" finds "Verstappen"
        if (haystack.split(/[^a-z0-9$]+/).some((w) => w.startsWith(q))) score += 6;
        return { m, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || b.m.totalVolume - a.m.totalVolume)
      .slice(0, 10)
      .map((r) => r.m);
  }, [markets, query, locale]);

  if (!open) return null;

  const go = (slug: string) => {
    setOpen(false);
    router.push(`/market/${slug}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <div
        className="absolute inset-0 bg-black/70 animate-fade-in"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("search", "label")}
        data-testid="search-dialog"
        className="relative w-full max-w-xl overflow-hidden rounded-card border border-subtle bg-surface-2 shadow-dialog animate-slide-up"
      >
        <div className="flex items-center gap-2 border-b border-subtle px-4">
          <Search className="h-4 w-4 shrink-0 text-secondary" aria-hidden />
          <input
            ref={inputRef}
            role="combobox"
            aria-label={t("search", "label")}
            aria-expanded={results.length > 0}
            aria-controls="search-results"
            aria-autocomplete="list"
            aria-activedescendant={results[active] ? `search-option-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && results[active]) {
                go(results[active].slug);
              } else if (e.key === "Tab") {
                // The input is the only tab stop; keep focus in the dialog.
                e.preventDefault();
              }
            }}
            placeholder={t("header", "searchPlaceholder")}
            className="h-12 w-full bg-transparent text-16 text-primary outline-none placeholder:text-secondary"
          />
          <kbd aria-hidden className="shrink-0 rounded-chip border font-sans border-subtle bg-surface-3 px-1.5 py-1 text-11 text-secondary">
            {t("search", "esc")}
          </kbd>
        </div>

        <div
          id="search-results"
          role="listbox"
          aria-label={t("search", "results", { count: results.length })}
          className="thin-scrollbar max-h-[52vh] overflow-y-auto p-2"
        >
          {results.length === 0 && (
            <p role="status" className="px-3 py-6 text-center text-13 text-secondary">
              {t("empty", "noSearchResults", { query })}
            </p>
          )}
          {results.map((m, i) => (
            <div
              key={m.id}
              id={`search-option-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(m.slug)}
              className={cn(
                "flex min-h-touch w-full cursor-pointer items-center gap-3 rounded-btn px-3 py-3 text-left transition-colors duration-xs",
                i === active ? "bg-surface-3" : "hover:bg-surface-3/60"
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-13 font-semibold text-primary">
                  {getMarketText(m, locale).title}
                </p>
                <p className="truncate text-11 uppercase tracking-wide text-secondary">
                  {t("nav", NAV_KEY_BY_SLUG[m.category])} • {m.subcategory} •{" "}
                  <span className="tnum">
                    {t("card", "volume")} {formatVolume(m.totalVolume)}
                  </span>
                </p>
              </div>
              <span className="tnum shrink-0 text-13 font-bold text-primary">
                {formatPercent(m.outcomes[0].price, 1)}
              </span>
            </div>
          ))}
        </div>

        <div aria-hidden className="flex items-center gap-3 border-t border-subtle px-4 py-2 text-11 text-secondary">
          <span>{t("search", "navigate")}</span>
          <span>{t("search", "open")}</span>
          <span className="ml-auto">{t("search", "results", { count: results.length })}</span>
        </div>
      </div>
    </div>
  );
}
