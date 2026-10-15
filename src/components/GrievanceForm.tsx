"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { FOCUS_RING } from "@/components/ui/focus";
import { useT } from "@/i18n/LanguageProvider";
import { useMarketStore } from "@/store/useMarketStore";
import { cn } from "@/lib/utils";
import { sendGrievance } from "@/app/actions/grievance";

/**
 * Public grievance form (R6). Signed-in users are linked to their account by
 * the server; anyone else just leaves an email. The reference number is the
 * only thing returned.
 */

const CATEGORIES = ["account", "market", "resolution", "privacy", "other"] as const;
const field = cn("w-full rounded-btn border border-strong bg-surface-1 px-3 text-14 text-primary", FOCUS_RING);

export function GrievanceForm() {
  const { t } = useT();
  const session = useMarketStore((s) => s.session);
  const [f, setF] = useState({ name: "", email: "", category: "other" as (typeof CATEGORIES)[number], subject: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const email = f.email || (session?.handle.includes("@") ? session.handle : "");
    const r = await sendGrievance({ ...f, email });
    setBusy(false);
    if (r.ok) return setReference(r.reference);
    setError(t("grievanceForm", r.reason === "rate_limited" ? "rateLimited" : r.reason === "invalid" ? "invalid" : "failed"));
  };

  if (reference) {
    return (
      <div role="status" data-testid="grievance-sent" className="flex flex-col gap-1 rounded-card border border-success/30 bg-success/[0.06] p-4">
        <p className="text-16 font-bold text-primary">{t("grievanceForm", "sentTitle")}</p>
        <p className="text-14 text-secondary">{t("grievanceForm", "sentBody", { reference })}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-label={t("grievanceForm", "title")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="gf-name" className="text-13 font-semibold text-primary">{t("grievanceForm", "name")}</label>
          <input id="gf-name" className={cn(field, "h-10")} value={f.name} onChange={set("name")} required maxLength={120} autoComplete="name" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="gf-email" className="text-13 font-semibold text-primary">{t("grievanceForm", "email")}</label>
          <input
            id="gf-email"
            type="email"
            className={cn(field, "h-10")}
            value={f.email}
            placeholder={session?.handle.includes("@") ? session.handle : ""}
            onChange={set("email")}
            required={!session?.handle.includes("@")}
            maxLength={254}
            autoComplete="email"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="gf-cat" className="text-13 font-semibold text-primary">{t("grievanceForm", "category")}</label>
        <select id="gf-cat" className={cn(field, "h-10 sm:w-64")} value={f.category} onChange={set("category")}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{t("grievanceForm", `cat_${c}` as "cat_other")}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="gf-subject" className="text-13 font-semibold text-primary">{t("grievanceForm", "subject")}</label>
        <input id="gf-subject" className={cn(field, "h-10")} value={f.subject} onChange={set("subject")} required maxLength={200} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="gf-message" className="text-13 font-semibold text-primary">{t("grievanceForm", "message")}</label>
        <textarea id="gf-message" className={cn(field, "min-h-32 py-2")} value={f.message} onChange={set("message")} required minLength={10} maxLength={5000} />
        <p className="text-12 text-secondary">{t("grievanceForm", "messageHint")}</p>
      </div>
      {/* Honeypot for bots; hidden from people and assistive tech. */}
      <input tabIndex={-1} aria-hidden="true" autoComplete="off" className="hidden" name="website" value={f.website} onChange={set("website")} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy}>{t("grievanceForm", "submit")}</Button>
        {error && <p role="alert" className="text-13 text-danger">{error}</p>}
      </div>
      <p className="text-12 text-muted">{t("grievanceForm", "privacy")}</p>
    </form>
  );
}

export function GrievanceFormHeading() {
  const { t } = useT();
  return (
    <div className="mb-3 flex flex-col gap-1">
      <h2 id="grievance-form-h" className="text-16 font-bold text-primary">{t("grievanceForm", "title")}</h2>
      <p className="text-13 text-secondary">{t("grievanceForm", "intro")}</p>
    </div>
  );
}
