"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CATEGORIES } from "@/lib/types";
import { NAV_KEY_BY_SLUG } from "@/i18n";
import { useT } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

const TABS = [
  { slug: "all" as const, href: "/" },
  ...CATEGORIES.map((c) => ({ slug: c.slug, href: c.href })),
];

export function CategoryNav() {
  const pathname = usePathname();
  const { t } = useT();

  return (
    <nav className="sticky top-14 z-30 border-b border-subtle bg-surface-1/85 backdrop-blur-xl sm:top-16">
      <div className="mx-auto max-w-content px-gutter">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto py-3">
          {TABS.map((tab) => {
            const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            const label =
              tab.slug === "all" ? t("nav", "all") : t("nav", NAV_KEY_BY_SLUG[tab.slug]);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "shrink-0 rounded-btn px-3 py-1.5 text-13 font-semibold transition-colors",
                  active
                    ? "bg-brand-fill text-white"
                    : "text-secondary hover:bg-surface-3 hover:text-primary"
                )}
              >
                {tab.slug === "live" ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse-dot" />
                    {label}
                  </span>
                ) : (
                  label
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
