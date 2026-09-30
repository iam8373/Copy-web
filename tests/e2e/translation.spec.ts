import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256Hex } from "../../src/lib/sha256";
import { getMarketText } from "../../src/lib/market-text";
import { MARKETS } from "../../src/data/markets";
import translations from "../../src/data/market-translations.json";
import hi from "../../src/i18n/hi";
import { STORAGE_KEY } from "../../src/i18n";
import { sourceHashFor } from "../../src/services/translation/hash";
import { validateEntry, validateLocales } from "../../src/services/translation/validate";
import { termsFor } from "../../src/services/translation/glossary";
import { runTranslateMarkets } from "../../src/services/translation/run";
import { OPENAI_URL } from "../../src/services/translation/translate";
import {
  TARGET_LOCALES,
  type MarketSource,
  type TranslationFile,
} from "../../src/services/translation/types";
import { resetState } from "./helpers";

// A fake credential that is deliberately NOT key-shaped (no "sk-" prefix), so
// the repository secret scan never trips on this test file.
const FAKE_KEY = "test-credential-not-a-real-key";
const ENV = { OPENAI_API_KEY: FAKE_KEY, OPENAI_MODEL: "test-model" };

// ------------------------------------------------------------------ helpers
const TICKER = /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*\b/g;
const NUM = /\d(?:[\d,]*\d)?(?:\.\d+)?%?/g;

/** Builds output that satisfies the validator for any source text. */
function validFor(source: string, locale: (typeof TARGET_LOCALES)[number]) {
  const tickers = (source.match(TICKER) ?? []).filter((t) => t.length >= 2 && /[A-Z]/.test(t));
  const noTickers = source.replace(TICKER, (t) => (t.length >= 2 && /[A-Z]/.test(t) ? " " : t));
  const nums = noTickers.match(NUM) ?? [];
  const rupees = source.match(/₹\s?\d(?:[\d,]*\d)?/g) ?? [];
  const terms = termsFor(locale)
    .filter((t) =>
      new RegExp(`\\b${t.english}\\b`, t.caseSensitive ? "" : "i").test(source)
    )
    .map((t) => t.rendering);
  return ["अनुवाद", ...tickers, ...rupees, ...nums.filter((n) => !rupees.some((r) => r.includes(n))), ...terms]
    .join(" ")
    .trim();
}

function goodLocales(m: MarketSource) {
  return Object.fromEntries(
    TARGET_LOCALES.map((l) => [l, { title: validFor(m.title, l), description: validFor(m.description, l) }])
  );
}

type Reply = "good" | "bad-shape" | "http-500";

/** Fake OpenAI endpoint. Records every call; never touches the network. */
function fakeOpenAI(plan: (m: MarketSource, attempt: number) => Reply = () => "good") {
  const calls: Array<{ url: string; auth: string; body: Record<string, unknown> }> = [];
  const attempts = new Map<string, number>();
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({
      url,
      auth: String((init.headers as Record<string, string>).authorization),
      body,
    });
    const src = JSON.parse(body.messages[1].content) as { title: string; description: string };
    const m = { id: "", subcategory: "", title: src.title, description: src.description };
    const n = (attempts.get(src.title) ?? 0) + 1;
    attempts.set(src.title, n);
    const reply = plan(m, n);
    if (reply === "http-500") return new Response("{}", { status: 500 });
    const content = reply === "bad-shape" ? JSON.stringify({ hi: { title: "x" } }) : JSON.stringify(goodLocales(m));
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

function tempFile(initial: TranslationFile = {}) {
  const dir = mkdtempSync(join(tmpdir(), "bp-tr-"));
  const path = join(dir, "market-translations.json");
  writeFileSync(path, JSON.stringify(initial));
  return path;
}

const read = (p: string) => JSON.parse(readFileSync(p, "utf8")) as TranslationFile;

const SAMPLE: MarketSource[] = [
  { id: "t1", subcategory: "T20", title: "Will India win the 2027 T20 final?", description: "Resolves Yes if India win the T20 final in 2027." },
  { id: "t2", subcategory: "Gold", title: "Gold above ₹1,50,000 in 2027?", description: "Resolves Yes if MCX gold closes above ₹1,50,000 per 10 grams in 2027." },
  { id: "t3", subcategory: "IPL", title: "IPL 2027 Winner", description: "Resolves to the franchise that wins the IPL 2027 final." },
];

const quiet = () => {
  const lines: string[] = [];
  return { log: (l: string) => lines.push(l), lines };
};

// ------------------------------------------------------------------- hashing
test.describe("hashing", () => {
  test("sync sha256 matches node crypto", () => {
    for (const s of ["", "abc", "a".repeat(55), "a".repeat(64), "a".repeat(999), "क्या ₹1,20,000 தமிழ் తెలుగు"]) {
      expect(sha256Hex(s)).toBe(createHash("sha256").update(s, "utf8").digest("hex"));
    }
  });

  test("hash covers title, description and subcategory", () => {
    const base = SAMPLE[0];
    const h = sourceHashFor(base);
    expect(sourceHashFor({ ...base, title: base.title + "!" })).not.toBe(h);
    expect(sourceHashFor({ ...base, description: base.description + "!" })).not.toBe(h);
    expect(sourceHashFor({ ...base, subcategory: "ODI" })).not.toBe(h);
  });
});

// ---------------------------------------------------------------- validation
test.describe("validate.ts", () => {
  const src = SAMPLE[1]; // has ₹, numbers, a ticker and protected terms
  const good = () => goodLocales(src) as Record<string, { title: string; description: string }>;

  test("accepts well-formed output", () => {
    expect(validateLocales(src, good())).toEqual([]);
  });

  const reject = (mutate: (o: ReturnType<typeof good>) => void) => {
    const o = good();
    mutate(o);
    return validateLocales(src, o).map((p) => p.problem).join(" | ");
  };

  test("rejects a missing or altered number", () => {
    expect(reject((o) => (o.hi.description = o.hi.description.replace("2027", "2028")))).toMatch(/number/);
  });
  test("rejects an altered ₹ amount", () => {
    expect(reject((o) => (o.ta.title = o.ta.title.replace("₹1,50,000", "₹1,50,001")))).toMatch(/amount|number/);
  });
  test("rejects a missing ticker", () => {
    expect(reject((o) => (o.bn.description = o.bn.description.replace("MCX", "")))).toMatch(/ticker "MCX"/);
  });
  test("rejects empty text", () => {
    expect(reject((o) => (o.mr.title = "  "))).toMatch(/empty/);
  });
  test("rejects output over 2x the source length", () => {
    expect(reject((o) => (o.te.title = o.te.title + " अ".repeat(60)))).toMatch(/2x/);
  });
  test("rejects unchanged English", () => {
    expect(reject((o) => (o.hi.description = src.description))).toMatch(/identical|untranslated/);
  });
  test("rejects a protected term rendered differently", () => {
    expect(reject((o) => (o.hi.description = o.hi.description.replace("हाँ", "हां जी")))).toMatch(/protected term "Yes"/);
  });
  test("rejects the wrong JSON shape", () => {
    expect(reject((o) => delete (o as Record<string, unknown>).te)).toMatch(/missing/);
    expect(reject((o) => ((o as Record<string, unknown>).fr = { title: "x", description: "y" }))).toMatch(/unexpected locale/);
    expect(reject((o) => ((o.hi as Record<string, unknown>).extra = "x"))).toMatch(/exactly \{title, description\}/);
    expect(validateLocales(src, "not an object").length).toBeGreaterThan(0);
  });

  test("every committed entry is fresh and valid", () => {
    const file = translations as TranslationFile;
    expect(Object.keys(file).length).toBeGreaterThan(0);
    for (const [id, entry] of Object.entries(file)) {
      const m = MARKETS.find((x) => x.id === id);
      expect(m, `${id} is not a market`).toBeTruthy();
      expect(validateEntry(m!, entry, sourceHashFor(m!)), id).toEqual([]);
    }
  });
});

// -------------------------------------------------------------- the script
test.describe("translate:markets runner", () => {
  test("one request per market, all five locales, strict JSON schema", async () => {
    const { fetchImpl, calls } = fakeOpenAI();
    const path = tempFile();
    const r = await runTranslateMarkets({ markets: SAMPLE, filePath: path, env: ENV, fetchImpl, ...quiet() });

    expect(r.exitCode).toBe(0);
    expect(calls).toHaveLength(SAMPLE.length);
    for (const c of calls) {
      expect(c.url).toBe(OPENAI_URL);
      expect(c.auth).toBe(`Bearer ${FAKE_KEY}`);
      expect(c.body.model).toBe("test-model");
      const rf = c.body.response_format as { type: string; json_schema: { strict: boolean; schema: { required: string[] } } };
      expect(rf.type).toBe("json_schema");
      expect(rf.json_schema.strict).toBe(true);
      expect(rf.json_schema.schema.required).toEqual([...TARGET_LOCALES]);
    }
    const file = read(path);
    expect(Object.keys(file).sort()).toEqual(["t1", "t2", "t3"]);
    expect(file.t1.status).toBe("machine-drafted");
    expect(file.t1.sourceHash).toBe(sourceHashFor(SAMPLE[0]));
  });

  test("running twice makes 0 API calls the second time", async () => {
    const path = tempFile();
    await runTranslateMarkets({ markets: SAMPLE, filePath: path, env: ENV, fetchImpl: fakeOpenAI().fetchImpl, ...quiet() });
    const before = readFileSync(path, "utf8");

    const second = fakeOpenAI();
    const r = await runTranslateMarkets({ markets: SAMPLE, filePath: path, env: ENV, fetchImpl: second.fetchImpl, ...quiet() });
    expect(r.apiCalls).toBe(0);
    expect(second.calls).toHaveLength(0);
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  test("changing one title re-translates only that market", async () => {
    const path = tempFile();
    await runTranslateMarkets({ markets: SAMPLE, filePath: path, env: ENV, fetchImpl: fakeOpenAI().fetchImpl, ...quiet() });
    const before = read(path);

    const edited = SAMPLE.map((m) => (m.id === "t2" ? { ...m, title: "Gold above ₹1,60,000 in 2027?" } : m));
    const { fetchImpl, calls } = fakeOpenAI();
    const r = await runTranslateMarkets({ markets: edited, filePath: path, env: ENV, fetchImpl, ...quiet() });

    expect(calls).toHaveLength(1);
    expect(r.translated).toEqual(["t2"]);
    const after = read(path);
    expect(after.t1).toEqual(before.t1);
    expect(after.t3).toEqual(before.t3);
    expect(after.t2.sourceHash).toBe(sourceHashFor(edited[1]));
  });

  test("a reviewed entry is never overwritten unless its source changed", async () => {
    const path = tempFile();
    await runTranslateMarkets({ markets: SAMPLE, filePath: path, env: ENV, fetchImpl: fakeOpenAI().fetchImpl, ...quiet() });
    const file = read(path);
    file.t1.status = "reviewed";
    file.t1.locales.hi.title = "समीक्षित शीर्षक T20 2027";
    writeFileSync(path, JSON.stringify(file));

    const untouched = fakeOpenAI();
    await runTranslateMarkets({ markets: SAMPLE, filePath: path, env: ENV, fetchImpl: untouched.fetchImpl, ...quiet() });
    expect(untouched.calls).toHaveLength(0);
    expect(read(path).t1.status).toBe("reviewed");
    expect(read(path).t1.locales.hi.title).toBe("समीक्षित शीर्षक T20 2027");

    const changed = SAMPLE.map((m) => (m.id === "t1" ? { ...m, description: m.description + " Tie resolves No." } : m));
    const redo = fakeOpenAI();
    await runTranslateMarkets({ markets: changed, filePath: path, env: ENV, fetchImpl: redo.fetchImpl, ...quiet() });
    expect(redo.calls).toHaveLength(1);
    expect(read(path).t1.status).toBe("machine-drafted");
  });

  test("a failed market is retried once, then left in English and reported", async () => {
    const path = tempFile();
    // t1: bad then good (recovers on retry). t2: bad twice (fails). t3: HTTP 500 twice.
    const { fetchImpl, calls } = fakeOpenAI((m, attempt) => {
      if (m.title.startsWith("Will India")) return attempt === 1 ? "bad-shape" : "good";
      if (m.title.startsWith("Gold")) return "bad-shape";
      return "http-500";
    });
    const out = quiet();
    const r = await runTranslateMarkets({ markets: SAMPLE, filePath: path, env: ENV, fetchImpl, ...out });

    expect(calls).toHaveLength(2 + 2 + 2); // never more than 2 attempts per market
    expect(r.translated).toEqual(["t1"]);
    expect(r.failed.map((f) => f.id)).toEqual(["t2", "t3"]);
    expect(Object.keys(read(path))).toEqual(["t1"]);
    expect(out.lines.join("\n")).toMatch(/t2: FAILED after 2 attempts, left in English/);
  });

  test("a stale entry that fails to re-translate is removed, not kept", async () => {
    const path = tempFile();
    await runTranslateMarkets({ markets: SAMPLE, filePath: path, env: ENV, fetchImpl: fakeOpenAI().fetchImpl, ...quiet() });
    const edited = SAMPLE.map((m) => (m.id === "t3" ? { ...m, title: "IPL 2028 Winner" } : m));
    const { fetchImpl } = fakeOpenAI(() => "bad-shape");
    await runTranslateMarkets({ markets: edited, filePath: path, env: ENV, fetchImpl, ...quiet() });
    expect(read(path).t3).toBeUndefined();
  });

  test("missing key or model gives a clear error and makes no calls", async () => {
    for (const env of [{ OPENAI_MODEL: "m" }, { OPENAI_API_KEY: FAKE_KEY }, {}]) {
      const { fetchImpl, calls } = fakeOpenAI();
      const out = quiet();
      const r = await runTranslateMarkets({ markets: SAMPLE, filePath: tempFile(), env, fetchImpl, ...out });
      expect(r.exitCode).toBe(1);
      expect(calls).toHaveLength(0);
      expect(out.lines.join("\n")).toMatch(/OPENAI_(API_KEY|MODEL) is not set/);
    }
  });

  test("nothing to do needs no key at all", async () => {
    const path = tempFile();
    await runTranslateMarkets({ markets: SAMPLE, filePath: path, env: ENV, fetchImpl: fakeOpenAI().fetchImpl, ...quiet() });
    const r = await runTranslateMarkets({ markets: SAMPLE, filePath: path, env: {}, ...quiet() });
    expect(r.exitCode).toBe(0);
    expect(r.apiCalls).toBe(0);
  });

  test("--dry-run lists work and makes no calls", async () => {
    const { fetchImpl, calls } = fakeOpenAI();
    const path = tempFile();
    const out = quiet();
    const r = await runTranslateMarkets({ markets: SAMPLE, filePath: path, env: {}, dryRun: true, fetchImpl, ...out });
    expect(r.exitCode).toBe(0);
    expect(calls).toHaveLength(0);
    expect(r.planned).toEqual(["t1", "t2", "t3"]);
    expect(read(path)).toEqual({});
    expect(out.lines.join("\n")).toMatch(/would translate t1 \(missing\)/);
  });

  test("--market limits the run to one id; unknown ids fail", async () => {
    const { fetchImpl, calls } = fakeOpenAI();
    const r = await runTranslateMarkets({ markets: SAMPLE, filePath: tempFile(), env: ENV, marketId: "t2", fetchImpl, ...quiet() });
    expect(calls).toHaveLength(1);
    expect(r.translated).toEqual(["t2"]);

    const bad = await runTranslateMarkets({ markets: SAMPLE, filePath: tempFile(), env: ENV, marketId: "nope", fetchImpl, ...quiet() });
    expect(bad.exitCode).toBe(1);
  });

  test("--max-markets caps a run (cost guard) and defers the rest", async () => {
    const { fetchImpl, calls } = fakeOpenAI();
    const r = await runTranslateMarkets({ markets: SAMPLE, filePath: tempFile(), env: ENV, maxMarkets: 2, fetchImpl, ...quiet() });
    expect(calls).toHaveLength(2);
    expect(r.deferred).toEqual(["t3"]);
    for (const bad of [0, -1, 1.5, NaN]) {
      const x = await runTranslateMarkets({ markets: SAMPLE, filePath: tempFile(), env: ENV, maxMarkets: bad, fetchImpl, ...quiet() });
      expect(x.exitCode).toBe(1);
    }
  });

  test("the API key never appears in any log line", async () => {
    const out = quiet();
    await runTranslateMarkets({
      markets: SAMPLE,
      filePath: tempFile(),
      env: ENV,
      fetchImpl: fakeOpenAI(() => "http-500").fetchImpl,
      ...out,
    });
    expect(out.lines.join("\n")).not.toContain(FAKE_KEY);
  });
});

// ------------------------------------------------------------------ runtime
test.describe("runtime reader", () => {
  const translated = MARKETS.find((m) => m.id === "mkt_002")!;
  const untranslated = MARKETS.find((m) => !(m.id in (translations as TranslationFile)))!;

  test("returns saved text for a translated locale, English otherwise", () => {
    const t = getMarketText(translated, "hi");
    expect(t.translated).toBe(true);
    expect(t.title).toBe((translations as TranslationFile).mkt_002.locales.hi.title);
    expect(getMarketText(translated, "en")).toMatchObject({ title: translated.title, translated: false });
    expect(getMarketText(untranslated, "hi")).toMatchObject({ title: untranslated.title, translated: false });
  });

  test("falls back to English when the source changed (stale hash)", () => {
    const edited = { ...translated, title: translated.title + " (edited)" };
    expect(getMarketText(edited, "hi")).toMatchObject({ title: edited.title, translated: false });
  });
});

test.describe("in the browser", () => {
  const openaiRequests: string[] = [];

  test.beforeEach(async ({ page }) => {
    openaiRequests.length = 0;
    page.on("request", (r) => {
      if (/openai\.com/.test(r.url())) openaiRequests.push(r.url());
    });
    await resetState(page);
  });

  test("Hindi shows saved titles on cards; untranslated markets stay English", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.evaluate((k) => window.localStorage.setItem(k, "hi"), STORAGE_KEY);
    await page.goto("/markets/cricket");

    const saved = (translations as TranslationFile).mkt_002.locales.hi.title;
    await expect(page.getByRole("heading", { name: saved, exact: true }).first()).toBeVisible();
    // Mumbai Indians vs CSK has no saved translation.
    await expect(
      page.getByRole("heading", { name: "Mumbai Indians vs. Chennai Super Kings" }).first()
    ).toBeVisible();
    expect(errors).toEqual([]);
    expect(openaiRequests).toEqual([]);
  });

  test("detail page shows the note only for translated, non-English views", async ({ page }) => {
    await page.goto("/market/ipl-2026-winner");
    await expect(page.locator('[data-testid="translated-note"]')).toHaveCount(0);

    await page.evaluate((k) => window.localStorage.setItem(k, "hi"), STORAGE_KEY);
    await page.reload();
    await expect(page.locator('[data-testid="translated-note"]')).toHaveText(hi.market.translatedNote);
    await expect(page.locator("h1")).toHaveText(
      (translations as TranslationFile).mkt_002.locales.hi.title
    );

    // An untranslated market in Hindi: English title, no note, no error.
    await page.goto("/market/mumbai-indians-vs-chennai-super-kings");
    await expect(page.locator("h1")).toHaveText("Mumbai Indians vs. Chennai Super Kings");
    await expect(page.locator('[data-testid="translated-note"]')).toHaveCount(0);
    expect(openaiRequests).toEqual([]);
  });

  test("search matches the active locale's saved title as well as English", async ({ page }) => {
    await page.evaluate((k) => window.localStorage.setItem(k, "hi"), STORAGE_KEY);
    await page.goto("/");
    await page.keyboard.press("Control+k");
    const box = page.getByRole("textbox").first();
    await box.fill("विजेता");
    const saved = (translations as TranslationFile).mkt_002.locales.hi.title;
    await expect(page.getByRole("button", { name: new RegExp(saved) })).toBeVisible();

    await box.fill("IPL 2026");
    await expect(page.getByRole("button", { name: new RegExp(saved) })).toBeVisible();
  });
});
