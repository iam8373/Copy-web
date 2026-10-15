import Link from "next/link";
import { requireStaff } from "@/services/admin/auth";
import { getCompliance } from "@/services/admin/people";
import { COPY } from "../_copy";
import { card } from "../_components/styles";
import { fmtNum } from "../_components/format";

const C = COPY.compliance;

function Facts({ title, rows, href }: { title: string; rows: Array<[string, string, boolean?]>; href?: string }) {
  return (
    <section className={card} aria-label={title}>
      <h2 className="text-16 font-bold text-primary">{href ? <Link href={href} className="hover:underline">{title}</Link> : title}</h2>
      <dl className="mt-2 flex flex-col gap-1.5 text-13">
        {rows.map(([k, v, warn]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-secondary">{k}</dt>
            <dd className={warn ? "font-semibold text-danger" : "font-semibold text-primary"}>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default async function Compliance() {
  const staff = await requireStaff("admin");
  const c = await getCompliance(staff);
  if (!c) return <p role="alert" className="text-14 text-danger">{COPY.dashboard.unavailable}</p>;
  const onOff = (b: boolean) => (b ? COPY.settings.on : COPY.settings.off);
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-24 font-bold text-primary">{C.title}</h1>
        <p className="text-14 text-secondary">{C.intro}</p>
        <p className="w-fit rounded-chip bg-warning/15 px-2 py-1 text-12 font-semibold text-warning">{C.legal}</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <Facts title={C.sections.platform} href="/admin/settings" rows={[
          [C.trading, onOff(c.trading_enabled)],
          [C.twoPerson, onOff(c.two_person)],
          [C.disputeWindow, C.hours(Number(c.dispute_window_hours))],
        ]} />
        <Facts title={C.sections.users} href="/admin/users" rows={[
          [C.users, fmtNum(c.users)],
          [C.noAge, fmtNum(c.no_age_confirmation)],
          [C.suspended, fmtNum(c.suspended)],
          ...Object.entries(c.terms_versions).map(([v, n]) => [`${C.terms}: ${v}`, fmtNum(n)] as [string, string]),
        ]} />
        <Facts title={C.sections.grievances} href="/admin/grievances" rows={[
          [C.open, fmtNum(c.grievances_open)],
          [C.unack, fmtNum(c.grievances_unacknowledged_48h), c.grievances_unacknowledged_48h > 0],
          [C.over30, fmtNum(c.grievances_over_30d), c.grievances_over_30d > 0],
        ]} />
        <Facts title={C.sections.resolutions} href="/admin/resolutions?tab=history" rows={[
          [C.finalized, fmtNum(c.resolutions_30d)],
          [C.selfApproved, fmtNum(c.self_approved_30d)],
          [C.credits, `₹${fmtNum(Number(c.credits_adjusted_30d))}`],
        ]} />
      </div>
      <section className={card} aria-labelledby="staff-h">
        <h2 id="staff-h" className="text-16 font-bold text-primary">{C.sections.staff}</h2>
        <ul className="mt-2 flex flex-col gap-1 text-13">
          {c.staff.map((s) => (
            <li key={s.id} data-testid="staff-row" className="flex flex-wrap gap-x-3">
              <Link href={`/admin/users/${s.id}`} className="font-semibold text-primary hover:underline">{s.email}</Link>
              <span className="text-secondary">{s.role}</span>
              <span className={s.mfa ? "text-success" : "text-danger"}>{C.mfa}: {s.mfa ? C.mfaOk : C.mfaMissing}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
