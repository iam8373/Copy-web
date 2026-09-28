"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  HeartHandshake,
  Home,
  LayoutDashboard,
  LifeBuoy,
  Languages,
  MessageSquareWarning,
  MoreHorizontal,
  ShieldCheck,
  TrendingUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { label: "Home", href: "/", icon: Home },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Profit", href: "/profit", icon: TrendingUp },
];

const LANGUAGES = ["English", "हिन्दी", "বাংলা", "मराठी", "தமிழ்", "తెలుగు"];

export function BottomNav() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [language, setLanguage] = useState("English");

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-subtle bg-bg-secondary/95 backdrop-blur-xl sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-4">
          {ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors",
                  active ? "text-accent-blue" : "text-content-secondary"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors",
              sheetOpen ? "text-accent-blue" : "text-content-secondary"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      {sheetOpen && (
        <div className="fixed inset-0 z-[55] flex items-end sm:hidden">
          <div
            className="absolute inset-0 bg-black/70 animate-fade-in"
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="relative w-full rounded-t-xl border border-subtle bg-bg-secondary p-4 shadow-2xl animate-slide-up"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center">
              <h2 className="text-[15px] font-bold text-content-primary">More</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-content-secondary transition-colors hover:bg-bg-tertiary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-1">
              <Link
                href="/learn"
                onClick={() => setSheetOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-content-primary transition-colors hover:bg-bg-tertiary"
              >
                <LifeBuoy className="h-4 w-4 text-content-secondary" />
                Help Center
              </Link>
              <Link
                href="/terms"
                onClick={() => setSheetOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-content-primary transition-colors hover:bg-bg-tertiary"
              >
                <FileText className="h-4 w-4 text-content-secondary" />
                Terms of Use
              </Link>
              <Link
                href="/privacy"
                onClick={() => setSheetOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-content-primary transition-colors hover:bg-bg-tertiary"
              >
                <ShieldCheck className="h-4 w-4 text-content-secondary" />
                Privacy Policy
              </Link>
              <Link
                href="/responsible-play"
                onClick={() => setSheetOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-content-primary transition-colors hover:bg-bg-tertiary"
              >
                <HeartHandshake className="h-4 w-4 text-content-secondary" />
                Responsible play
              </Link>
              <Link
                href="/grievance"
                onClick={() => setSheetOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-content-primary transition-colors hover:bg-bg-tertiary"
              >
                <MessageSquareWarning className="h-4 w-4 text-content-secondary" />
                Grievance redressal
              </Link>
            </div>

            <div className="mt-3 border-t border-subtle pt-3">
              <p className="flex items-center gap-2 px-3 text-[12px] font-semibold text-content-secondary">
                <Languages className="h-4 w-4" />
                Language
              </p>
              <div className="mt-2 flex flex-wrap gap-2 px-1">
                {LANGUAGES.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLanguage(l)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                      l === language
                        ? "border-accent-blue bg-accent-blue/15 text-accent-blue"
                        : "border-subtle bg-bg-tertiary text-content-secondary"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
