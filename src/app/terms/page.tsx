import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use — BharatPredict",
  description:
    "Terms of Use for BharatPredict, including eligibility and availability. Draft placeholder copy pending legal review.",
};

/**
 * DRAFT — PENDING LEGAL REVIEW.
 *
 * Every clause below is placeholder copy written by a non-lawyer. It makes no
 * claim that prediction markets are lawful in India or in any Indian state, and
 * the availability clause is deliberately open pending advice from qualified
 * Indian counsel. Do not ship without that review.
 */
export default function TermsPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="w-fit rounded-chip bg-warning/15 px-2 py-1 text-11 font-bold uppercase tracking-wide text-warning">
          Draft — pending legal review
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
          Terms of Use
        </h1>
        <p className="text-14 leading-relaxed text-secondary">
          Placeholder terms for a demonstration product. Nothing here is legal advice or a
          binding agreement.
        </p>
      </header>

      <section
        id="eligibility"
        className="rounded-card border border-warning/30 bg-warning/[0.06] p-4 sm:p-6"
      >
        <h2 className="text-18 font-bold text-primary">Eligibility (18+)</h2>
        <div className="mt-2 flex flex-col gap-3 text-13 leading-relaxed text-secondary">
          <p>
            <span className="font-semibold text-primary">
              You must be at least 18 years old to create an account or place any order.
            </span>{" "}
            By signing in you self-declare that you meet this age requirement. We do not
            collect your date of birth; the confirmation is a self-declaration recorded at
            the time you sign in.
          </p>
          <p>
            Accounts we believe to be operated by a person under 18 may be suspended and
            any simulated balances voided.
          </p>
          <p>
            <span className="font-semibold text-primary">Availability:</span>{" "}
            access to this service may be restricted in some Indian states. The definitive
            list of restricted states, and the mechanism used to enforce it, is to be
            finalised by qualified Indian counsel before any launch. This draft makes no
            representation that participation is lawful in your state.
          </p>
        </div>
      </section>

      <section className="rounded-card border border-subtle bg-surface-2 p-4 sm:p-6">
        <h2 className="text-16 font-bold text-primary">Demonstration only</h2>
        <p className="mt-1.5 text-13 leading-relaxed text-secondary">
          All markets, prices, balances and positions in this application are simulated. No
          real money is accepted, held or paid out, no order reaches an exchange, and
          nothing here is an offer to participate in real-money gaming or trading.
        </p>
      </section>

      <section className="rounded-card border border-subtle bg-surface-2 p-4 sm:p-6">
        <h2 className="text-16 font-bold text-primary">Acceptable use</h2>
        <ul className="mt-1.5 flex list-disc flex-col gap-1.5 pl-5 text-13 leading-relaxed text-secondary">
          <li>One account per person; do not share or transfer your account.</li>
          <li>Do not attempt to manipulate prices or resolution outcomes.</li>
          <li>Do not use automated tooling to place orders at scale.</li>
          <li>Do not use the service where doing so would breach local law.</li>
        </ul>
      </section>

      <section className="rounded-card border border-subtle bg-surface-2 p-4 sm:p-6">
        <h2 className="text-16 font-bold text-primary">
          Market resolution and disputes
        </h2>
        <p className="mt-1.5 text-13 leading-relaxed text-secondary">
          Each market names its resolution source before you trade. Where a source is
          unavailable, delayed or ambiguous, resolution may be postponed. Placeholder
          dispute-handling and escalation terms are to be drafted with counsel; raise
          concerns through the{" "}
          <Link href="/grievance" className="font-semibold text-brand">
            grievance channel
          </Link>
          .
        </p>
      </section>

      <section className="rounded-card border border-subtle bg-surface-2 p-4 sm:p-6">
        <h2 className="text-16 font-bold text-primary">Changes to these terms</h2>
        <p className="mt-1.5 text-13 leading-relaxed text-secondary">
          These terms may change. Material changes will be surfaced in the product before
          they take effect. Continued use after a change indicates acceptance.
        </p>
      </section>

      <nav className="flex flex-wrap gap-x-5 gap-y-2 text-13 font-semibold text-brand">
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/responsible-play">Responsible play</Link>
        <Link href="/grievance">Grievance redressal</Link>
        <Link href="/learn">Predictions 101</Link>
      </nav>
    </div>
  );
}
