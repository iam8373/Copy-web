"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import type { TargetLocale } from "@/services/translation/types";
import { COPY, errorMessage } from "../_copy";
import { input, label, textarea } from "../_components/styles";
import { saveReviewedLocale } from "./actions";

const C = COPY.translations;

/** One locale: title, description and outcome labels; saved as reviewed. */
export function LocaleEditor({
  marketId,
  locale,
  initial,
  outcomes,
}: {
  marketId: string;
  locale: TargetLocale;
  initial: { title: string; description: string };
  outcomes: Array<{ id: string; english: string; label: string }>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [labels, setLabels] = useState(outcomes.map((o) => o.label));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const id = (k: string) => `${locale}-${k}`;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await saveReviewedLocale({
      marketId, locale, title, description,
      outcomes: outcomes.map((o, i) => ({ id: o.id, label: labels[i] })),
    });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: errorMessage(r.error) });
    setMsg({ ok: true, text: C.saved });
    router.refresh();
  };

  return (
    <form onSubmit={save} aria-label={C.locales[locale]} className="flex flex-col gap-3" lang={locale}>
      <div className="flex flex-col gap-1">
        <label htmlFor={id("title")} className={label}>{C.titleLabel}</label>
        <input id={id("title")} className={input} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={400} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={id("desc")} className={label}>{C.descriptionLabel}</label>
        <textarea id={id("desc")} className={textarea} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={8000} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className={label}>{C.outcomesLabel}</legend>
        {outcomes.map((o, i) => (
          <div key={o.id} className="grid items-center gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <label htmlFor={id(`o${i}`)} className="text-13 text-secondary" lang="en">{o.english}</label>
            <input
              id={id(`o${i}`)}
              className={input}
              value={labels[i]}
              required
              maxLength={200}
              onChange={(e) => setLabels((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
            />
          </div>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy}>{C.saveReviewed}</Button>
        <span role="status" aria-live="polite" className={msg?.ok ? "text-13 text-success" : "text-13 text-danger"}>{msg?.text}</span>
      </div>
    </form>
  );
}
