"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { COPY, errorMessage } from "../_copy";
import { input, label, textarea } from "../_components/styles";
import { updateGrievance } from "./actions";

const C = COPY.grievances;

export function GrievanceForm({ id, status, note }: { id: string; status: "open" | "in_progress" | "resolved" | "closed"; note: string }) {
  const router = useRouter();
  const [s, setS] = useState(status);
  const [n, setN] = useState(note);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await updateGrievance(id, s, n);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: errorMessage(r.error) });
    setMsg({ ok: true, text: C.saved });
    router.refresh();
  };
  return (
    <form onSubmit={save} className="flex flex-col gap-3" aria-label={C.handle}>
      <div className="flex flex-col gap-1">
        <label htmlFor="g-status" className={label}>{C.status}</label>
        <select id="g-status" className={input + " w-56"} value={s} onChange={(e) => setS(e.target.value as typeof s)}>
          {(["open", "in_progress", "resolved", "closed"] as const).map((x) => (
            <option key={x} value={x}>{C.statuses[x]}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="g-note" className={label}>{C.note}</label>
        <textarea id="g-note" className={textarea} value={n} onChange={(e) => setN(e.target.value)} maxLength={5000} />
        <p className="text-12 text-secondary">{C.noteHint}</p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" loading={busy}>{C.save}</Button>
        <span role="status" className={msg?.ok ? "text-13 text-success" : "text-13 text-danger"}>{msg?.text}</span>
      </div>
    </form>
  );
}
