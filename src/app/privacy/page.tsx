import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — BharatPredict",
  description:
    "How BharatPredict handles personal data, drafted against DPDP Act 2023 principles. Draft placeholder copy pending legal review.",
};

/** DRAFT — PENDING LEGAL REVIEW. Placeholder copy written by a non-lawyer. */
export default function PrivacyPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="w-fit rounded-chip bg-warning/15 px-2 py-1 text-11 font-bold uppercase tracking-wide text-warning">
          Draft — pending legal review
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
          Privacy Policy
        </h1>
        <p className="text-14 leading-relaxed text-secondary">
          Drafted against the principles of India&apos;s Digital Personal Data Protection
          Act, 2023. Placeholder text — not yet reviewed by counsel.
        </p>
      </header>

      <section className="rounded-card border border-success/30 bg-success/[0.06] p-4 sm:p-6">
        <h2 className="text-18 font-bold text-primary">
          What BharatPredict stores today
        </h2>
        <p className="mt-2 text-13 leading-relaxed text-secondary">
          When you sign in we store, in our database (hosted by Supabase):{" "}
          <span className="font-semibold text-primary">
            your email address and sign-in method, your profile (display handle, language,
            the time you confirmed you are 18+, the terms version), your play-credit ledger,
            orders and positions, and any grievance you send us
          </span>
          . Staff actions are recorded in an audit log. Your browser keeps your theme and
          language (local storage and a <code>bp-lang</code> cookie) and the sign-in session
          cookie. We do not run identity checks and do not collect your phone number or date
          of birth. Retention periods and the data-hosting region are to be stated here
          after legal review.
        </p>
      </section>

      {[
        {
          h: "Notice",
          p: "Where real data collection begins, you will be told — in clear language and before collection — what is collected, why, and for how long it is retained.",
        },
        {
          h: "Purpose limitation",
          p: "Personal data would be processed only for the purposes stated at the point of collection: authenticating you, meeting the 18+ eligibility requirement, settling positions, and satisfying legal obligations.",
        },
        {
          h: "Consent and withdrawal",
          p: "Processing would rest on your consent, which must be as easy to withdraw as it was to give. Withdrawal stops further processing and triggers deletion, except where retention is legally required.",
        },
        {
          h: "Data minimisation",
          p: "Sign-in uses only your email address or your Google account. We do not run identity (KYC) checks and do not collect your phone number or date of birth; the 18+ requirement is a self-declaration. Only the minimum needed to operate an account would be collected.",
        },
        {
          h: "Your rights",
          p: "Access, correction, erasure, and grievance redressal. Placeholder request routes and response windows are to be confirmed with counsel — see the grievance page.",
        },
        {
          h: "Security and breach notification",
          p: "Placeholder commitments on encryption in transit and at rest, access controls, and notification to you and the Data Protection Board in the event of a breach. Specific measures and timelines to be finalised.",
        },
        {
          h: "Children",
          p: "The service is not directed at anyone under 18. Placeholder clause on verifiable parental consent requirements, to be confirmed against DPDP rules as notified.",
        },
      ].map((s) => (
        <section
          key={s.h}
          className="rounded-card border border-subtle bg-surface-2 p-4 sm:p-6"
        >
          <h2 className="text-16 font-bold text-primary">{s.h}</h2>
          <p className="mt-1.5 text-13 leading-relaxed text-secondary">{s.p}</p>
        </section>
      ))}

      <nav className="flex flex-wrap gap-x-5 gap-y-2 text-13 font-semibold text-brand">
        <Link href="/terms">Terms of Use</Link>
        <Link href="/responsible-play">Responsible play</Link>
        <Link href="/grievance">Grievance redressal</Link>
      </nav>
    </div>
  );
}
