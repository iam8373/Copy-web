import Link from "next/link";
import type { Proposal } from "@/services/admin/resolutions";
import { COPY } from "../_copy";
import { fmtDate } from "../_components/format";

const C = COPY.resolutions;

/** One proposal: result, evidence, who and when, window or outcome. */
export function ProposalCard({ p, showMarket = false, children }: { p: Proposal; showMarket?: boolean; children?: React.ReactNode }) {
  const windowOver = p.disputeEndsAt !== null && Date.parse(p.disputeEndsAt) <= Date.now();
  return (
    <article data-testid="proposal" className="flex flex-col gap-2 rounded-card border border-subtle bg-surface-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-chip bg-surface-3 px-1.5 text-11 font-semibold uppercase tracking-wide text-secondary">
          {C.statusLabels[p.status]}
        </span>
        {showMarket ? (
          <Link href={`/admin/resolutions/${p.marketId}`} className="text-14 font-semibold text-primary hover:underline">
            {p.marketTitle}
          </Link>
        ) : null}
      </div>
      <p className="text-14 text-primary">
        <span className="text-secondary">{C.result}: </span>
        <strong data-testid="proposal-result">{p.kind === "void" ? C.voidLabel : p.outcomeLabel}</strong>
      </p>
      <p className="text-13 text-secondary">{p.note}</p>
      <a href={p.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow" className="w-fit break-all text-13 text-brand hover:underline">
        {C.evidence}: {p.evidenceUrl}
      </a>
      <p className="text-12 text-secondary">{C.proposedBy(p.proposer ?? "—", fmtDate(p.proposedAt))}</p>
      {p.approvedAt && <p className="text-12 text-secondary">{C.approvedBy(p.approver ?? "—", fmtDate(p.approvedAt))}</p>}
      {p.selfApproved && <p className="text-12 font-semibold text-warning">{C.selfApproved}</p>}
      {p.status === "approved" && (
        <p className="text-13 font-semibold text-primary">{windowOver ? C.windowOver : C.windowEnds(fmtDate(p.disputeEndsAt))}</p>
      )}
      {p.finalizedAt && <p className="text-12 text-secondary">{C.finalizedAt(fmtDate(p.finalizedAt))}</p>}
      {p.decidedReason && <p className="text-13 text-secondary">{C.reason}: {p.decidedReason}</p>}
      {children}
    </article>
  );
}
