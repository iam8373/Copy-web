import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { getStaff } from "@/services/admin/auth";
import { btn } from "../_components/styles";
import { COPY } from "../_copy";
import { MfaForm } from "./MfaForm";

export const metadata = { title: "Two-step verification — Admin" };

export default async function MfaPage() {
  const staff = await getStaff();
  if (!staff) notFound();
  const { data } = await getServerSupabase({ readOnly: true }).auth.mfa.listFactors();
  const enrolled = (data?.totp.length ?? 0) > 0;

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-24 font-bold text-primary">{COPY.mfa.title}</h1>
        <p className="text-14 text-secondary">{COPY.mfa.intro}</p>
      </header>
      {staff.aal === "aal2" ? (
        <div className="flex flex-col gap-3">
          <p className="text-14 text-success">{COPY.mfa.already}</p>
          <Link href="/admin" className={btn("primary", "md", "w-fit")}>
            {COPY.mfa.toDashboard}
          </Link>
        </div>
      ) : (
        <MfaForm mode={enrolled ? "challenge" : "enroll"} />
      )}
    </div>
  );
}
