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
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-blue">
          Learn Hub
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-content-primary sm:text-3xl">
          Predictions 101
        </h1>
        <p className="text-[14px] leading-relaxed text-content-secondary">
          How prediction markets work, end to end — with Indian examples.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <section
            key={s.title}
            className="rounded-xl border border-subtle bg-bg-secondary p-4"
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-blue/15 text-[13px] font-bold text-accent-blue">
              {i + 1}
            </span>
            <h2 className="mt-3 text-[15px] font-bold text-content-primary">{s.title}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-content-secondary">{s.body}</p>
          </section>
        ))}
      </div>

      <section
        id="mailing-list"
        className="rounded-xl border border-subtle bg-bg-secondary p-4 sm:p-6"
      >
        <h2 className="text-[15px] font-bold text-content-primary">Join the mailing list</h2>
        <p className="mt-1 text-[13px] text-content-secondary">
          New Indian markets, resolution notes and product updates.
        </p>
        <form className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            placeholder="you@example.com"
            className="h-11 flex-1 rounded-lg border border-subtle bg-bg-tertiary px-3 text-[14px] text-content-primary outline-none focus:border-accent-blue"
          />
          <button
            type="submit"
            className="h-11 rounded-lg bg-accent-blue px-5 text-[14px] font-bold text-white transition-colors hover:bg-accent-strong"
          >
            Subscribe
          </button>
        </form>
      </section>

      {/* Kept as anchors so older /learn#terms and /learn#privacy links resolve. */}
      <section id="terms" className="rounded-xl border border-subtle bg-bg-secondary p-4 sm:p-6">
        <h2 className="text-[15px] font-bold text-content-primary">Legal &amp; policies</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-content-secondary">
          This is a demonstration interface with simulated market data. No real funds are
          custodied, no orders reach a live exchange, and nothing here is an offer to
          participate in real-money gaming or trading. You must be 18 or older to place an
          order.
        </p>
        <nav
          id="privacy"
          className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-semibold text-accent-blue"
        >
          <Link href="/terms">Terms of Use (incl. 18+ eligibility)</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/responsible-play">Responsible play</Link>
          <Link href="/grievance">Grievance redressal</Link>
        </nav>
      </section>

      <Link
        href="/"
        className="text-[13px] font-semibold text-accent-blue transition-opacity hover:opacity-80"
      >
        ← Back to markets
      </Link>
    </div>
  );
}
