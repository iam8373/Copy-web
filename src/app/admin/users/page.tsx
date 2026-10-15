import Link from "next/link";
import { requireStaff } from "@/services/admin/auth";
import { listUsers } from "@/services/admin/people";
import { COPY } from "../_copy";
import { btn, input, td, th } from "../_components/styles";
import { fmtDate, fmtNum } from "../_components/format";

const C = COPY.users;

export default async function Users({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  const staff = await requireStaff("admin");
  const q = (searchParams.q ?? "").slice(0, 120);
  const page = Math.max(1, Number(searchParams.page) || 1);
  const data = await listUsers(staff, q, page);
  const pages = data ? Math.max(1, Math.ceil(data.total / 50)) : 1;
  const href = (p: number) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-24 font-bold text-primary">{C.title}</h1>
        <p className="text-14 text-secondary">{C.intro}</p>
      </header>
      <form action="/admin/users" className="flex max-w-md gap-2" role="search">
        <label htmlFor="uq" className="sr-only">{C.search}</label>
        <input id="uq" name="q" defaultValue={q} placeholder={C.search} className={input} />
        <button type="submit" className={btn("outline")}>{COPY.markets.filter}</button>
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
                <th className={th}>{C.cols.user}</th>
                <th className={th}>{C.cols.role}</th>
                <th className={th}>{C.cols.status}</th>
                <th className={th + " text-right"}>{C.cols.balance}</th>
                <th className={th}>{C.cols.joined}</th>
                <th className={th}>{C.cols.lastSignIn}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border-subtle))]">
              {data.rows.map((u) => (
                <tr key={u.id} data-testid="user-row">
                  <td className={td}>
                    <Link href={`/admin/users/${u.id}`} className="font-semibold text-primary hover:underline">{u.email}</Link>
                    <div className="text-12 text-secondary">{u.handle}</div>
                  </td>
                  <td className={td}>{C.roles[u.role]}</td>
                  <td className={td}>
                    <span className={u.status === "suspended" ? "text-danger" : "text-success"}>{u.status}</span>
                  </td>
                  <td className={td + " text-right font-mono"}>₹{fmtNum(Number(u.balance ?? 0))}</td>
                  <td className={td + " whitespace-nowrap"}>{fmtDate(u.created_at)}</td>
                  <td className={td + " whitespace-nowrap"}>{fmtDate(u.last_sign_in_at)}</td>
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
