import type { Metadata } from "next";
import "./globals.css";
import { fontVariables } from "@/fonts/fonts";
import { indexingAllowed } from "@/lib/indexing";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { Header } from "@/components/Header";
import { CategoryNav } from "@/components/CategoryNav";
import { Footer } from "@/components/Footer";
import { SearchModal } from "@/components/SearchModal";
import { AuthModal } from "@/components/AuthModal";
import { BottomNav } from "@/components/BottomNav";
import { TradeModal } from "@/components/TradeModal";
import { Toaster } from "@/components/Toaster";
import { TradeSuccess } from "@/components/TradeSuccess";
import { LivePrices } from "@/components/LivePrices";
import { cookies } from "next/headers";
import { MarketStoreProvider } from "@/store/MarketStoreProvider";
import { LOCALE_COOKIE, LOCALE_META, localeFromCookie } from "@/i18n";
import { getMarkets } from "@/services/markets/read";
import { AuthSync } from "@/components/AuthSync";
import { AgeConfirmDialog } from "@/components/AgeConfirmDialog";
import { emailOtpEnabled } from "@/lib/server/env";
import { HideOnAdmin } from "@/components/HideOnAdmin";

export const metadata: Metadata = {
  // noindex/nofollow on every page unless ALLOW_INDEXING === "true". Covers
  // crawlers that ignore robots.txt. Pages inherit this from the root layout.
  robots: indexingAllowed() ? { index: true, follow: true } : { index: false, follow: false },
  title: "BharatPredict — India's Prediction Market",
  description:
    "Trade the outcome of Indian and global events — cricket, elections, Bollywood, the economy and markets, priced in ₹.",
};

// Every page reads markets from the database at request time (cached via
// unstable_cache tags), so nothing needs Supabase during `next build`.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const markets = await getMarkets();
  // Saved language (cookie) for the first HTML; English otherwise (S2).
  const locale = localeFromCookie(cookies().get(LOCALE_COOKIE)?.value);
  return (
    <html lang={locale} data-script={LOCALE_META[locale].script} className={fontVariables}>
      <body className="min-h-screen bg-surface-1 font-sans text-primary antialiased">
        <LanguageProvider initialLocale={locale}>
        <ThemeProvider>
        <MarketStoreProvider markets={markets.ok ? markets.data : []} ok={markets.ok}>
          <LivePrices />
          <AuthSync />
          <Header />
          <HideOnAdmin>
            <CategoryNav />
          </HideOnAdmin>
          <main className="mx-auto max-w-content px-gutter pb-24 pt-4 sm:pb-12 sm:pt-6">
            {children}
          </main>
          <HideOnAdmin>
            <Footer />
            <BottomNav />
          </HideOnAdmin>
          <SearchModal />
          <AuthModal emailOtpEnabled={emailOtpEnabled()} />
          <AgeConfirmDialog />
          <TradeModal />
          <TradeSuccess />
          <Toaster />
        </MarketStoreProvider>
        </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
