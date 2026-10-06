"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Mail, ShieldCheck } from "lucide-react";
import { useMarketStore } from "@/store/useMarketStore";
import { useT } from "@/i18n/LanguageProvider";
import { Button, Dialog, FOCUS_RING, Segmented } from "@/components/ui";
import { cn } from "@/lib/utils";

type Tab = "email" | "google";

const DEMO_ACCOUNTS = [
  { email: "arjun.mehta@gmail.com", initial: "A" },
  { email: "priya.sharma@gmail.com", initial: "P" },
];

/** Deliberately loose: the real check is the code arriving in the inbox. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Sign-in: a 6-digit code sent by email, or Google. No phone/SMS route
 * (docs/DECISIONS.md D-019). DEMO: no email is sent and any 6 digits verify;
 * Supabase Auth (email OTP + Google OAuth) replaces the store call in backend
 * Phase 2. The self-declared 18+ box gates both routes and is recorded as
 * `ageConfirmedAt` on the session.
 */
export function AuthModal() {
  const open = useMarketStore((s) => s.authOpen);
  const setOpen = useMarketStore((s) => s.setAuthOpen);
  const signIn = useMarketStore((s) => s.signIn);

  const [tab, setTab] = useState<Tab>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [ageOk, setAgeOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useT();

  // Reset on CLOSE, not on open. Resetting in an effect after opening raced
  // with fast input: ticking the 18+ box before the effect ran got undone,
  // leaving the sign-in buttons disabled. Initial state is already clean.
  useEffect(() => {
    if (!open) {
      setTab("email");
      setEmail("");
      setCode("");
      setStage("email");
      setAgeOk(false);
      setError(null);
    }
  }, [open]);

  const address = email.trim().toLowerCase();

  const sendCode = () => {
    if (!ageOk) return setError(t("auth", "errorAge"));
    if (!EMAIL.test(address)) return setError(t("auth", "errorEmail"));
    setError(null);
    setStage("code");
  };

  const verifyCode = () => {
    if (code.replace(/\D/g, "").length !== 6) return setError(t("auth", "errorCode"));
    signIn({
      method: "email",
      handle: address,
      initial: address.charAt(0).toUpperCase(),
      ageConfirmedAt: new Date().toISOString(),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title={t("auth", "title")}
      description={t("auth", "subtitle")}
      data-testid="auth-modal"
    >
      <div className="flex flex-col gap-4">
        {/* DRAFT copy — pending legal review. Self-declared, no DOB collected. */}
        <label className="flex cursor-pointer items-start gap-3 rounded-btn border border-subtle bg-surface-3 p-3">
          <input
            type="checkbox"
            required
            data-testid="age-confirm"
            checked={ageOk}
            onChange={(e) => {
              setAgeOk(e.target.checked);
              setError(null);
            }}
            className="mt-1 h-4 w-4 shrink-0 accent-brand"
          />
          <span className="text-12 text-secondary">
            {t("auth", "ageConfirm")}{" "}
            <Link href="/terms" className="font-semibold text-brand underline-offset-2 hover:underline">
              {t("auth", "termsLink")}
            </Link>
            {" · "}
            <Link href="/privacy" className="font-semibold text-brand underline-offset-2 hover:underline">
              {t("auth", "privacyLink")}
            </Link>
          </span>
        </label>

        <Segmented
          label={t("auth", "title")}
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            setError(null);
          }}
          options={[
            { value: "email", label: t("auth", "tabEmail") },
            { value: "google", label: t("auth", "tabGoogle") },
          ]}
          className="grid grid-cols-2"
        />

        {tab === "email" ? (
          stage === "email" ? (
            <div className="flex flex-col gap-2">
              <label className="text-12 font-medium text-secondary" htmlFor="auth-email">
                {t("auth", "emailLabel")}
              </label>
              <input
                id="auth-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                placeholder={t("auth", "emailPlaceholder")}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && sendCode()}
                className={cn(
                  "h-11 w-full rounded-btn border border-subtle bg-surface-3 px-3 text-16 text-primary placeholder:text-muted focus:border-brand",
                  FOCUS_RING
                )}
              />
              <Button
                size="lg"
                fullWidth
                onClick={sendCode}
                disabled={!ageOk}
                leadingIcon={<Mail className="h-4 w-4" />}
                className="mt-1 text-14"
              >
                {t("auth", "sendCode")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setStage("email");
                  setCode("");
                  setError(null);
                }}
                className={cn(
                  "flex min-h-touch w-fit items-center gap-1 rounded-btn text-12 font-semibold text-secondary transition-colors hover:text-primary",
                  FOCUS_RING
                )}
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                {t("auth", "changeEmail")}
              </button>
              <label className="text-12 font-medium text-secondary" htmlFor="auth-code">
                {t("auth", "codeSentTo", { email: address })}
              </label>
              <input
                id="auth-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                data-autofocus
                placeholder={t("auth", "codePlaceholder")}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && verifyCode()}
                className={cn(
                  "tnum h-11 w-full rounded-btn border border-subtle bg-surface-3 px-3 text-center text-18 font-bold tracking-[0.4em] text-primary focus:border-brand",
                  FOCUS_RING
                )}
              />
              <Button size="lg" fullWidth onClick={verifyCode} leadingIcon={<Check className="h-4 w-4" />} className="mt-1 text-14">
                {t("auth", "verify")}
              </Button>
              <p className="text-center text-11 text-secondary">{t("auth", "demoCodeNote")}</p>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-12 text-secondary">{t("auth", "chooseGoogle")}</p>
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                data-testid="google-account"
                disabled={!ageOk}
                onClick={() =>
                  signIn({
                    method: "google",
                    handle: a.email,
                    initial: a.initial,
                    ageConfirmedAt: new Date().toISOString(),
                  })
                }
                className={cn(
                  "flex min-h-touch items-center gap-3 rounded-btn border border-subtle bg-surface-3 px-3 py-2 text-left transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-40",
                  FOCUS_RING
                )}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-fill text-13 font-bold text-white">
                  {a.initial}
                </span>
                <span className="min-w-0 flex-1 truncate text-13 font-semibold text-primary">{a.email}</span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-btn border border-danger/30 bg-danger/10 px-3 py-2 text-12 text-danger">
            {error}
          </p>
        )}

        <p className="flex items-start gap-2 text-11 text-secondary">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
          {t("auth", "demoNote")}
        </p>
      </div>
    </Dialog>
  );
}
