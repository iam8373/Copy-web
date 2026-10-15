import Link from "next/link";
import { requireStaff } from "@/services/admin/auth";
import { getDashboard } from "@/services/admin/read";
import { COPY } from "./_copy";
import { card } from "./_components/styles";
import { fmtDate, fmtNum } from "./_components/format";
import { AuditList } from "./_components/AuditList";

const C = COPY.dashboard;

export default async function AdminDashboard() {
  const staff = await requireStaff("moderator");
  const d = await getDashboard(staff);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-24 font-bold text-primary">{C.title}</h1>
        <p className="text-14 text-secondary">{C.intro}</p>
      </header>
      {!d ? (
        <p role="alert" className="text-14 text-danger">{C.unavailable}</p>
      ) : (
        <>
          <p
            data-testid="trading-state"
            className={d.tradingEnabled ? "w-fit rounded-chip bg-success/15 px-2 py-1 text-13 font-semibold text-success" : "w-fit rounded-chip bg-danger/15 px-2 py-1 text-13 font-semibold text-danger"}
          >
            {d.tradingEnabled ? C.tradingOn : C.tradingOff}
          </p>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(Object.keys(C.stats) as Array<keyof typeof C.stats>).map((k) => (
              <div key={k} className="flex flex-col gap-1 rounded-card border border-subtle bg-surface-2 p-3">
                <dt className="text-12 text-secondary">{C.stats[k]}</dt>
                <dd data-testid={`stat-${k}`} className="font-mono text-20 font-bold text-primary">
                  {fmtNum(d.counts[k])}
                </dd>
              </div>
            ))}
          </dl>
          <section className={card} aria-labelledby="windows-h">
            <h2 id="windows-h" className="text-16 font-bold text-primary">{C.windowTitle}</h2>
            {d.windows.length === 0 ? (
              <p className="mt-2 text-13 text-secondary">{C.windowEmpty}</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {d.windows.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-baseline gap-x-2 text-13">
                    <Link href={`/market/${w.slug}`} className="font-semibold text-primary hover:underline">{w.title}</Link>
                    <span className="text-secondary">{C.windowEnds(fmtDate(w.endsAt))}</span>
                    {w.selfApproved && <span className="text-warning">{C.selfApproved}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className={card} aria-labelledby="audit-h">
            <h2 id="audit-h" className="text-16 font-bold text-primary">{C.auditTitle}</h2>
            <AuditList rows={d.audit} empty={C.auditEmpty} />
          </section>
        </>
      )}
    </div>
  );
}
