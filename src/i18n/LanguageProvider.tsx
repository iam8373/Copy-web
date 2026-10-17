"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DICTIONARIES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_META,
  STORAGE_KEY,
  en,
  isLocale,
  type Dictionary,
  type Locale,
} from "./index";

type Section = keyof Dictionary;

interface LanguageContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Resolves a key, interpolating {placeholders}, falling back to English. */
  t: <S extends Section>(
    section: S,
    key: keyof Dictionary[S],
    vars?: Record<string, string | number>
  ) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  );
}

function writeCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * `initialLocale` comes from the bp-lang cookie on the server (S2), so the
 * server HTML and the first client render use the same language.
 */
export function LanguageProvider({ initialLocale = "en", children }: { initialLocale?: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // localStorage stays the source of truth; the cookie mirrors it for the
  // server. They only disagree for choices saved before S2 (or set directly):
  // adopt the stored one and fix the cookie, so the next load renders in it.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!isLocale(stored)) {
        writeCookie(initialLocale);
        return;
      }
      const cookie = document.cookie.split("; ").find((c) => c.startsWith(`${LOCALE_COOKIE}=`))?.split("=")[1];
      if (cookie !== stored) writeCookie(stored);
      if (stored !== initialLocale) setLocaleState(stored);
    } catch {
      /* storage unavailable — keep the server's choice */
    }
  }, [initialLocale]);

  // Keep <html lang> and the active script in sync with the choice.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.script = LOCALE_META[locale].script;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeCookie(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback<LanguageContextValue["t"]>(
    (section, key, vars) => {
      const dict = DICTIONARIES[locale] ?? en;
      const value =
        (dict[section] as Record<string, string>)?.[key as string] ??
        (en[section] as Record<string, string>)[key as string];
      return interpolate(value ?? String(key), vars);
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Translation hook. Safe outside the provider (falls back to English). */
export function useT() {
  const ctx = useContext(LanguageContext);
  if (ctx) return ctx;
  return {
    locale: "en" as Locale,
    setLocale: () => {},
    t: ((section, key, vars) =>
      interpolate(
        (en[section] as Record<string, string>)[key as string] ?? String(key),
        vars
      )) as LanguageContextValue["t"],
  };
}
