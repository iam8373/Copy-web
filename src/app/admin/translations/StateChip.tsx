import { cn } from "@/lib/utils";
import type { LocaleState } from "@/services/admin/translations";
import { COPY } from "../_copy";

const TONE: Record<LocaleState, string> = {
  missing: "bg-danger/15 text-danger",
  stale: "bg-warning/15 text-warning",
  machine: "bg-brand/15 text-brand",
  reviewed: "bg-success/15 text-success",
};

export function StateChip({ state, label }: { state: LocaleState; label?: string }) {
  return (
    <span data-state={state} className={cn("inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-chip px-1.5 text-11 font-semibold", TONE[state])}>
      {label && <span className="uppercase">{label}</span>}
      {COPY.translations.states[state]}
    </span>
  );
}
