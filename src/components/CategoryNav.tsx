"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CATEGORIES } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS = [{ label: "All", href: "/" }, ...CATEGORIES.map((c) => ({ label: c.label, href: c.href }))];

export function CategoryNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-14 z-30 border-b border-subtle bg-bg-primary/85 backdrop-blur-xl sm:top-16">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto py-2.5">
          {TABS.map((tab) => {
            const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors",
                  active
                    ? "bg-accent-blue text-white"
                    : "text-content-secondary hover:bg-bg-tertiary hover:text-content-primary"
                )}
              >
                {tab.label === "Live" ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent-red animate-pulse-dot" />
                    Live
                  </span>
                ) : (
                  tab.label
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
