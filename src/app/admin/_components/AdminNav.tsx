"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { FOCUS_RING } from "@/components/ui/focus";

/** Section links; the server passes only the ones the role may open. */
export function AdminNav({ items }: { items: Array<{ href: string; label: string }> }) {
  const path = usePathname() ?? "";
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map((it) => {
        const active = it.href === "/admin" ? path === "/admin" : path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-btn px-3 py-2 text-14 font-semibold transition-colors",
              FOCUS_RING,
              active ? "bg-brand/15 text-brand" : "text-secondary hover:bg-surface-3 hover:text-primary"
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
