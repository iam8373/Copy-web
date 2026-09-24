"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, Moon, Search, Sun, User } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useMarketStore } from "@/store/useMarketStore";

export function Header() {
  const { theme, toggle } = useTheme();
  const setSearchOpen = useMarketStore((s) => s.setSearchOpen);
  const setAuthOpen = useMarketStore((s) => s.setAuthOpen);
  const session = useMarketStore((s) => s.session);
  const signOut = useMarketStore((s) => s.signOut);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-subtle bg-bg-primary/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:h-16 sm:gap-6 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-blue text-[13px] font-bold text-white">
            B
          </span>
          <span className="text-[17px] font-bold tracking-tight text-content-primary">
            Bharat<span className="text-accent-blue">Predict</span>
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="group flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-subtle bg-bg-secondary px-3 text-left text-[13px] text-content-secondary transition-colors hover:bg-bg-tertiary sm:h-10 sm:max-w-xl"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate">Search markets...</span>
          <kbd className="ml-auto hidden shrink-0 rounded border border-subtle bg-bg-tertiary px-1.5 py-0.5 text-[11px] font-medium text-content-secondary sm:block">
            Shift + /
          </kbd>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {session ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Account menu"
                className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-accent-blue to-accent-strong text-[13px] font-bold text-white sm:h-10 sm:w-10"
              >
                {session.initial}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-subtle bg-bg-secondary p-1 shadow-2xl animate-slide-up">
                    <p className="truncate px-3 py-2 text-[12px] text-content-secondary">
                      {session.handle}
                    </p>
                    <Link
                      href="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-content-primary transition-colors hover:bg-bg-tertiary"
                    >
                      <User className="h-4 w-4" />
                      Dashboard
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        signOut();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-accent-red transition-colors hover:bg-bg-tertiary"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-accent-blue px-3 text-[13px] font-semibold text-white transition-colors hover:bg-accent-strong active:brightness-95 sm:h-10 sm:px-4"
            >
              <span className="hidden sm:inline">Sign up / Log in</span>
              <span className="sm:hidden">Log in</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggle}
            aria-label="Toggle theme"
            className="grid h-9 w-9 place-items-center rounded-lg border border-subtle bg-bg-secondary text-content-secondary transition-colors hover:bg-bg-tertiary hover:text-content-primary sm:h-10 sm:w-10"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
