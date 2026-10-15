import { cn } from "@/lib/utils";
import type { MarketStatus } from "@/lib/admin/market-schema";
import { COPY } from "../_copy";

const TONE: Record<MarketStatus, string> = {
  draft: "bg-surface-3 text-secondary",
  open: "bg-success/15 text-success",
  closed: "bg-warning/15 text-warning",
  resolving: "bg-brand/15 text-brand",
  resolved: "bg-surface-3 text-primary",
  voided: "bg-danger/15 text-danger",
};

export function StatusBadge({ status }: { status: MarketStatus }) {
  return (
    <span data-testid="admin-status" className={cn("inline-flex h-5 items-center rounded-chip px-1.5 text-11 font-semibold uppercase tracking-wide", TONE[status])}>
      {COPY.markets.statusLabels[status]}
    </span>
  );
}
