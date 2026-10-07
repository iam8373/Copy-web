"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, Moon, Search, Sun, User } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useMarketStore } from "@/store/useMarketStore";
import { useT } from "@/i18n/LanguageProvider";
import { LanguagePicker } from "@/components/LanguagePicker";
import { Button, FOCUS_RING, IconButton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { signOutEverywhere } from "@/services/auth/session";

const MENU_ITEM =
  "flex min-h-touch w-full items-center gap-2 rounded-btn px-3 text-13 font-medium transition-colors duration-xs hover:bg-surface-3 " +
  FOCUS_RING;

export function Header() {
  const { theme, toggle } = useTheme();
  const setSearchOpen = useMarketStore((s) => s.setSearchOpen);
  const setAuthOpen = useMarketStore((s) => s.setAuthOpen);
  const session = useMarketStore((s) => s.session);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const { t } = useT();

  // Escape closes the account menu and hands focus back to its button.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-subtle bg-surface-1/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-content items-center gap-3 px-gutter sm:h-16 sm:gap-6">
        <Link href="/" className={cn("flex shrink-0 items-center gap-2 rounded-btn", FOCUS_RING)}>
          <span className="grid h-7 w-7 place-items-center rounded-btn bg-brand-fill text-13 font-bold text-white">
            B
          </span>
          {/* Below the xs breakpoint the wordmark doesn't fit next to long sign-in
              labels (e.g. Tamil), so only the mark shows; screen readers still get the name. */}
          <span className="sr-only text-18 font-bold tracking-tight text-primary xs:not-sr-only">
            Bharat<span className="text-brand">Predict</span>
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-haspopup="dialog"
          aria-keyshortcuts="Shift+/ Control+K Meta+K"
          className={cn(
            "group flex h-10 min-w-10 flex-1 items-center gap-2 rounded-btn border border-subtle bg-surface-2 px-3 text-left text-13 text-secondary transition-colors duration-xs hover:border-strong hover:bg-surface-3 sm:max-w-xl",
            FOCUS_RING
          )}
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{t("header", "searchPlaceholder")}</span>
          <kbd className="ml-auto hidden shrink-0 rounded-chip font-sans border border-subtle bg-surface-3 px-1.5 py-1 text-11 font-medium text-secondary sm:block">
            {t("header", "searchShortcut")}
          </kbd>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {session ? (
            <div className="relative">
              <button
                ref={menuButton}
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label={t("header", "accountMenu")}
                aria-expanded={menuOpen}
                aria-haspopup="true"
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-full bg-brand-fill text-13 font-bold text-white transition-colors duration-xs hover:bg-brand-fill-hover",
                  FOCUS_RING
                )}
              >
                {session.initial}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-card border border-subtle bg-surface-2 p-1 shadow-popover animate-fade-in">
                    <p className="truncate px-3 py-2 text-12 text-secondary">
                      {session.handle}
                    </p>
                    <Link
                      href="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className={cn(MENU_ITEM, "text-primary")}
                    >
                      <User className="h-4 w-4" aria-hidden />
                      {t("header", "dashboard")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        void signOutEverywhere();
                      }}
                      className={cn(MENU_ITEM, "text-danger")}
                    >
                      <LogOut className="h-4 w-4" aria-hidden />
                      {t("header", "signOut")}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Button onClick={() => setAuthOpen(true)} aria-haspopup="dialog" className="px-3 text-13 sm:px-4">
              <span className="hidden sm:inline">{t("header", "signIn")}</span>
              <span className="sm:hidden">{t("header", "signInShort")}</span>
            </Button>
          )}

          {/* Desktop had no language control before; chips remain on mobile. */}
          <div className="hidden sm:block">
            <LanguagePicker variant="select" />
          </div>

          <IconButton
            size="md"
            onClick={toggle}
            label={t("header", "toggleTheme")}
            icon={theme === "dark" ? <Sun /> : <Moon />}
            className="border border-subtle bg-surface-2"
          />
        </div>
      </div>
    </header>
  );
}
