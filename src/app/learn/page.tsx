import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Predictions 101 — BharatPredict" };

const STEPS = [
  {
    title: "Markets are questions",
    body: "Every market asks a question with clearly defined outcomes and a single named resolution source — the BCCI scorecard, the Election Commission, an RBI statement. Prices are probabilities: 64% means the market thinks there is a 64% chance.",
  },
  {
    title: "Shares pay ₹1 if correct",
    body: "Buying Yes at 0.64 costs ₹0.64 per share and pays ₹1.00 if the market resolves Yes. Your profit is the difference between the price you paid and the final settlement.",
  },
  {
    title: "Deposits and payouts in ₹",
    body: "Balances are held in Indian rupees so you never convert currency to take a position. Every number you see on a market card is already in ₹.",
  },
  {
    title: "Resolution is published",
    body: "Each market lists the exact source used to settle it before you trade, so the outcome is verifiable and never decided at anyone's discretion.",
  },
];

export default function LearnPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-11 font-bold uppercase tracking-wide text-brand">
          Learn Hub
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
          Predictions 101
        </h1>
        <p className="text-14 leading-relaxed text-secondary">
          How prediction markets work, end to end — with Indian examples.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <section
            key={s.title}
            className="rounded-card border border-subtle bg-surface-2 p-4"
          >
            <span className="grid h-7 w-7 place-items-center rounded-btn bg-brand/15 text-13 font-bold text-brand">
              {i + 1}
            </span>
            <h2 className="mt-3 text-16 font-bold text-primary">{s.title}</h2>
            <p className="mt-1.5 text-13 leading-relaxed text-secondary">{s.body}</p>
          </section>
        ))}
      </div>

      <section
        id="mailing-list"
        className="rounded-card border border-subtle bg-surface-2 p-4 sm:p-6"
      >
        <h2 className="text-16 font-bold text-primary">Join the mailing list</h2>
        <p className="mt-1 text-13 text-secondary">
          New Indian markets, resolution notes and product updates.
        </p>
        <form className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            placeholder="you@example.com"
            className="h-11 flex-1 rounded-btn border border-subtle bg-surface-3 px-3 text-14 text-primary outline-none focus:border-brand"
          />
          <button
            type="submit"
            className="h-11 rounded-btn bg-brand-fill px-5 text-14 font-bold text-white transition-colors hover:bg-brand-fill-hover"
          >
            Subscribe
          </button>
        </form>
      </section>

      {/* Kept as anchors so older /learn#terms and /learn#privacy links resolve. */}
      <section id="terms" className="rounded-card border border-subtle bg-surface-2 p-4 sm:p-6">
        <h2 className="text-16 font-bold text-primary">Legal &amp; policies</h2>
        <p className="mt-1.5 text-13 leading-relaxed text-secondary">
          This is a demonstration interface with simulated market data. No real funds are
          custodied, no orders reach a live exchange, and nothing here is an offer to
          participate in real-money gaming or trading. You must be 18 or older to place an
          order.
        </p>
        <nav
          id="privacy"
          className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-13 font-semibold text-brand"
        >
          <Link href="/terms">Terms of Use (incl. 18+ eligibility)</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/responsible-play">Responsible play</Link>
          <Link href="/grievance">Grievance redressal</Link>
        </nav>
      </section>

      <Link
        href="/"
        className="text-13 font-semibold text-brand transition-opacity hover:opacity-80"
      >
        ← Back to markets
      </Link>
    </div>
  );
}
