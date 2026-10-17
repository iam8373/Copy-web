"use client";

import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { useT } from "@/i18n/LanguageProvider";

const LINKS = [
  { key: "learn" as const, href: "/learn" },
  { key: "terms" as const, href: "/terms" },
  { key: "privacy" as const, href: "/privacy" },
  { key: "responsiblePlay" as const, href: "/responsible-play" },
  { key: "grievance" as const, href: "/grievance" },
];

export function Footer() {
  const { t } = useT();

  return (
    <footer className="mt-12 border-t border-subtle bg-surface-2">
      <div className="mx-auto flex max-w-content flex-col gap-4 px-gutter py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <Wordmark size="sm" />
          <span className="text-13 text-secondary">{t("brand", "tagline")}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {LINKS.map((l) => (
            <Link
              key={l.key}
              href={l.href}
              className="text-13 text-secondary transition-colors hover:text-primary"
            >
              {t("footer", l.key)}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
