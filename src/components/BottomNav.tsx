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
import { useT } from "@/i18n/LanguageProvider";
import { LanguagePicker } from "@/components/LanguagePicker";

const ITEMS = [
  { key: "home" as const, href: "/", icon: Home },
  { key: "dashboard" as const, href: "/dashboard", icon: LayoutDashboard },
  { key: "profit" as const, href: "/profit", icon: TrendingUp },
];

export function BottomNav() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { t } = useT();

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-subtle bg-surface-2/95 backdrop-blur-xl sm:hidden"
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
                aria-label={t("bottomNav", item.key)}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 text-11 font-semibold transition-colors",
                  active ? "text-brand" : "text-secondary"
                )}
              >
                <Icon className="h-5 w-5" />
                {t("bottomNav", item.key)}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={cn(
              "flex flex-col items-center gap-1 py-3 text-11 font-semibold transition-colors",
              sheetOpen ? "text-brand" : "text-secondary"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            {t("bottomNav", "more")}
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
            className="relative w-full rounded-t-dialog border border-subtle bg-surface-2 p-4 shadow-dialog animate-slide-up"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center">
              <h2 className="text-16 font-bold text-primary">{t("bottomNav", "more")}</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label={t("bottomNav", "close")}
                className="ml-auto grid h-8 w-8 place-items-center rounded-btn text-secondary transition-colors hover:bg-surface-3"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-1">
              <Link
                href="/learn"
                onClick={() => setSheetOpen(false)}
                className="flex items-center gap-3 rounded-btn px-3 py-3 text-13 font-semibold text-primary transition-colors hover:bg-surface-3"
              >
                <LifeBuoy className="h-4 w-4 text-secondary" />
                {t("bottomNav", "helpCentre")}
              </Link>
              <Link
                href="/terms"
                onClick={() => setSheetOpen(false)}
                className="flex items-center gap-3 rounded-btn px-3 py-3 text-13 font-semibold text-primary transition-colors hover:bg-surface-3"
              >
                <FileText className="h-4 w-4 text-secondary" />
                {t("bottomNav", "terms")}
              </Link>
              <Link
                href="/privacy"
                onClick={() => setSheetOpen(false)}
                className="flex items-center gap-3 rounded-btn px-3 py-3 text-13 font-semibold text-primary transition-colors hover:bg-surface-3"
              >
                <ShieldCheck className="h-4 w-4 text-secondary" />
                {t("bottomNav", "privacy")}
              </Link>
              <Link
                href="/responsible-play"
                onClick={() => setSheetOpen(false)}
                className="flex items-center gap-3 rounded-btn px-3 py-3 text-13 font-semibold text-primary transition-colors hover:bg-surface-3"
              >
                <HeartHandshake className="h-4 w-4 text-secondary" />
                {t("bottomNav", "responsiblePlay")}
              </Link>
              <Link
                href="/grievance"
                onClick={() => setSheetOpen(false)}
                className="flex items-center gap-3 rounded-btn px-3 py-3 text-13 font-semibold text-primary transition-colors hover:bg-surface-3"
              >
                <MessageSquareWarning className="h-4 w-4 text-secondary" />
                {t("bottomNav", "grievance")}
              </Link>
            </div>

            <div className="mt-3 border-t border-subtle pt-3">
              <p className="flex items-center gap-2 px-3 text-12 font-semibold text-secondary">
                <Languages className="h-4 w-4" />
                {t("bottomNav", "language")}
              </p>
              <LanguagePicker variant="chips" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
