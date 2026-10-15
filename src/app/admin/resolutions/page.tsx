import Link from "next/link";
import { requireStaff } from "@/services/admin/auth";
import { QUEUE_TABS, getQueue, type QueueTab } from "@/services/admin/resolutions";
import { COPY } from "../_copy";
import { btn, td, th } from "../_components/styles";
import { fmtDate, fmtNum } from "../_components/format";
import { StatusBadge } from "../_components/StatusBadge";
import { ProposalCard } from "./ProposalCard";

const C = COPY.resolutions;

export default async function ResolutionQueue({ searchParams }: { searchParams: { tab?: string } }) {
  const staff = await requireStaff("moderator");
  const tab: QueueTab = QUEUE_TABS.includes(searchParams.tab as QueueTab) ? (searchParams.tab as QueueTab) : "needs";
  const data = await getQueue(staff, tab);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-24 font-bold text-primary">{C.title}</h1>
        <p className="text-14 text-secondary">{C.intro}</p>
        <p className="text-13 text-secondary">{C.policy}</p>
      </header>
      <nav aria-label={C.title} className="flex flex-wrap gap-1">
        {QUEUE_TABS.map((t) => (
          <Link key={t} href={`/admin/resolutions?tab=${t}`} aria-current={t === tab ? "page" : undefined} className={btn(t === tab ? "secondary" : "outline", "sm")}>
            {C.tabs[t]}
          </Link>
        ))}
      </nav>
      {!data ? (
        <p role="alert" className="text-14 text-danger">{COPY.dashboard.unavailable}</p>
      ) : "needs" in data ? (
        data.needs.length === 0 ? (
          <p className="text-14 text-secondary">{C.empty.needs}</p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-subtle bg-surface-2">
            <table className="w-full min-w-table">
              <thead className="border-b border-subtle">
                <tr>
                  <th className={th}>{COPY.markets.cols.title}</th>
                  <th className={th}>{COPY.markets.cols.status}</th>
                  <th className={th}>{COPY.markets.cols.ends}</th>
                  <th className={th + " text-right"}>{COPY.markets.cols.volume}</th>
                  <th className={th}><span className="sr-only">{C.view}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-subtle))]">
                {data.needs.map((m) => (
                  <tr key={m.id} data-testid="needs-row">
                    <td className={td}>
                      <span className="font-semibold">{m.title}</span>
                      <div className="font-mono text-12 text-secondary">{m.slug}</div>
                    </td>
                    <td className={td}><StatusBadge status={m.status} /></td>
                    <td className={td + " whitespace-nowrap"}>{fmtDate(m.endDate)}</td>
                    <td className={td + " text-right font-mono"}>₹{fmtNum(m.totalVolume)}</td>
                    <td className={td}>
                      <Link href={`/admin/resolutions/${m.id}`} className={btn("outline", "sm")} aria-label={`${C.view}: ${m.title}`}>
                        {C.view}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : data.proposals.length === 0 ? (
        <p className="text-14 text-secondary">{C.empty[tab]}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {data.proposals.map((p) => (
            <ProposalCard key={p.id} p={p} showMarket />
          ))}
        </div>
      )}
    </div>
  );
}
