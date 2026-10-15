"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { COPY, errorMessage } from "../_copy";
import { startMfaEnroll, verifyMfa } from "./actions";

const C = COPY.mfa;

/** Enrol (no verified factor yet) or challenge (factor exists). */
export function MfaForm({ mode }: { mode: "enroll" | "challenge" }) {
  const router = useRouter();
  const [factor, setFactor] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const start = async () => {
    setBusy(true);
    setError(null);
    const r = await startMfaEnroll();
    setBusy(false);
    if (r.ok) setFactor({ factorId: r.factorId, qr: r.qr, secret: r.secret });
    else setError(errorMessage(r.error));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await verifyMfa({ code, factorId: factor?.factorId });
    if (r.ok) {
      setDone(true);
      router.replace("/admin");
      router.refresh();
      return;
    }
    setBusy(false);
    setError(errorMessage(r.error));
  };

  const showCode = mode === "challenge" || factor !== null;

  return (
    <div className="flex flex-col gap-4">
      {mode === "enroll" && (
        <section className="flex flex-col gap-3 rounded-card border border-subtle bg-surface-2 p-4 sm:p-5">
          <h2 className="text-16 font-bold text-primary">{C.enrollTitle}</h2>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-13 text-secondary">
            {C.enrollSteps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {!factor ? (
            <Button className="w-fit" onClick={start} loading={busy}>
              {C.start}
            </Button>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              {/* eslint-disable-next-line @next/next/no-img-element -- data: URL from Supabase */}
              <img src={factor.qr} alt={C.qrAlt} width={176} height={176} className="rounded-btn bg-white p-2" />
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-12 text-secondary">{C.secretLabel}</span>
                <code data-testid="mfa-secret" className="break-all rounded-btn bg-surface-3 px-2 py-1 font-mono text-13 text-primary">
                  {factor.secret}
                </code>
              </div>
            </div>
          )}
        </section>
      )}

      {mode === "challenge" && (
        <section className="flex flex-col gap-1 rounded-card border border-subtle bg-surface-2 p-4 sm:p-5">
          <h2 className="text-16 font-bold text-primary">{C.challengeTitle}</h2>
          <p className="text-13 text-secondary">{C.challengeIntro}</p>
        </section>
      )}

      {showCode && (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor="mfa-code" className="text-13 font-semibold text-primary">
            {C.codeLabel}
          </label>
          <div className="flex gap-2">
            <input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="h-10 w-40 rounded-btn border border-strong bg-surface-1 px-3 font-mono text-16 tracking-widest text-primary"
            />
            <Button type="submit" loading={busy} disabled={code.length !== 6 || done}>
              {C.verify}
            </Button>
          </div>
        </form>
      )}

      <p role="status" aria-live="polite" className="text-13">
        {error && <span className="text-danger">{error}</span>}
        {done && <span className="text-success">{C.done}</span>}
      </p>
      <p className="text-12 text-muted">{C.lost}</p>
    </div>
  );
}
