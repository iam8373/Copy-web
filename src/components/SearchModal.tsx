"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useMarketStore } from "@/store/useMarketStore";
import { cn, formatPercent, formatVolume } from "@/lib/utils";
import { useT } from "@/i18n/LanguageProvider";

export function SearchModal() {
  const open = useMarketStore((s) => s.searchOpen);
  const setOpen = useMarketStore((s) => s.setSearchOpen);
  const markets = useMarketStore((s) => s.markets);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const { t } = useT();
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
    if (open) {
      setQuery("");
      setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = [...markets].sort((a, b) => b.totalVolume - a.totalVolume);
    if (!q) return pool.slice(0, 8);
    return pool
      .map((m) => {
        const title = m.title.toLowerCase();
        const haystack = `${m.title} ${m.category} ${m.subcategory}`.toLowerCase();
        let score = 0;
        if (title.startsWith(q)) score += 20;
        if (haystack.includes(q)) score += 10;
        // token-prefix match, so "verst" finds "Verstappen"
        if (haystack.split(/[^a-z0-9$]+/).some((w) => w.startsWith(q))) score += 6;
        return { m, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || b.m.totalVolume - a.m.totalVolume)
      .slice(0, 10)
      .map((r) => r.m);
  }, [markets, query]);

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
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-subtle bg-bg-secondary shadow-2xl animate-slide-up">
        <div className="flex items-center gap-2 border-b border-subtle px-4">
          <Search className="h-4 w-4 shrink-0 text-content-secondary" />
          <input
            ref={inputRef}
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
              }
            }}
            placeholder={t("header", "searchPlaceholder")}
            className="h-12 w-full bg-transparent text-[15px] text-content-primary outline-none placeholder:text-content-secondary"
          />
          <kbd className="shrink-0 rounded border border-subtle bg-bg-tertiary px-1.5 py-0.5 text-[11px] text-content-secondary">
            {t("search", "esc")}
          </kbd>
        </div>

        <div className="thin-scrollbar max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-content-secondary">
              {t("empty", "noSearchResults", { query })}
            </p>
          )}
          {results.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => go(m.slug)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                i === active ? "bg-bg-tertiary" : "hover:bg-bg-tertiary/60"
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-content-primary">
                  {m.title}
                </p>
                <p className="truncate text-[11px] uppercase tracking-wide text-content-secondary">
                  {m.category} • {m.subcategory} • Vol {formatVolume(m.totalVolume)}
                </p>
              </div>
              <span className="tnum shrink-0 text-[13px] font-bold text-content-primary">
                {formatPercent(m.outcomes[0].price, 1)}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 border-t border-subtle px-4 py-2 text-[11px] text-content-secondary">
          <span>{t("search", "navigate")}</span>
          <span>{t("search", "open")}</span>
          <span className="ml-auto">{t("search", "results", { count: results.length })}</span>
        </div>
      </div>
    </div>
  );
}
