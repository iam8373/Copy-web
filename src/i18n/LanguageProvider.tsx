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

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  // Read the stored choice after mount only, so SSR output stays deterministic.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isLocale(stored)) setLocaleState(stored);
    } catch {
      /* storage unavailable — stay on English */
    }
  }, []);

  // Keep <html lang> and the active script in sync with the choice.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.script = LOCALE_META[locale].script;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
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
