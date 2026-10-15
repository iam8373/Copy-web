"use client";

import Link from "next/link";
import { CircleCheck, Clock, Gavel, Undo2 } from "lucide-react";
import type { Market } from "@/lib/types";
import { useT } from "@/i18n/LanguageProvider";
import { useOutcomeLabel } from "@/lib/market-text";
import { Badge } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Public resolution state (R4): a status badge for cards and the market page,
 * and a notice on the market page with the proposed or final result, the
 * dispute deadline, the evidence link and the self-approval note.
 */

const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const ist = (iso: string | null | undefined) => (iso ? `${IST.format(new Date(iso))} IST` : "");

export type PublicState = "open" | "closed" | "resolving" | "resolved" | "voided";

/** Open markets past their end date read as closed until the job runs. */
export function publicState(m: Market): PublicState {
  const s = m.status ?? "open";
  if (s === "open" && Date.parse(m.endDate) <= Date.now()) return "closed";
  return s;
}

const TONE: Record<PublicState, BadgeTone> = {
  open: "neutral",
  closed: "warning",
  resolving: "brand",
  resolved: "success",
  voided: "danger",
};

function useLabelOf(m: Market) {
  const ol = useOutcomeLabel();
  return (id: string | null | undefined) => {
    const o = m.outcomes.find((x) => x.id === id);
    return o ? ol(o) : "";
  };
}

export function MarketStatusBadge({ market, className }: { market: Market; className?: string }) {
  const { t } = useT();
  const outcomeLabel = useLabelOf(market);
  const state = publicState(market);
  const text =
    state === "resolved"
      ? t("resolution", "resolved", { outcome: outcomeLabel(market.resolvedOutcomeId) })
      : t("resolution", state);
  return (
    <Badge tone={TONE[state]} data-testid="market-status" data-state={state} className={cn("max-w-full truncate", className)}>
      {text}
    </Badge>
  );
}

export function ResolutionNotice({ market }: { market: Market }) {
  const { t } = useT();
  const outcomeLabel = useLabelOf(market);
  const state = publicState(market);
  if (state === "open") return null;
  const r = market.resolution;
  let Icon = Clock;
  let body: string;
  if (state === "resolved") {
    Icon = CircleCheck;
    body = t("resolution", "noticeResolved", {
      outcome: outcomeLabel(market.resolvedOutcomeId),
      date: ist(market.resolvedAt),
    });
  } else if (state === "voided") {
    Icon = Undo2;
    body = t("resolution", "noticeVoided", { date: ist(market.resolvedAt) });
  } else if (state === "resolving" && r?.state === "approved") {
    Icon = Gavel;
    body =
      r.kind === "void"
        ? t("resolution", "noticeProposedVoid", { date: ist(r.disputeEndsAt) })
        : t("resolution", "noticeProposed", { outcome: outcomeLabel(r.outcomeId), date: ist(r.disputeEndsAt) });
  } else {
    body = t("resolution", state === "resolving" ? "noticeReviewing" : "noticeClosed");
  }
  const showDetails = r && (state === "resolving" || state === "resolved" || state === "voided");

  return (
    <section
      data-testid="resolution-notice"
      aria-label={t("resolution", "title")}
      className="flex gap-3 rounded-card border border-subtle bg-surface-2 p-4"
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
      <div className="flex min-w-0 flex-col gap-1.5 text-13">
        <p className="font-semibold text-primary">{body}</p>
        {showDetails && r.note && <p className="text-secondary">{r.note}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {showDetails && (
            <a href={r.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-brand hover:underline">
              {t("resolution", "evidence")}
            </a>
          )}
          {state === "resolving" && r?.state === "approved" && (
            <Link href="/grievance" className="text-brand hover:underline">
              {t("resolution", "grievance")}
            </Link>
          )}
        </div>
        {showDetails && r.selfApproved && <p className="text-12 text-secondary">{t("resolution", "selfApproved")}</p>}
      </div>
    </section>
  );
}
