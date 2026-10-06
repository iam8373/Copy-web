import { planWork, readTranslations, writeTranslations, type WorkItem } from "./store";
import { isTransient, PROVIDER_ENV, resolveProvider, translateMarket, TranslationRequestError } from "./translate";
import { validateLocales, type FieldProblem } from "./validate";
import type { MarketSource, TranslationEntry, TranslationFile } from "./types";

/**
 * Core of `npm run translate:markets`, kept separate from the CLI so tests can
 * drive it with a fake fetch. Nothing here runs during `next build`, tests of
 * the app, or page views: only the script imports it.
 */

export const DEFAULT_MAX_MARKETS = 25;
const MAX_ATTEMPTS = 2; // the first try plus one retry

export interface RunOptions {
  markets: MarketSource[];
  filePath: string;
  env: Record<string, string | undefined>;
  dryRun?: boolean;
  marketId?: string;
  maxMarkets?: number;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  log?: (line: string) => void;
  /** Pause before retrying after a 429/5xx. Injectable so tests don't wait. */
  sleep?: (ms: number) => Promise<void>;
}

/** Backoff before the retry when the provider was rate-limited or overloaded. */
export const TRANSIENT_BACKOFF_MS = 5_000;

export interface RunResult {
  exitCode: 0 | 1;
  apiCalls: number;
  planned: string[];
  translated: string[];
  failed: Array<{ id: string; problems: string[] }>;
  deferred: string[];
  /** Which provider was used, when any request was made. */
  provider?: "openai" | "gemini";
  error?: string;
}

function describe(p: FieldProblem) {
  return `${p.locale}.${p.field}: ${p.problem}`;
}

export async function runTranslateMarkets(opts: RunOptions): Promise<RunResult> {
  const log = opts.log ?? ((l: string) => console.log(l));
  const maxMarkets = opts.maxMarkets ?? DEFAULT_MAX_MARKETS;
  const result: RunResult = { exitCode: 0, apiCalls: 0, planned: [], translated: [], failed: [], deferred: [] };

  const fail = (error: string): RunResult => {
    log(`error: ${error}`);
    return { ...result, exitCode: 1, error };
  };

  if (!Number.isInteger(maxMarkets) || maxMarkets < 1) {
    return fail(`--max-markets must be a positive integer (got ${String(opts.maxMarkets)})`);
  }

  let scope = opts.markets;
  if (opts.marketId) {
    scope = opts.markets.filter((m) => m.id === opts.marketId);
    if (scope.length === 0) return fail(`no market with id "${opts.marketId}"`);
  }

  const file: TranslationFile = readTranslations(opts.filePath);
  const work = planWork(scope, file);

  // Cost guard: never translate more than maxMarkets in one run.
  const batch: WorkItem[] = work.slice(0, maxMarkets);
  result.deferred = work.slice(maxMarkets).map((w) => w.market.id);
  result.planned = batch.map((w) => w.market.id);

  if (work.length === 0) {
    log("All market translations are up to date. 0 API calls.");
    return result;
  }

  for (const w of batch) log(`${opts.dryRun ? "would translate" : "translate"} ${w.market.id} (${w.reason})`);
  if (result.deferred.length) {
    log(`${result.deferred.length} more need translation but exceed --max-markets ${maxMarkets}; run again to continue.`);
  }

  if (opts.dryRun) {
    log(`Dry run: ${batch.length} market(s) would be translated. 0 API calls.`);
    return result;
  }

  // Only now, when there is real work, is a provider (key + model) required.
  const resolved = resolveProvider(opts.env);
  if (!resolved.ok) return fail(resolved.error);
  const { provider, apiKey, model } = resolved;
  result.provider = provider;
  log(`Using ${PROVIDER_ENV[provider].label} (${model}).`);

  const now = opts.now ?? (() => new Date());
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let changed = false;

  for (const w of batch) {
    let problems: string[] = [];
    let accepted: TranslationEntry["locales"] | null = null;

    let transient = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !accepted; attempt++) {
      if (attempt > 1 && transient) await sleep(TRANSIENT_BACKOFF_MS);
      transient = false;
      result.apiCalls++;
      try {
        const out = await translateMarket(w.market, { provider, apiKey, model, fetchImpl: opts.fetchImpl });
        const found = validateLocales(w.market, out);
        if (found.length === 0) accepted = out as TranslationEntry["locales"];
        else problems = found.map(describe);
      } catch (err) {
        transient = isTransient(err);
        problems = [
          err instanceof TranslationRequestError
            ? err.message
            : err instanceof Error && err.name === "TimeoutError"
              ? "request timed out"
              : "unexpected error during request",
        ];
      }
      if (!accepted && attempt < MAX_ATTEMPTS) log(`  ${w.market.id}: attempt ${attempt} rejected, retrying once`);
    }

    if (accepted) {
      file[w.market.id] = {
        sourceHash: w.hash,
        translatedAt: now().toISOString(),
        status: "machine-drafted",
        locales: accepted,
      };
      result.translated.push(w.market.id);
      changed = true;
      log(`  ${w.market.id}: saved`);
    } else {
      // Leave the market in English. A stale entry is removed so the file
      // never holds text that no longer matches its source.
      if (file[w.market.id]) {
        delete file[w.market.id];
        changed = true;
      }
      result.failed.push({ id: w.market.id, problems });
      log(`  ${w.market.id}: FAILED after ${MAX_ATTEMPTS} attempts, left in English`);
      for (const p of problems.slice(0, 6)) log(`    - ${p}`);
    }
  }

  if (changed) writeTranslations(opts.filePath, file);
  log(
    `Done: ${result.translated.length} translated, ${result.failed.length} failed, ${result.apiCalls} API call(s).`
  );
  return result;
}
