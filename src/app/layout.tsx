import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Header } from "@/components/Header";
import { CategoryNav } from "@/components/CategoryNav";
import { Footer } from "@/components/Footer";
import { SearchModal } from "@/components/SearchModal";
import { TradeModal } from "@/components/TradeModal";
import { Toaster } from "@/components/Toaster";
import { LiveTicker } from "@/components/LiveTicker";

export const metadata: Metadata = {
  title: "Predict — The BNB-Native Prediction Market",
  description:
    "Trade the outcome of real-world events across sports, politics, crypto, finance, tech, economy and culture.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg-primary font-sans text-content-primary antialiased">
        <ThemeProvider>
          <LiveTicker />
          <Header />
          <CategoryNav />
          <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-4 sm:px-6 sm:pt-6">{children}</div>
          <Footer />
          <SearchModal />
          <TradeModal />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
