import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Responsible Play — BharatPredict",
  description:
    "Spending limits, taking a break, and where to find help. Draft placeholder copy pending legal review.",
};

/** DRAFT — PENDING LEGAL REVIEW. Helpline details are unverified placeholders. */
export default function ResponsiblePlayPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="w-fit rounded-chip bg-warning/15 px-2 py-1 text-11 font-bold uppercase tracking-wide text-warning">
          Draft — pending legal review
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
          Responsible play
        </h1>
        <p className="text-14 leading-relaxed text-secondary">
          Prediction markets involve risk. You must be 18 or older to place an order.
        </p>
      </header>

      <section className="rounded-card border border-subtle bg-surface-2 p-4 sm:p-6">
        <h2 className="text-16 font-bold text-primary">Set a spending limit</h2>
        <ul className="mt-1.5 flex list-disc flex-col gap-1.5 pl-5 text-13 leading-relaxed text-secondary">
          <li>Decide a monthly amount before you start, and treat it as the cost of entertainment — not an investment plan.</li>
          <li>Only ever stake money you can afford to lose entirely.</li>
          <li>Never borrow to trade, and never try to win back a loss with a larger position.</li>
          <li>Keep prediction markets separate from money you need for rent, fees, EMIs or family expenses.</li>
        </ul>
        <p className="mt-3 rounded-btn bg-surface-3 p-3 text-12 text-secondary">
          Planned: configurable daily, weekly and monthly deposit caps set by you, with a
          cooling-off delay before any increase takes effect.
        </p>
      </section>

      <section className="rounded-card border border-subtle bg-surface-2 p-4 sm:p-6">
        <h2 className="text-16 font-bold text-primary">Taking a break</h2>
        <ul className="mt-1.5 flex list-disc flex-col gap-1.5 pl-5 text-13 leading-relaxed text-secondary">
          <li>Take a break if you are chasing losses, hiding your activity, or trading to escape stress.</li>
          <li>Step away if you are trading for longer than you intended, or losing sleep over open positions.</li>
          <li>Planned: self-imposed time-outs (24 hours to 30 days) and longer self-exclusion, both irreversible for their duration.</li>
        </ul>
      </section>

      <section className="rounded-card border border-danger/30 bg-danger/[0.06] p-4 sm:p-6">
        <h2 className="text-16 font-bold text-primary">Getting help in India</h2>
        <p className="mt-1.5 text-13 leading-relaxed text-secondary">
          If this stops feeling like a game, talk to someone. The contacts below are
          placeholders and{" "}
          <span className="font-semibold text-danger">must be verified</span> before
          launch — do not rely on them as printed.
        </p>
        <ul className="mt-3 flex flex-col gap-2 text-13 text-secondary">
          <li className="rounded-btn bg-surface-3 p-3">
            <span className="font-semibold text-primary">
              National mental health helpline
            </span>
            <br />
            Placeholder — number to be verified
          </li>
          <li className="rounded-btn bg-surface-3 p-3">
            <span className="font-semibold text-primary">
              Behavioural addiction support
            </span>
            <br />
            Placeholder — service and number to be verified
          </li>
          <li className="rounded-btn bg-surface-3 p-3">
            <span className="font-semibold text-primary">
              Financial counselling
            </span>
            <br />
            Placeholder — service to be identified
          </li>
        </ul>
      </section>

      <nav className="flex flex-wrap gap-x-5 gap-y-2 text-13 font-semibold text-brand">
        <Link href="/terms">Terms of Use</Link>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/grievance">Grievance redressal</Link>
      </nav>
    </div>
  );
}
