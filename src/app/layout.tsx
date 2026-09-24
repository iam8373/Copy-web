import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Header } from "@/components/Header";
import { CategoryNav } from "@/components/CategoryNav";
import { Footer } from "@/components/Footer";
import { SearchModal } from "@/components/SearchModal";
import { AuthModal } from "@/components/AuthModal";
import { BottomNav } from "@/components/BottomNav";
import { TradeModal } from "@/components/TradeModal";
import { Toaster } from "@/components/Toaster";
import { LiveTicker } from "@/components/LiveTicker";

export const metadata: Metadata = {
  title: "BharatPredict — India's Prediction Market",
  description:
    "Trade the outcome of Indian and global events — cricket, elections, Bollywood, the economy and markets, priced in ₹.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg-primary font-sans text-content-primary antialiased">
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
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
