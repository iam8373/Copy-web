import type { Metadata } from "next";
import { ProfitView } from "@/components/ProfitView";

export const metadata: Metadata = { title: "Profit & Loss — BharatPredict" };

export default function ProfitPage() {
  return <ProfitView />;
}
