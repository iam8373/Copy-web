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
import { DICTIONARIES, LOCALE_COOKIE, LOCALE_META, localeFromCookie } from "@/i18n";
import { getMarkets } from "@/services/markets/read";
import { AuthSync } from "@/components/AuthSync";
import { AgeConfirmDialog } from "@/components/AgeConfirmDialog";
import { emailOtpEnabled } from "@/lib/server/env";
import { HideOnAdmin } from "@/components/HideOnAdmin";

/**
 * Title and description in the saved language (S4); icons, manifest and the
 * social image come from the file conventions in this folder. noindex /
 * nofollow on every page unless ALLOW_INDEXING === "true" (also covers
 * crawlers that ignore robots.txt).
 */
export function generateMetadata(): Metadata {
  const b = DICTIONARIES[localeFromCookie(cookies().get(LOCALE_COOKIE)?.value)].brand;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return {
    ...(site && /^https?:\/\/[^/]+$/.test(site) ? { metadataBase: new URL(site) } : {}),
    robots: indexingAllowed() ? { index: true, follow: true } : { index: false, follow: false },
    title: b.metaTitle,
    description: b.metaDescription,
    applicationName: "BharatPredict",
    openGraph: { siteName: "BharatPredict", title: b.metaTitle, description: b.metaDescription, type: "website" },
    twitter: { card: "summary_large_image", title: b.metaTitle, description: b.metaDescription },
  };
}

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
