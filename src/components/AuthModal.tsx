"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Mail, ShieldCheck } from "lucide-react";
import { useMarketStore } from "@/store/useMarketStore";
import { useT } from "@/i18n/LanguageProvider";
import { Button, Dialog, FOCUS_RING, Segmented } from "@/components/ui";
import { cn } from "@/lib/utils";
import { TURNSTILE_SITE_KEY, supabaseConfigured } from "@/lib/supabase/config";
import { requestEmailCode, startGoogleSignIn, verifyEmailCode } from "@/app/actions/auth";
import { Turnstile, type TurnstileHandle } from "@/components/Turnstile";
import { notifyAuthChanged } from "@/components/AuthSync";

type Tab = "email" | "google";

/** Deliberately loose: the real check is the code arriving in the inbox. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Supabase allows one code request per 60 s per address by default. */
const RESEND_SECONDS = 60;

/**
 * Sign-in sheet (D-019, D-021): Google, plus a 6-digit email code when
 * EMAIL_OTP_ENABLED is on (public email sign-in needs custom SMTP). The 18+
 * box gates every route and is re-checked on the server; consent is recorded
 * server-side (confirm_age) after sign-in. All calls are Server Actions; the
 * Turnstile widget only loads while this sheet is open.
 */
export function AuthModal({ emailOtpEnabled }: { emailOtpEnabled: boolean }) {
  const open = useMarketStore((s) => s.authOpen);
  const setOpen = useMarketStore((s) => s.setAuthOpen);

  const [tab, setTab] = useState<Tab>(emailOtpEnabled ? "email" : "google");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [ageOk, setAgeOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const turnstile = useRef<TurnstileHandle>(null);
  const { t } = useT();
  const needsCaptcha = TURNSTILE_SITE_KEY !== "";

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Reset on CLOSE, not on open. Resetting in an effect after opening raced
  // with fast input: ticking the 18+ box before the effect ran got undone,
  // leaving the sign-in buttons disabled. Initial state is already clean.
  useEffect(() => {
    if (!open) {
      setTab(emailOtpEnabled ? "email" : "google");
      setEmail("");
      setCode("");
      setStage("email");
      setAgeOk(false);
      setError(null);
      setBusy(false);
      setCaptcha(null);
    }
  }, [open, emailOtpEnabled]);

  const address = email.trim().toLowerCase();

  const sendCode = async () => {
    if (!ageOk) return setError(t("auth", "errorAge"));
    if (!EMAIL.test(address)) return setError(t("auth", "errorEmail"));
    if (needsCaptcha && !captcha) return setError(t("auth", "errorCaptcha"));
    setError(null);
    setBusy(true);
    const r = await requestEmailCode({ email: address, captchaToken: captcha ?? undefined, ageConfirmed: true }).catch(
      () => ({ ok: false as const, reason: "failed" as const })
    );
    setBusy(false);
    turnstile.current?.reset(); // tokens are single-use
    if (r.ok) {
      setStage("code");
      setCode("");
      setCooldown(RESEND_SECONDS);
      return;
    }
    setError(
      t(
        "auth",
        r.reason === "rate_limited"
          ? "errorRateLimit"
          : r.reason === "captcha"
            ? "errorCaptcha"
            : r.reason === "invalid_email"
              ? "errorEmail"
              : "errorSendFailed"
      )
    );
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code)) return setError(t("auth", "errorCode"));
    setBusy(true);
    const r = await verifyEmailCode({ email: address, code, ageConfirmed: true }).catch(
      () => ({ ok: false as const, reason: "failed" as const })
    );
    setBusy(false);
    if (r.ok) {
      setOpen(false);
      notifyAuthChanged({ fresh: true });
      return;
    }
    setError(
      t("auth", r.reason === "invalid" ? "errorCodeInvalid" : r.reason === "rate_limited" ? "errorRateLimit" : "errorSendFailed")
    );
  };

  const google = async () => {
    if (!ageOk) return setError(t("auth", "errorAge"));
    setError(null);
    setBusy(true);
    const r = await startGoogleSignIn({
      next: `${window.location.pathname}${window.location.search}`,
      ageConfirmed: true,
    }).catch(() => ({ ok: false as const, reason: "failed" as const }));
    if (r.ok) {
      window.location.assign(r.url);
      return;
    }
    setBusy(false);
    setError(t("auth", "errorGoogle"));
  };

  const googleBlock = (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        size="lg"
        fullWidth
        disabled={!ageOk || busy}
        loading={busy && tab === "google"}
        data-testid="google-signin"
        onClick={() => void google()}
        className="text-14"
      >
        {t("auth", "continueGoogle")}
      </Button>
      <p className="text-12 text-secondary">{t("auth", "googleHint")}</p>
    </div>
  );

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title={t("auth", "title")}
      description={t("auth", "subtitle")}
      data-testid="auth-modal"
    >
      {!supabaseConfigured ? (
        <p role="status" className="rounded-btn border border-warning/30 bg-warning/10 px-3 py-2 text-13 text-warning">
          {t("auth", "authUnavailable")}
        </p>
      ) : (
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

          {!emailOtpEnabled ? (
            <>
              {googleBlock}
              <p className="text-12 text-secondary" data-testid="email-soon">
                {t("auth", "emailSoon")}
              </p>
            </>
          ) : (
            <>
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

              {tab === "google" ? (
                googleBlock
              ) : stage === "email" ? (
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
                    onKeyDown={(e) => e.key === "Enter" && void sendCode()}
                    className={cn(
                      "h-11 w-full rounded-btn border border-subtle bg-surface-3 px-3 text-16 text-primary placeholder:text-muted focus:border-brand",
                      FOCUS_RING
                    )}
                  />
                  <p className="text-12 text-secondary">{t("auth", "codeHint")}</p>
                  {needsCaptcha && <Turnstile ref={turnstile} siteKey={TURNSTILE_SITE_KEY} onToken={setCaptcha} />}
                  <Button
                    size="lg"
                    fullWidth
                    onClick={() => void sendCode()}
                    loading={busy}
                    disabled={!ageOk || (needsCaptcha && !captcha)}
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
                    onKeyDown={(e) => e.key === "Enter" && void verifyCode()}
                    className={cn(
                      "tnum h-11 w-full rounded-btn border border-subtle bg-surface-3 px-3 text-center text-18 font-bold tracking-[0.4em] text-primary focus:border-brand",
                      FOCUS_RING
                    )}
                  />
                  <Button
                    size="lg"
                    fullWidth
                    onClick={() => void verifyCode()}
                    loading={busy}
                    leadingIcon={<Check className="h-4 w-4" />}
                    className="mt-1 text-14"
                  >
                    {t("auth", "verify")}
                  </Button>
                  {needsCaptcha && <Turnstile ref={turnstile} siteKey={TURNSTILE_SITE_KEY} onToken={setCaptcha} />}
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="resend-code"
                    disabled={cooldown > 0 || busy || (needsCaptcha && !captcha)}
                    onClick={() => void sendCode()}
                    className="self-center text-12"
                  >
                    {cooldown > 0 ? t("auth", "resendIn", { seconds: cooldown }) : t("auth", "resendCode")}
                  </Button>
                </div>
              )}
            </>
          )}

          {error && (
            <p role="alert" className="rounded-btn border border-danger/30 bg-danger/10 px-3 py-2 text-12 text-danger">
              {error}
            </p>
          )}

          {emailOtpEnabled && (
            <p className="flex items-start gap-2 text-11 text-secondary">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
              {t("auth", "realNote")}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
