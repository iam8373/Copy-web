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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, FOCUS_RING } from "@/components/ui";
import { useT } from "@/i18n/LanguageProvider";
import { LanguagePicker } from "@/components/LanguagePicker";

const ITEMS = [
  { key: "home" as const, href: "/", icon: Home },
  { key: "dashboard" as const, href: "/dashboard", icon: LayoutDashboard },
  { key: "profit" as const, href: "/profit", icon: TrendingUp },
];

const MORE_LINKS = [
  { key: "helpCentre" as const, href: "/learn", icon: LifeBuoy },
  { key: "terms" as const, href: "/terms", icon: FileText },
  { key: "privacy" as const, href: "/privacy", icon: ShieldCheck },
  { key: "responsiblePlay" as const, href: "/responsible-play", icon: HeartHandshake },
  { key: "grievance" as const, href: "/grievance", icon: MessageSquareWarning },
];

const ITEM =
  "flex h-bottom-nav flex-col items-center justify-center gap-1 text-11 font-semibold transition-colors duration-xs " +
  FOCUS_RING;

export function BottomNav() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { t } = useT();

  return (
    <>
      <nav
        aria-label={t("bottomNav", "label")}
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
                aria-current={active ? "page" : undefined}
                className={cn(ITEM, active ? "text-brand" : "text-secondary")}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {t("bottomNav", item.key)}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            className={cn(ITEM, sheetOpen ? "text-brand" : "text-secondary")}
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
            {t("bottomNav", "more")}
          </button>
        </div>
      </nav>

      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t("bottomNav", "more")}
        size="sm"
        data-testid="more-sheet"
      >
        <div className="-mx-2 -mt-2 flex flex-col gap-1">
          {MORE_LINKS.map(({ key, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setSheetOpen(false)}
              aria-current={pathname === href ? "page" : undefined}
              className={cn(
                "flex min-h-touch items-center gap-3 rounded-btn px-3 text-14 font-semibold text-primary transition-colors duration-xs hover:bg-surface-3",
                FOCUS_RING
              )}
            >
              <Icon className="h-4 w-4 text-secondary" aria-hidden />
              {t("bottomNav", key)}
            </Link>
          ))}
        </div>

        <div className="mt-3 border-t border-subtle pt-3">
          <p className="flex items-center gap-2 text-12 font-semibold text-secondary">
            <Languages className="h-4 w-4" aria-hidden />
            {t("bottomNav", "language")}
          </p>
          <LanguagePicker variant="chips" />
        </div>
      </Dialog>
    </>
  );
}
