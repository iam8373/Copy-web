import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/services/admin/auth";
import { getUser } from "@/services/admin/people";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { COPY } from "../../_copy";
import { card, td, th } from "../../_components/styles";
import { fmtDate, fmtNum } from "../../_components/format";
import { UserActions } from "../UserActions";

const C = COPY.users;
const F = C.facts;

export default async function UserPage({ params }: { params: { id: string } }) {
  const staff = await requireStaff("admin");
  const u = await getUser(staff, params.id);
  if (!u) notFound();
  const { data: capRow } = await getAdminSupabase().from("app_settings").select("value").eq("key", "admin_credit_cap").maybeSingle();
  const cap = Number(capRow?.value) || 10000;
  const self = u.id === staff.id;
  const facts: Array<[string, string]> = [
    [F.email, u.email],
    [F.handle, u.handle],
    [F.provider, u.provider ?? "—"],
    [F.role, C.roles[u.role]],
    [F.status, u.status],
    [F.balance, `₹${fmtNum(Number(u.balance ?? 0))}`],
    [F.joined, fmtDate(u.created_at)],
    [F.lastSignIn, fmtDate(u.last_sign_in_at)],
    [F.age, u.age_confirmed_at ? fmtDate(u.age_confirmed_at) : C.no],
    [F.terms, u.terms_version ?? "—"],
    [F.orders, String(u.orders)],
    [F.mfa, u.mfa_factors > 0 ? C.yes : C.no],
  ];

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/users" className="text-13 text-secondary hover:underline">← {C.back}</Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-24 font-bold text-primary">{C.detailTitle}</h1>
        <p className="text-16 font-semibold text-primary">{u.email}</p>
        {u.status === "suspended" && (
          <p data-testid="suspension" className="text-13 text-danger">{C.suspendedBecause(u.suspended_reason ?? "—", fmtDate(u.suspended_at))}</p>
        )}
      </header>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <dl className={card + " grid grid-cols-2 gap-x-4 gap-y-2 text-13"}>
          {facts.map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <dt className="text-12 text-secondary">{k}</dt>
              <dd data-testid={`fact-${k}`} className="break-all text-primary">{v}</dd>
            </div>
          ))}
        </dl>
        {self ? <p className={card + " text-13 text-secondary"}>{C.self}</p> : <UserActions userId={u.id} status={u.status} role={u.role} cap={cap} />}
      </div>
      <section className={card} aria-labelledby="ledger-h">
        <h2 id="ledger-h" className="text-16 font-bold text-primary">{C.ledger}</h2>
        {u.ledger.length === 0 ? (
          <p className="mt-2 text-13 text-secondary">{C.none}</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full">
              <tbody className="divide-y divide-[rgb(var(--border-subtle))]">
                {u.ledger.map((l) => (
                  <tr key={l.id}>
                    <td className={td + " whitespace-nowrap font-mono text-12 text-secondary"}>{fmtDate(l.created_at)}</td>
                    <td className={td}>{l.type}</td>
                    <td className={td}>{l.note ?? ""}</td>
                    <td className={td + " text-right font-mono " + (Number(l.amount) < 0 ? "text-danger" : "text-success")}>{fmtNum(Number(l.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className={card} aria-labelledby="pos-h">
        <h2 id="pos-h" className="text-16 font-bold text-primary">{C.positions}</h2>
        {u.positions.length === 0 ? (
          <p className="mt-2 text-13 text-secondary">{C.none}</p>
        ) : (
          <table className="mt-2 w-full">
            <thead><tr><th className={th}>{COPY.markets.cols.title}</th><th className={th}>{COPY.resolutions.result}</th><th className={th + " text-right"}>Shares</th></tr></thead>
            <tbody className="divide-y divide-[rgb(var(--border-subtle))]">
              {u.positions.map((p) => (
                <tr key={`${p.market_slug}-${p.outcome}`}>
                  <td className={td}><Link className="hover:underline" href={`/market/${p.market_slug}`}>{p.market_title}</Link></td>
                  <td className={td}>{p.outcome}</td>
                  <td className={td + " text-right font-mono"}>{fmtNum(Number(p.shares))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className={card} aria-labelledby="gr-h">
        <h2 id="gr-h" className="text-16 font-bold text-primary">{C.grievances}</h2>
        {u.grievances.length === 0 ? (
          <p className="mt-2 text-13 text-secondary">{C.none}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-13">
            {u.grievances.map((g) => (
              <li key={g.id}><Link className="font-mono hover:underline" href={`/admin/grievances/${g.id}`}>{g.reference}</Link> · {g.subject} · {g.status}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
