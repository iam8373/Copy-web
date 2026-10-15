import Link from "next/link";
import { requireStaff } from "@/services/admin/auth";
import { PAGE_SIZE, STATUSES, listMarkets } from "@/services/admin/markets";
import type { MarketStatus } from "@/lib/admin/market-schema";
import { COPY } from "../_copy";
import { btn, input, td, th } from "../_components/styles";
import { fmtDate, fmtNum } from "../_components/format";
import { StatusBadge } from "../_components/StatusBadge";

const C = COPY.markets;

export default async function AdminMarkets({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const staff = await requireStaff("moderator");
  const status = STATUSES.includes(searchParams.status as MarketStatus) ? (searchParams.status as MarketStatus) : undefined;
  const q = (searchParams.q ?? "").slice(0, 80);
  const page = Math.max(1, Number(searchParams.page) || 1);
  const data = await listMarkets(staff, { status, q, page });
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const href = (p: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ status, q: q || undefined, ...p })) if (v !== undefined && v !== "") sp.set(k, String(v));
    const s = sp.toString();
    return `/admin/markets${s ? `?${s}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-24 font-bold text-primary">{C.title}</h1>
          <p className="text-14 text-secondary">{C.intro}</p>
        </div>
        <Link href="/admin/markets/new" className={btn("primary")}>
          {C.newMarket}
        </Link>
      </header>
      <nav aria-label={C.filter} className="flex flex-wrap gap-1">
        {[undefined, ...STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={href({ status: s, page: undefined })}
            aria-current={s === status ? "page" : undefined}
            className={btn(s === status ? "secondary" : "outline", "sm")}
          >
            {s ? C.statusLabels[s] : C.all}
          </Link>
        ))}
      </nav>
      <form action="/admin/markets" className="flex max-w-md gap-2" role="search">
        {status && <input type="hidden" name="status" value={status} />}
        <label htmlFor="mq" className="sr-only">{C.search}</label>
        <input id="mq" name="q" defaultValue={q} placeholder={C.search} className={input} />
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
                <th className={th}>{C.cols.title}</th>
                <th className={th}>{C.cols.status}</th>
                <th className={th}>{C.cols.category}</th>
                <th className={th}>{C.cols.ends}</th>
                <th className={th + " text-right"}>{C.cols.volume}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border-subtle))]">
              {data.rows.map((m) => (
                <tr key={m.id} data-testid="admin-market-row">
                  <td className={td}>
                    <Link href={`/admin/markets/${m.id}`} className="font-semibold text-primary hover:underline">
                      {m.title}
                    </Link>
                    <div className="font-mono text-12 text-secondary">
                      {m.slug}
                      {m.isLive && ` · ${C.flags.live}`}
                      {m.isFeatured && ` · ${C.flags.featured}`}
                    </div>
                  </td>
                  <td className={td}><StatusBadge status={m.status} /></td>
                  <td className={td}>{m.category}</td>
                  <td className={td + " whitespace-nowrap"}>{fmtDate(m.endDate)}</td>
                  <td className={td + " text-right font-mono"}>₹{fmtNum(m.totalVolume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-3 text-13 text-secondary">
          {page > 1 && <Link className={btn("outline", "sm")} href={href({ page: page - 1 })}>{C.prev}</Link>}
          <span>{C.page(page, pages)}</span>
          {page < pages && <Link className={btn("outline", "sm")} href={href({ page: page + 1 })}>{C.next}</Link>}
        </nav>
      )}
    </div>
  );
}
