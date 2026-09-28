import type { Metadata } from "next";
import {
  Noto_Sans_Bengali,
  Noto_Sans_Devanagari,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
} from "next/font/google";
import "./globals.css";
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

/**
 * Indic webfonts. Each exposes a CSS variable; globals.css applies the right
 * one via [data-script], so a font is only used when its locale is active.
 */
const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-devanagari",
  display: "swap",
});
const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bengali",
  display: "swap",
});
const notoTamil = Noto_Sans_Tamil({
  subsets: ["tamil"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-tamil",
  display: "swap",
});
const notoTelugu = Noto_Sans_Telugu({
  subsets: ["telugu"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-telugu",
  display: "swap",
});

const fontVars = [
  notoDevanagari.variable,
  notoBengali.variable,
  notoTamil.variable,
  notoTelugu.variable,
].join(" ");

export const metadata: Metadata = {
  title: "BharatPredict — India's Prediction Market",
  description:
    "Trade the outcome of Indian and global events — cricket, elections, Bollywood, the economy and markets, priced in ₹.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVars}>
      <body className="min-h-screen bg-bg-primary font-sans text-content-primary antialiased">
        <LanguageProvider>
        <ThemeProvider>
          <LiveTicker />
          <Header />
          <CategoryNav />
          <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-4 sm:px-6 sm:pb-10 sm:pt-6">
            {children}
          </main>
          <Footer />
          <BottomNav />
          <SearchModal />
          <AuthModal />
          <TradeModal />
          <TradeSuccess />
          <Toaster />
        </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
