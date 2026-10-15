import Link from "next/link";
import { requireStaff } from "@/services/admin/auth";
import { GRIEVANCE_STATUSES, listGrievances, type GrievanceStatus } from "@/services/admin/people";
import { COPY } from "../_copy";
import { btn, td, th } from "../_components/styles";
import { fmtDate } from "../_components/format";

const C = COPY.grievances;

export default async function Grievances({ searchParams }: { searchParams: { status?: string; page?: string } }) {
  const staff = await requireStaff("moderator");
  const status: GrievanceStatus | "all" = (GRIEVANCE_STATUSES as readonly string[]).includes(searchParams.status ?? "")
    ? (searchParams.status as GrievanceStatus)
    : searchParams.status === "all" ? "all" : "open";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const data = await listGrievances(staff, status, page);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-24 font-bold text-primary">{C.title}</h1>
        <p className="text-14 text-secondary">{C.intro}</p>
      </header>
      <nav aria-label={C.title} className="flex flex-wrap gap-1">
        {(["open", "in_progress", "resolved", "closed", "all"] as const).map((s) => (
          <Link key={s} href={`/admin/grievances?status=${s}`} aria-current={s === status ? "page" : undefined} className={btn(s === status ? "secondary" : "outline", "sm")}>
            {C.statuses[s]}
          </Link>
        ))}
      </nav>
      {!data ? (
        <p role="alert" className="text-14 text-danger">{COPY.dashboard.unavailable}</p>
      ) : data.rows.length === 0 ? (
        <p className="text-14 text-secondary">{C.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-subtle bg-surface-2">
          <table className="w-full min-w-table">
            <thead className="border-b border-subtle">
              <tr>
                <th className={th}>{C.cols.ref}</th>
                <th className={th}>{C.cols.subject}</th>
                <th className={th}>{C.cols.category}</th>
                <th className={th}>{C.cols.status}</th>
                <th className={th}>{C.cols.received}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border-subtle))]">
              {data.rows.map((g) => (
                <tr key={g.id} data-testid="grievance-row">
                  <td className={td + " font-mono"}><Link href={`/admin/grievances/${g.id}`} className="hover:underline">{g.reference}</Link></td>
                  <td className={td}>{g.subject}</td>
                  <td className={td}>{C.categories[g.category as keyof typeof C.categories] ?? g.category}</td>
                  <td className={td}>{C.statuses[g.status]}</td>
                  <td className={td + " whitespace-nowrap"}>{fmtDate(g.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
