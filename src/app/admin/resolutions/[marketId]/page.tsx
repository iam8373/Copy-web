import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { hasRole, requireStaff } from "@/services/admin/auth";
import { getResolutionDetail } from "@/services/admin/resolutions";
import { COPY } from "../../_copy";
import { card } from "../../_components/styles";
import { fmtDate, fmtNum } from "../../_components/format";
import { StatusBadge } from "../../_components/StatusBadge";
import { ProposalCard } from "../ProposalCard";
import { ProposeForm } from "../ProposeForm";
import { ProposalActions } from "../ProposalActions";

const C = COPY.resolutions;

type Preview = { outcomes: Array<{ outcome_id: string; holders: number; payout: number }>; refund_users: number; refund_total: number };

export default async function ResolveMarket({ params }: { params: { marketId: string } }) {
  const staff = await requireStaff("moderator");
  const d = await getResolutionDetail(staff, params.marketId);
  if (!d) notFound();
  const { market: m, proposals } = d;
  // Staff session: the preview function checks role + MFA itself.
  const { data: preview } = await getServerSupabase({ readOnly: true }).rpc("admin_resolution_preview", { p_market_id: m.id });
  const pv = preview as Preview | null;
  const live = proposals.find((p) => p.status === "pending" || p.status === "approved");
  const eligible = m.status === "closed" || (m.status === "open" && Date.parse(m.endDate) <= Date.now());
  const isAdmin = hasRole(staff, "admin");

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/resolutions" className="text-13 text-secondary hover:underline">← {C.back}</Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-24 font-bold text-primary">{C.detailTitle}</h1>
        <p className="text-16 font-semibold text-primary">{m.title}</p>
        <p className="flex flex-wrap items-center gap-2 text-13 text-secondary">
          <StatusBadge status={m.status} />
          <span className="font-mono">{m.slug}</span>
          <span>{C.ended(fmtDate(m.endDate))}</span>
        </p>
        <p className="text-13 text-secondary">{C.source}: <span className="text-primary">{m.resolutionSource || "—"}</span></p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4">
          {live ? (
            <section aria-labelledby="live-h" className="flex flex-col gap-2">
              <h2 id="live-h" className="text-16 font-bold text-primary">{C.active}</h2>
              <ProposalCard p={live}>
                {isAdmin ? (
                  <ProposalActions
                    proposalId={live.id}
                    slug={m.slug}
                    status={live.status as "pending" | "approved"}
                    windowOver={live.disputeEndsAt !== null && Date.parse(live.disputeEndsAt) <= Date.now()}
                    proposedByMe={live.proposer === staff.handle}
                  />
                ) : (
                  <p className="text-13 text-secondary">{C.adminOnly}</p>
                )}
              </ProposalCard>
            </section>
          ) : eligible ? (
            <section className={card} aria-labelledby="propose-h">
              <h2 id="propose-h" className="text-16 font-bold text-primary">{C.proposeTitle}</h2>
              <p className="mb-3 mt-1 text-13 text-secondary">{C.proposeIntro}</p>
              <ProposeForm marketId={m.id} outcomes={m.outcomes} />
            </section>
          ) : (
            m.status !== "resolved" && m.status !== "voided" && <p className="text-14 text-secondary">{C.notEligible}</p>
          )}

          <section aria-labelledby="hist-h" className="flex flex-col gap-2">
            <h2 id="hist-h" className="text-16 font-bold text-primary">{C.history}</h2>
            {proposals.filter((p) => p !== live).length === 0 ? (
              <p className="text-13 text-secondary">{C.empty.history}</p>
            ) : (
              proposals.filter((p) => p !== live).map((p) => <ProposalCard key={p.id} p={p} />)
            )}
          </section>
        </div>

        <section className={card} aria-labelledby="pv-h">
          <h2 id="pv-h" className="text-16 font-bold text-primary">{C.preview}</h2>
          <ul className="mt-2 flex flex-col gap-2 text-13">
            {m.outcomes.map((o) => {
              const x = pv?.outcomes.find((y) => y.outcome_id === o.id);
              return (
                <li key={o.id} className="flex flex-col">
                  <span className="flex justify-between gap-2 text-primary">
                    <span>{o.label}</span>
                    <span className="font-mono">₹{fmtNum(Number(x?.payout ?? 0))}</span>
                  </span>
                  <span className="text-12 text-secondary">
                    {Math.round(o.price * 100)}% · {C.previewHolders(Number(x?.holders ?? 0))}
                  </span>
                </li>
              );
            })}
          </ul>
          {pv && <p className="mt-3 text-12 text-secondary">{C.previewVoid(Number(pv.refund_users), fmtNum(Number(pv.refund_total)))}</p>}
        </section>
      </div>
    </div>
  );
}
