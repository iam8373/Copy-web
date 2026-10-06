"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, Moon, Search, Sun, User } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useMarketStore } from "@/store/useMarketStore";
import { useT } from "@/i18n/LanguageProvider";
import { LanguagePicker } from "@/components/LanguagePicker";

export function Header() {
  const { theme, toggle } = useTheme();
  const setSearchOpen = useMarketStore((s) => s.setSearchOpen);
  const setAuthOpen = useMarketStore((s) => s.setAuthOpen);
  const session = useMarketStore((s) => s.session);
  const signOut = useMarketStore((s) => s.signOut);
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useT();

  return (
    <header className="sticky top-0 z-40 border-b border-subtle bg-surface-1/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-content items-center gap-3 px-gutter sm:h-16 sm:gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-btn bg-brand-fill text-13 font-bold text-white">
            B
          </span>
          <span className="text-18 font-bold tracking-tight text-primary">
            Bharat<span className="text-brand">Predict</span>
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="group flex h-9 min-w-0 flex-1 items-center gap-2 rounded-btn border border-subtle bg-surface-2 px-3 text-left text-13 text-secondary transition-colors hover:bg-surface-3 sm:h-10 sm:max-w-xl"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate">{t("header", "searchPlaceholder")}</span>
          <kbd className="ml-auto hidden shrink-0 rounded-chip font-sans border border-subtle bg-surface-3 px-1.5 py-1 text-11 font-medium text-secondary sm:block">
            {t("header", "searchShortcut")}
          </kbd>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {session ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label={t("header", "accountMenu")}
                className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-fill to-brand-fill-hover text-13 font-bold text-white sm:h-10 sm:w-10"
              >
                {session.initial}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-card border border-subtle bg-surface-2 p-1 shadow-dialog animate-slide-up">
                    <p className="truncate px-3 py-2 text-12 text-secondary">
                      {session.handle}
                    </p>
                    <Link
                      href="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 rounded-btn px-3 py-2 text-13 font-medium text-primary transition-colors hover:bg-surface-3"
                    >
                      <User className="h-4 w-4" />
                      {t("header", "dashboard")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        signOut();
                      }}
                      className="flex w-full items-center gap-2 rounded-btn px-3 py-2 text-13 font-medium text-danger transition-colors hover:bg-surface-3"
                    >
                      <LogOut className="h-4 w-4" />
                      {t("header", "signOut")}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="flex h-9 items-center gap-1.5 rounded-btn bg-brand-fill px-3 text-13 font-semibold text-white transition-colors hover:bg-brand-fill-hover active:brightness-95 sm:h-10 sm:px-4"
            >
              <span className="hidden sm:inline">{t("header", "signIn")}</span>
              <span className="sm:hidden">{t("header", "signInShort")}</span>
            </button>
          )}

          {/* Desktop had no language control before; chips remain on mobile. */}
          <div className="hidden sm:block">
            <LanguagePicker variant="select" />
          </div>

          <button
            type="button"
            onClick={toggle}
            aria-label={t("header", "toggleTheme")}
            className="grid h-9 w-9 place-items-center rounded-btn border border-subtle bg-surface-2 text-secondary transition-colors hover:bg-surface-3 hover:text-primary sm:h-10 sm:w-10"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
