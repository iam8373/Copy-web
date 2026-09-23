import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Predictions 101 — Predict" };

const STEPS = [
  {
    title: "Markets are questions",
    body: "Every market asks a question with clearly defined outcomes and a single resolution source. Prices are probabilities: 64% means the market thinks there is a 64% chance.",
  },
  {
    title: "Shares pay $1 if correct",
    body: "Buying Yes at 0.64 costs $0.64 per share and pays $1.00 if the market resolves Yes. Your profit is the difference between the price you paid and the final settlement.",
  },
  {
    title: "Collateral earns yield",
    body: "USDC collateral is minted into conditional tokens. Idle collateral is supplied to Venus Protocol on BNB Chain so it accrues yield while the market is open.",
  },
  {
    title: "Chainlink resolves it",
    body: "Resolution uses Chainlink CRE and DataLink feeds so prices and outcomes are delivered on-chain without a trusted intermediary.",
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
          How a conditional-token prediction market works, end to end.
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
          New markets, resolution notes and product updates.
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
            className="h-11 rounded-lg bg-accent-blue px-5 text-[14px] font-bold text-white transition-colors hover:bg-blue-600"
          >
            Subscribe
          </button>
        </form>
      </section>

      <section id="terms" className="rounded-xl border border-subtle bg-bg-secondary p-4 sm:p-6">
        <h2 className="text-[15px] font-bold text-content-primary">Terms</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-content-secondary">
          This is a demonstration interface with simulated market data. No real funds are
          custodied and no orders reach a live exchange.
        </p>
      </section>

      <section id="privacy" className="rounded-xl border border-subtle bg-bg-secondary p-4 sm:p-6">
        <h2 className="text-[15px] font-bold text-content-primary">Privacy</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-content-secondary">
          Only a theme preference is stored locally in your browser. Nothing else is collected.
        </p>
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
