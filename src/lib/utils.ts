import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Indian numbering: thousands, lakh (1e5), crore (1e7). */
export function formatVolume(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function formatVolumeFull(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function formatVolumeChange(n: number) {
  const sign = n >= 0 ? "+" : "-";
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `${sign}${(abs / 1_00_00_000).toFixed(1)}Cr`;
  if (abs >= 1_00_000) return `${sign}${(abs / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${Math.round(abs)}`;
}

export function formatRupees(n: number, digits = 2) {
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
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
  cricket: "text-accent-green",
  politics: "text-accent-blue",
  entertainment: "text-accent-red",
  economy: "text-accent-yellow",
  finance: "text-accent-green",
  sports: "text-accent-blue",
  esports: "text-accent-blue",
  tech: "text-accent-blue",
  "world-news": "text-accent-yellow",
  war: "text-accent-red",
  ai: "text-accent-blue",
};

export const CATEGORY_LABEL: Record<string, string> = {
  cricket: "Cricket",
  politics: "Politics",
  entertainment: "Entertainment",
  economy: "Economy",
  finance: "Finance",
  sports: "Sports",
  esports: "eSports",
  tech: "Tech",
  "world-news": "World News",
  war: "War",
  ai: "AI",
};
