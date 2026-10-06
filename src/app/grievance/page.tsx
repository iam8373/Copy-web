import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Grievance Redressal — BharatPredict",
  description:
    "How to raise a complaint and who handles it. Draft placeholder copy pending legal review.",
};

/** DRAFT — PENDING LEGAL REVIEW. Officer details are placeholders to be filled in. */
export default function GrievancePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="w-fit rounded-chip bg-warning/15 px-2 py-1 text-11 font-bold uppercase tracking-wide text-warning">
          Draft — pending legal review
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
          Grievance redressal
        </h1>
        <p className="text-14 leading-relaxed text-secondary">
          How to raise a complaint about the service, a market resolution, or your personal
          data.
        </p>
      </header>

      <section className="rounded-card border border-warning/30 bg-warning/[0.06] p-4 sm:p-6">
        <h2 className="text-18 font-bold text-primary">Grievance Officer</h2>
        <p className="mt-1.5 text-13 text-secondary">
          To be appointed. Every field below is a placeholder and must be filled in before
          launch.
        </p>
        <dl className="mt-3 flex flex-col gap-2 text-13">
          {[
            ["Name", "[To be filled in]"],
            ["Designation", "Grievance Officer"],
            ["Email", "[grievance@example.invalid — to be filled in]"],
            ["Postal address", "[Registered office address — to be filled in]"],
            ["Acknowledgement window", "[Target: within 48 hours — to be confirmed]"],
            ["Resolution window", "[Target: within 30 days — to be confirmed]"],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex flex-col gap-1 rounded-btn bg-surface-3 p-3 sm:flex-row sm:justify-between sm:gap-4"
            >
              <dt className="text-secondary">{k}</dt>
              <dd className="font-semibold text-primary">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-card border border-subtle bg-surface-2 p-4 sm:p-6">
        <h2 className="text-16 font-bold text-primary">What to include</h2>
        <ul className="mt-1.5 flex list-disc flex-col gap-1.5 pl-5 text-13 leading-relaxed text-secondary">
          <li>The account handle you signed in with.</li>
          <li>The market involved, and the time of the order or resolution.</li>
          <li>What you expected to happen, and what happened instead.</li>
          <li>Any screenshots or reference numbers.</li>
        </ul>
      </section>

      <section className="rounded-card border border-subtle bg-surface-2 p-4 sm:p-6">
        <h2 className="text-16 font-bold text-primary">Escalation</h2>
        <p className="mt-1.5 text-13 leading-relaxed text-secondary">
          Placeholder: if you are unsatisfied with the outcome, escalation routes — including
          to the Data Protection Board of India for data-protection complaints — are to be
          set out here once confirmed with counsel.
        </p>
      </section>

      <p className="rounded-card border border-subtle bg-surface-2 p-4 text-12 text-secondary">
        This application is a demonstration with simulated data. There is no live support
        desk behind these placeholders yet.
      </p>

      <nav className="flex flex-wrap gap-x-5 gap-y-2 text-13 font-semibold text-brand">
        <Link href="/terms">Terms of Use</Link>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/responsible-play">Responsible play</Link>
      </nav>
    </div>
  );
}
