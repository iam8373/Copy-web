"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { COPY, errorMessage } from "../_copy";
import { card, input, label } from "../_components/styles";
import { ReasonDialog } from "../_components/ReasonDialog";
import { adjustCredits, setUserRole, setUserStatus } from "./actions";

const C = COPY.users;
const nf = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

type Msg = { ok: boolean; text: string } | null;

export function UserActions({
  userId,
  status,
  role,
  cap,
}: {
  userId: string;
  status: "active" | "suspended";
  role: "user" | "moderator" | "admin";
  cap: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [nextRole, setNextRole] = useState(role);
  const [busy, setBusy] = useState<string | null>(null);
  const [credMsg, setCredMsg] = useState<Msg>(null);
  const [roleMsg, setRoleMsg] = useState<Msg>(null);
  const [statusMsg, setStatusMsg] = useState<Msg>(null);

  const credit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("credits");
    setCredMsg(null);
    const r = await adjustCredits(userId, Number(amount), reason);
    setBusy(null);
    if (!r.ok) return setCredMsg({ ok: false, text: errorMessage(r.error) });
    setCredMsg({ ok: true, text: C.applied(nf.format(Number(r.data))) });
    setAmount("");
    setReason("");
    router.refresh();
  };
  const changeRole = async () => {
    setBusy("role");
    setRoleMsg(null);
    const r = await setUserRole(userId, nextRole);
    setBusy(null);
    if (!r.ok) return setRoleMsg({ ok: false, text: errorMessage(r.error) });
    setRoleMsg({ ok: true, text: C.roleSaved });
    router.refresh();
  };
  const reinstate = async () => {
    setBusy("status");
    setStatusMsg(null);
    const r = await setUserStatus(userId, "active", "");
    setBusy(null);
    if (!r.ok) return setStatusMsg({ ok: false, text: errorMessage(r.error) });
    setStatusMsg({ ok: true, text: C.reinstated });
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={credit} className={card + " flex flex-col gap-3"} aria-label={C.credits}>
        <h2 className="text-16 font-bold text-primary">{C.credits}</h2>
        <p className="text-12 text-secondary">{C.creditsHint(nf.format(cap))}</p>
        <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <div className="flex flex-col gap-1">
            <label htmlFor="c-amount" className={label}>{C.amount}</label>
            <input id="c-amount" type="number" step="0.01" className={input} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="c-reason" className={label}>{C.reason}</label>
            <input id="c-reason" className={input} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={500} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={busy === "credits"} disabled={!amount || Number(amount) === 0 || reason.trim().length < 3}>{C.apply}</Button>
          <span role="status" className={credMsg?.ok ? "text-13 text-success" : "text-13 text-danger"}>{credMsg?.text}</span>
        </div>
      </form>

      <section className={card + " flex flex-col gap-3"} aria-labelledby="role-h">
        <h2 id="role-h" className="text-16 font-bold text-primary">{C.roleTitle}</h2>
        <p className="text-12 text-secondary">{C.roleHint}</p>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="u-role" className="sr-only">{C.newRole}</label>
          <select id="u-role" className={input + " w-48"} value={nextRole} onChange={(e) => setNextRole(e.target.value as typeof role)}>
            {(["user", "moderator", "admin"] as const).map((r) => (
              <option key={r} value={r}>{C.roles[r]}</option>
            ))}
          </select>
          <Button variant="outline" onClick={changeRole} loading={busy === "role"} disabled={nextRole === role}>{C.saveRole}</Button>
          <span role="status" className={roleMsg?.ok ? "text-13 text-success" : "text-13 text-danger"}>{roleMsg?.text}</span>
        </div>
      </section>

      <section className={card + " flex flex-wrap items-center gap-3"} aria-label={COPY.users.facts.status}>
        {status === "active" ? (
          <ReasonDialog
            trigger={C.suspend}
            title={C.suspendTitle}
            body={C.suspendBody}
            onConfirm={async (why) => {
              const r = await setUserStatus(userId, "suspended", why);
              if (!r.ok) return r.error;
              router.refresh();
              return null;
            }}
          />
        ) : (
          <Button variant="outline" onClick={reinstate} loading={busy === "status"}>{C.reinstate}</Button>
        )}
        <span role="status" className={statusMsg?.ok ? "text-13 text-success" : "text-13 text-danger"}>{statusMsg?.text}</span>
      </section>
    </div>
  );
}
