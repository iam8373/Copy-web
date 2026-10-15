import Link from "next/link";
import { requireStaff } from "@/services/admin/auth";
import { getQuota, listTranslations } from "@/services/admin/translations";
import { TARGET_LOCALES } from "@/services/translation/types";
import { COPY } from "../_copy";
import { btn, input, td, th } from "../_components/styles";
import { StatusBadge } from "../_components/StatusBadge";
import { StateChip } from "./StateChip";
import { GenerateButton } from "./GenerateButton";

const C = COPY.translations;

export default async function Translations({ searchParams }: { searchParams: { filter?: string; page?: string; q?: string } }) {
  const staff = await requireStaff("moderator");
  const filter = searchParams.filter === "all" ? "all" : "needs";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const q = (searchParams.q ?? "").slice(0, 80);
  const [data, quota] = await Promise.all([listTranslations(staff, { filter, page, q }), getQuota(staff)]);
  const full = quota ? quota.used >= quota.cap : false;
  const pages = data ? Math.max(1, Math.ceil(data.total / 50)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-24 font-bold text-primary">{C.title}</h1>
        <p className="text-14 text-secondary">{C.intro}</p>
        {quota && (
          <p data-testid="translation-quota" className={full ? "text-13 font-semibold text-danger" : "text-13 font-semibold text-primary"}>
            {C.quota(quota.used, quota.cap)}
          </p>
        )}
        <p className="text-12 text-secondary">{C.stateHelp}</p>
      </header>
      <nav aria-label={C.title} className="flex gap-1">
        {(["needs", "all"] as const).map((f) => (
          <Link key={f} href={`/admin/translations?filter=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`} aria-current={f === filter ? "page" : undefined} className={btn(f === filter ? "secondary" : "outline", "sm")}>
            {C.filters[f]}
          </Link>
        ))}
      </nav>
      <form action="/admin/translations" className="flex max-w-md gap-2" role="search">
        <input type="hidden" name="filter" value={filter} />
        <label htmlFor="tq" className="sr-only">{COPY.markets.search}</label>
        <input id="tq" name="q" defaultValue={q} placeholder={COPY.markets.search} className={input} />
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
                <th className={th}>{COPY.markets.cols.title}</th>
                {TARGET_LOCALES.map((l) => (
                  <th key={l} className={th}>{C.locales[l]}</th>
                ))}
                <th className={th}><span className="sr-only">{C.generate}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border-subtle))]">
              {data.rows.map((r) => (
                <tr key={r.id} data-testid="translation-row" data-slug={r.slug}>
                  <td className={td}>
                    <Link href={`/admin/translations/${r.id}`} className="font-semibold text-primary hover:underline">{r.title}</Link>
                    <div className="mt-0.5 flex items-center gap-2">
                      <StatusBadge status={r.status} />
                      <span className="font-mono text-12 text-secondary">{r.slug}</span>
                    </div>
                  </td>
                  {TARGET_LOCALES.map((l) => (
                    <td key={l} className={td} data-locale={l}><StateChip state={r.states[l]} /></td>
                  ))}
                  <td className={td}><GenerateButton marketId={r.id} disabled={full} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-3 text-13 text-secondary">
          {page > 1 && <Link className={btn("outline", "sm")} href={`/admin/translations?filter=${filter}&q=${encodeURIComponent(q)}&page=${page - 1}`}>{COPY.markets.prev}</Link>}
          <span>{COPY.markets.page(page, pages)}</span>
          {page < pages && <Link className={btn("outline", "sm")} href={`/admin/translations?filter=${filter}&q=${encodeURIComponent(q)}&page=${page + 1}`}>{COPY.markets.next}</Link>}
        </nav>
      )}
    </div>
  );
}
