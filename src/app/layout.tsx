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
import { LiveTicker } from "@/components/LiveTicker";
import { AuthSync } from "@/components/AuthSync";
import { AgeConfirmDialog } from "@/components/AgeConfirmDialog";
import { emailOtpEnabled } from "@/lib/server/env";

export const metadata: Metadata = {
  // noindex/nofollow on every page unless ALLOW_INDEXING === "true". Covers
  // crawlers that ignore robots.txt. Pages inherit this from the root layout.
  robots: indexingAllowed() ? { index: true, follow: true } : { index: false, follow: false },
  title: "BharatPredict — India's Prediction Market",
  description:
    "Trade the outcome of Indian and global events — cricket, elections, Bollywood, the economy and markets, priced in ₹.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-screen bg-surface-1 font-sans text-primary antialiased">
        <LanguageProvider>
        <ThemeProvider>
          <LiveTicker />
          <AuthSync />
          <Header />
          <CategoryNav />
          <main className="mx-auto max-w-content px-gutter pb-24 pt-4 sm:pb-12 sm:pt-6">
            {children}
          </main>
          <Footer />
          <BottomNav />
          <SearchModal />
          <AuthModal emailOtpEnabled={emailOtpEnabled()} />
          <AgeConfirmDialog />
          <TradeModal />
          <TradeSuccess />
          <Toaster />
        </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
