import Link from "next/link";
import { requireStaff } from "@/services/admin/auth";
import { listAudit } from "@/services/admin/people";
import { COPY } from "../_copy";
import { btn, input, label, td, th } from "../_components/styles";
import { fmtDate } from "../_components/format";

const C = COPY.audit;

const short = (v: unknown) => (v === null || v === undefined ? "" : JSON.stringify(v));

export default async function Audit({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const staff = await requireStaff("admin");
  const f = { action: searchParams.action ?? "", entity: searchParams.entity ?? "", entityId: searchParams.entityId ?? "" };
  const page = Math.max(1, Number(searchParams.page) || 1);
  const data = await listAudit(staff, { ...f, page });
  const pages = data ? Math.max(1, Math.ceil(data.total / 50)) : 1;
  const href = (p: number) => `/admin/audit?${new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), page: String(p) })}`;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-24 font-bold text-primary">{C.title}</h1>
        <p className="text-14 text-secondary">{C.intro}</p>
      </header>
      <form action="/admin/audit" className="flex flex-wrap items-end gap-2" role="search">
        {([["action", C.action], ["entity", C.entity], ["entityId", C.entityId]] as const).map(([k, l]) => (
          <div key={k} className="flex flex-col gap-1">
            <label htmlFor={`a-${k}`} className={label}>{l}</label>
            <input id={`a-${k}`} name={k} defaultValue={f[k]} className={input + " w-48"} />
          </div>
        ))}
        <button type="submit" className={btn("outline")}>{C.filter}</button>
      </form>
      {!data ? (
        <p role="alert" className="text-14 text-danger">{COPY.dashboard.unavailable}</p>
      ) : data.rows.length === 0 ? (
        <p className="text-14 text-secondary">{C.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-subtle bg-surface-2">
          <table className="w-full min-w-table">
            <thead className="border-b border-subtle">
              <tr>
                <th className={th}>{C.cols.when}</th>
                <th className={th}>{C.cols.action}</th>
                <th className={th}>{C.cols.entity}</th>
                <th className={th}>{C.cols.actor}</th>
                <th className={th}>{C.cols.change}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border-subtle))]">
              {data.rows.map((r) => (
                <tr key={r.id} data-testid="audit-row">
                  <td className={td + " whitespace-nowrap font-mono text-12"}>{fmtDate(r.createdAt)}</td>
                  <td className={td + " font-semibold"}>{r.action}</td>
                  <td className={td}>
                    {r.entity}
                    {r.entityId && <div className="font-mono text-11 text-secondary">{r.entityId}</div>}
                  </td>
                  <td className={td}>{r.actor ?? COPY.dashboard.system}</td>
                  <td className={td}>
                    {(r.before !== null || r.after !== null) && (
                      <details>
                        <summary className="cursor-pointer text-12 text-brand">{C.show}</summary>
                        <pre className="mt-1 max-w-md whitespace-pre-wrap break-all font-mono text-11 text-secondary">
                          {short(r.before)}
                          {"\n→ "}
                          {short(r.after)}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-3 text-13 text-secondary">
          {page > 1 && <Link className={btn("outline", "sm")} href={href(page - 1)}>{COPY.markets.prev}</Link>}
          <span>{COPY.markets.page(page, pages)}</span>
          {page < pages && <Link className={btn("outline", "sm")} href={href(page + 1)}>{COPY.markets.next}</Link>}
        </nav>
      )}
    </div>
  );
}
