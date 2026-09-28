"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, Phone, ShieldCheck, X } from "lucide-react";
import { useMarketStore } from "@/store/useMarketStore";
import { cn } from "@/lib/utils";

type Tab = "phone" | "google";

const DEMO_ACCOUNTS = [
  { email: "arjun.mehta@gmail.com", initial: "A" },
  { email: "priya.sharma@gmail.com", initial: "P" },
];

export function AuthModal() {
  const open = useMarketStore((s) => s.authOpen);
  const setOpen = useMarketStore((s) => s.setAuthOpen);
  const signIn = useMarketStore((s) => s.signIn);

  const [tab, setTab] = useState<Tab>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"number" | "otp">("number");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTab("phone");
      setPhone("");
      setOtp("");
      setStage("number");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  if (!open) return null;

  const digits = phone.replace(/\D/g, "").slice(0, 10);
  const phoneValid = /^[6-9]\d{9}$/.test(digits);

  const sendOtp = () => {
    if (!phoneValid) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    setError(null);
    setStage("otp");
  };

  const verifyOtp = () => {
    if (otp.replace(/\D/g, "").length !== 6) {
      setError("Enter the 6-digit OTP. Any 6 digits work in this demo.");
      return;
    }
    signIn({
      method: "phone",
      handle: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`,
      initial: digits.slice(-1),
    });
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={() => setOpen(false)} />

      <div className="relative w-full max-w-md rounded-t-xl border border-subtle bg-bg-secondary p-4 shadow-2xl animate-slide-up sm:rounded-xl sm:p-6">
        <div className="flex items-start gap-3">
          <div>
            <h2 className="text-[17px] font-bold text-content-primary">Sign up / Log in</h2>
            <p className="mt-0.5 text-[13px] text-content-secondary">
              Trade Indian events in ₹. No wallet needed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-content-secondary transition-colors hover:bg-bg-tertiary hover:text-content-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-bg-tertiary p-1">
          {(["phone", "google"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setError(null);
              }}
              className={cn(
                "rounded-md py-2 text-[13px] font-semibold transition-colors",
                tab === t
                  ? "bg-bg-secondary text-content-primary"
                  : "text-content-secondary hover:text-content-primary"
              )}
            >
              {t === "phone" ? "Phone" : "Google"}
            </button>
          ))}
        </div>

        {tab === "phone" ? (
          <div className="mt-4 flex flex-col gap-3">
            {stage === "number" ? (
              <>
                <label
                  className="text-[12px] font-medium text-content-secondary"
                  htmlFor="auth-phone"
                >
                  Mobile number
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-subtle bg-bg-tertiary px-3 focus-within:border-accent-blue">
                  <span className="tnum shrink-0 text-[15px] font-semibold text-content-secondary">
                    +91
                  </span>
                  <input
                    id="auth-phone"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="98765 43210"
                    value={digits}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                    className="tnum h-11 w-full bg-transparent text-[15px] font-semibold text-content-primary outline-none placeholder:font-normal placeholder:text-content-secondary"
                  />
                </div>
                <button
                  type="button"
                  onClick={sendOtp}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg bg-accent-blue text-[14px] font-bold text-white transition-colors hover:bg-accent-strong"
                >
                  <Phone className="h-4 w-4" />
                  Send OTP
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setStage("number");
                    setError(null);
                  }}
                  className="flex w-fit items-center gap-1 text-[12px] font-semibold text-content-secondary transition-colors hover:text-content-primary"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Change number
                </button>
                <label
                  className="text-[12px] font-medium text-content-secondary"
                  htmlFor="auth-otp"
                >
                  Enter the OTP sent to +91 {digits.slice(0, 5)} {digits.slice(5)}
                </label>
                <input
                  id="auth-otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setError(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
                  className="tnum h-11 w-full rounded-lg border border-subtle bg-bg-tertiary px-3 text-center text-[18px] font-bold tracking-[0.4em] text-content-primary outline-none focus:border-accent-blue"
                />
                <button
                  type="button"
                  onClick={verifyOtp}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg bg-accent-blue text-[14px] font-bold text-white transition-colors hover:bg-accent-strong"
                >
                  <Check className="h-4 w-4" />
                  Verify &amp; continue
                </button>
                <p className="text-center text-[11px] text-content-secondary">
                  Demo mode — any 6 digits will verify.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-[12px] text-content-secondary">
              Choose a demo Google account to continue.
            </p>
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                data-testid="google-account"
                onClick={() =>
                  signIn({ method: "google", handle: a.email, initial: a.initial })
                }
                className="flex items-center gap-3 rounded-lg border border-subtle bg-bg-tertiary px-3 py-2.5 text-left transition-colors hover:border-accent-blue"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent-blue to-accent-strong text-[13px] font-bold text-white">
                  {a.initial}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-content-primary">
                  {a.email}
                </span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-lg border border-accent-red/30 bg-accent-red/10 px-3 py-2 text-[12px] text-accent-red">
            {error}
          </p>
        )}

        <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-content-secondary">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-green" />
          Demo authentication only — no OTP is actually sent and no credentials leave your
          browser.
        </p>
      </div>
    </div>
  );
}
