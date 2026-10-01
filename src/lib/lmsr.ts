/**
 * Logarithmic Market Scoring Rule (Hanson). Pure functions, no I/O.
 *
 *   cost C(q) = b * ln( sum_i exp(q_i / b) )
 *   price_i   = exp(q_i / b) / sum_j exp(q_j / b)        (prices sum to 1)
 *
 * q_i is the number of outstanding shares of outcome i ("shares_outstanding"),
 * b is the market's liquidity parameter. Each winning share pays 1 credit.
 *
 * The authoritative engine runs in Postgres (place_order, Phase 4); this file
 * is the reference used by the seed script and by tests that check the SQL.
 */

/** Numerically stable log-sum-exp of q/b. */
function logSumExp(q: readonly number[], b: number): number {
  const xs = q.map((v) => v / b);
  const m = Math.max(...xs);
  return m + Math.log(xs.reduce((s, x) => s + Math.exp(x - m), 0));
}

export function cost(q: readonly number[], b: number): number {
  return b * logSumExp(q, b);
}

export function prices(q: readonly number[], b: number): number[] {
  const lse = logSumExp(q, b);
  return q.map((v) => Math.exp(v / b - lse));
}

/**
 * Quantities that reproduce the given prices. Prices are normalised to sum to
 * 1 first (seed data for multi-outcome markets does not always), and shifted
 * so the smallest quantity is 0.
 */
export function quantitiesForPrices(p: readonly number[], b: number): { q: number[]; normalized: number[] } {
  if (p.length < 2) throw new Error("a market needs at least two outcomes");
  if (p.some((x) => !(x > 0))) throw new Error("every initial price must be > 0");
  const total = p.reduce((s, x) => s + x, 0);
  const normalized = p.map((x) => x / total);
  const raw = normalized.map((x) => b * Math.log(x));
  const min = Math.min(...raw);
  return { q: raw.map((x) => x - min), normalized };
}

/** Cost of buying `shares` of outcome `i`. */
export function costToBuy(q: readonly number[], b: number, i: number, shares: number): number {
  const next = q.slice();
  next[i] += shares;
  return cost(next, b) - cost(q, b);
}

/**
 * Shares received for spending `amount` on outcome `i`. Closed form:
 *
 *   shares = b * ln( (S·e^{A} − S + e_i) / e_i ),   A = amount / b,
 *   S = Σ_j e^{q_j/b},  e_i = e^{q_i/b}
 *
 * evaluated in log space as
 *
 *   shares = b * ( A + ln S − ln e_i + log1p( (e_i/S − 1) · e^{−A} ) )
 *
 * so large orders (A ≫ 1) never overflow. A naive e^{A} overflows once
 * amount/b > ~709.
 */
export function sharesForAmount(q: readonly number[], b: number, i: number, amount: number): number {
  if (!(amount > 0)) return 0;
  const xs = q.map((v) => v / b);
  const m = Math.max(...xs);
  const lnS = m + Math.log(xs.reduce((s, x) => s + Math.exp(x - m), 0));
  const lnEi = xs[i];
  const A = amount / b;
  const ratio = Math.exp(lnEi - lnS); // e_i / S, in (0, 1]
  return b * (A + lnS - lnEi + Math.log1p((ratio - 1) * Math.exp(-A)));
}
