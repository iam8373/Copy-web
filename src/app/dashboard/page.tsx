import type { Metadata } from "next";
import { DashboardView } from "@/components/DashboardView";

export const metadata: Metadata = { title: "Dashboard — BharatPredict" };

export default function DashboardPage() {
  return <DashboardView />;
}
