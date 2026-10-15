"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { COPY, errorMessage } from "../_copy";
import { input, label, textarea } from "../_components/styles";
import { proposeResolution } from "./actions";

const C = COPY.resolutions;

export function ProposeForm({ marketId, outcomes }: { marketId: string; outcomes: Array<{ id: string; label: string }> }) {
  const router = useRouter();
  const [choice, setChoice] = useState<string>("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await proposeResolution({ marketId, outcomeId: choice === "void" ? null : choice, evidenceUrl: url, note });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: errorMessage(r.error) });
    setMsg({ ok: true, text: C.proposed });
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-label={C.proposeTitle}>
      <fieldset className="flex flex-col gap-2">
        <legend className={label}>{C.result}</legend>
        {outcomes.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-14 text-primary">
            <input type="radio" name="result" value={o.id} checked={choice === o.id} onChange={() => setChoice(o.id)} required />
            {o.label}
          </label>
        ))}
        <label className="flex items-center gap-2 text-14 text-danger">
          <input type="radio" name="result" value="void" checked={choice === "void"} onChange={() => setChoice("void")} />
          {C.voidLabel}
        </label>
      </fieldset>
      <div className="flex flex-col gap-1">
        <label htmlFor="r-url" className={label}>{C.evidenceUrl}</label>
        <input id="r-url" type="url" className={input} value={url} onChange={(e) => setUrl(e.target.value)} required maxLength={500} placeholder="https://" />
        <p className="text-12 text-secondary">{C.evidenceHint}</p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="r-note" className={label}>{C.note}</label>
        <textarea id="r-note" className={textarea} value={note} onChange={(e) => setNote(e.target.value)} required minLength={3} maxLength={2000} />
        <p className="text-12 text-secondary">{C.noteHint}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy} disabled={!choice}>{C.propose}</Button>
        <p role="status" aria-live="polite" className={msg?.ok ? "text-13 text-success" : "text-13 text-danger"}>{msg?.text}</p>
      </div>
    </form>
  );
}
