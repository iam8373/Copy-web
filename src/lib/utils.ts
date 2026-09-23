import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatVolume(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString("en-US")}`;
}

export function formatVolumeFull(n: number) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function formatVolumeChange(n: number) {
  const sign = n >= 0 ? "+" : "-";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${Math.round(abs)}`;
}

export function formatPercent(price: number, digits = 0) {
  const pct = price * 100;
  const d = digits || (pct < 10 || !Number.isInteger(Number(pct.toFixed(1))) ? 1 : 0);
  return `${pct.toFixed(d)}%`;
}

export function formatChange(change: number) {
  const pts = change * 100;
  if (Math.abs(pts) < 0.05) return "0.0";
  return `${pts > 0 ? "+" : ""}${pts.toFixed(1)}`;
}

export function formatEndDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function countdown(iso: string, now = Date.now()) {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return "Closed";
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const seconds = Math.floor((diff % 60000) / 1000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export const CATEGORY_TINT: Record<string, string> = {
  sports: "text-accent-green",
  politics: "text-accent-blue",
  crypto: "text-accent-yellow",
  esports: "text-accent-blue",
  finance: "text-accent-green",
  tech: "text-accent-blue",
  economy: "text-accent-yellow",
  culture: "text-accent-red",
};
