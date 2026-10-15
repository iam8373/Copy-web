import Link from "next/link";
import { notFound } from "next/navigation";
import { hasRole, requireStaff } from "@/services/admin/auth";
import { getAdminMarket } from "@/services/admin/markets";
import { COPY } from "../../_copy";
import { card } from "../../_components/styles";
import { fmtNum } from "../../_components/format";
import { AuditList } from "../../_components/AuditList";
import { StatusBadge } from "../../_components/StatusBadge";
import { MarketForm } from "../MarketForm";
import { StatusActions } from "../StatusActions";

const C = COPY.markets;

export default async function EditMarket({ params }: { params: { id: string } }) {
  const staff = await requireStaff("moderator");
  const m = await getAdminMarket(staff, params.id);
  if (!m) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/markets" className="text-13 text-secondary hover:underline">← {C.title}</Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-24 font-bold text-primary">{C.editTitle}</h1>
          <p className="flex flex-wrap items-center gap-2 text-13 text-secondary">
            <StatusBadge status={m.status} />
            <span className="font-mono">{m.slug}</span>
            {m.status !== "draft" && (
              <Link href={`/market/${m.slug}`} className="text-brand hover:underline">{C.viewPublic}</Link>
            )}
          </p>
        </div>
        <StatusActions id={m.id} slug={m.slug} status={m.status} isAdmin={hasRole(staff, "admin")} />
      </header>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className={card}>
          <MarketForm
            key={JSON.stringify([m.status, m.title, m.endDate, m.outcomes.length, m.tags])}
            mode="edit"
            id={m.id}
            status={m.status}
            initial={{
              slug: m.slug, title: m.title, description: m.description, category: m.category as never,
              subcategory: m.subcategory, endDate: m.endDate, resolutionSource: m.resolutionSource,
              isBinary: m.isBinary, outcomes: m.outcomes.map((o) => o.label), liquidityB: m.liquidityB,
              isFeatured: m.isFeatured, isLive: m.isLive, tags: m.tags, region: m.region,
            }}
          />
        </div>
        <div className="flex flex-col gap-4">
          <section className={card} aria-labelledby="oc-h">
            <h2 id="oc-h" className="text-16 font-bold text-primary">{C.outcomesTitle}</h2>
            <ul className="mt-2 flex flex-col gap-1 text-13">
              {m.outcomes.map((o) => (
                <li key={o.id} className="flex justify-between gap-2">
                  <span className="text-primary">
                    {o.label}
                    {m.resolvedOutcomeId === o.id && " ✓"}
                  </span>
                  <span className="font-mono text-secondary">{Math.round(o.price * 100)}%</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-12 text-secondary">{COPY.markets.cols.volume}: ₹{fmtNum(m.totalVolume)}</p>
          </section>
          <section className={card} aria-labelledby="hist-h">
            <h2 id="hist-h" className="text-16 font-bold text-primary">{C.history}</h2>
            <AuditList rows={m.history} empty={C.historyEmpty} />
          </section>
        </div>
      </div>
    </div>
  );
}
