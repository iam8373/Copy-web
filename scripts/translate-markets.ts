/**
 * npm run translate:markets [-- --dry-run] [--market <id>] [--max-markets N]
 *
 * Translates market titles/descriptions ONCE and saves them to
 * src/data/market-translations.json. Only markets that are missing or whose
 * source text changed are sent; if nothing changed, it makes 0 API calls.
 *
 * Reads OPENAI_API_KEY and OPENAI_MODEL from .env.local (or the environment).
 * The key is never printed.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MARKETS } from "../src/data/markets";
import { DEFAULT_TRANSLATIONS_PATH } from "../src/services/translation/store";
import { DEFAULT_MAX_MARKETS, runTranslateMarkets } from "../src/services/translation/run";

/** Minimal .env parser: KEY=VALUE, # comments, optional quotes. No dependency. */
function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

function parseArgs(argv: string[]) {
  const args = { dryRun: false, marketId: undefined as string | undefined, maxMarkets: DEFAULT_MAX_MARKETS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--market") args.marketId = argv[++i];
    else if (a === "--max-markets") args.maxMarkets = Number(argv[++i]);
    else if (a === "--help" || a === "-h") {
      console.log("Usage: npm run translate:markets -- [--dry-run] [--market <id>] [--max-markets N]");
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(1);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // Real environment variables win over .env.local.
  const env = { ...loadEnvFile(resolve(".env.local")), ...process.env };

  const result = await runTranslateMarkets({
    markets: MARKETS,
    filePath: resolve(DEFAULT_TRANSLATIONS_PATH),
    env,
    dryRun: args.dryRun,
    marketId: args.marketId,
    maxMarkets: args.maxMarkets,
  });

  if (result.failed.length) {
    console.log(`\nFailed (left in English): ${result.failed.map((f) => f.id).join(", ")}`);
  }
  process.exit(result.exitCode);
}

main().catch(() => {
  // Deliberately generic: never risk echoing request headers.
  console.error("error: translate:markets crashed unexpectedly");
  process.exit(1);
});
