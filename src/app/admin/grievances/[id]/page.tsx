import Link from "next/link";
import { notFound } from "next/navigation";
import { hasRole, requireStaff } from "@/services/admin/auth";
import { getGrievance } from "@/services/admin/people";
import { COPY } from "../../_copy";
import { card } from "../../_components/styles";
import { fmtDate } from "../../_components/format";
import { GrievanceForm } from "../GrievanceForm";

const C = COPY.grievances;

export default async function GrievancePage({ params }: { params: { id: string } }) {
  const staff = await requireStaff("moderator");
  const g = await getGrievance(staff, params.id);
  if (!g) notFound();
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Link href="/admin/grievances" className="text-13 text-secondary hover:underline">← {C.back}</Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-24 font-bold text-primary">
          <span className="font-mono">{g.reference}</span> · {g.subject}
        </h1>
        <p className="text-13 text-secondary">
          {C.from(g.name, g.email)} · {fmtDate(g.created_at)} · {C.categories[g.category as keyof typeof C.categories] ?? g.category}
        </p>
        {g.user_id && hasRole(staff, "admin") && (
          <Link href={`/admin/users/${g.user_id}`} className="w-fit text-13 text-brand hover:underline">{C.linkedUser}</Link>
        )}
      </header>
      <section className={card}>
        <p data-testid="grievance-message" className="whitespace-pre-line text-14 text-primary">{g.message}</p>
      </section>
      <section className={card}>
        <GrievanceForm id={g.id} status={g.status} note={g.admin_note ?? ""} />
        {g.handler && <p className="mt-3 text-12 text-secondary">{C.handledBy(g.handler)}</p>}
        <p className="mt-1 text-12 text-secondary">{C.replyHint}</p>
      </section>
    </div>
  );
}
