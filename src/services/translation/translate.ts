import { responseSchema, systemPrompt, userPrompt } from "./prompt";
import type { MarketSource } from "./types";

/**
 * SERVER / SCRIPT ONLY. Never import from a client component (ESLint enforces
 * this for src/app and src/components). The API key is passed in by the
 * caller, which reads it from the environment; it is never logged.
 *
 * Provider-agnostic: each provider turns the same prompt + JSON schema into
 * its own request and returns the parsed, *unvalidated* object. The caller
 * runs validate.ts on it, so a provider can never bypass the checks.
 */
if (typeof window !== "undefined") {
  throw new Error("services/translation/translate must not run in the browser");
}

export type ProviderName = "openai" | "gemini";
export const PROVIDER_NAMES: readonly ProviderName[] = ["openai", "gemini"];

export const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/** Model ids go into the Gemini URL path, so only allow plain id characters. */
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Per request. Reasoning models can take well over a minute for five locales. */
export const DEFAULT_TIMEOUT_MS = 120_000;

export const geminiUrl = (model: string) => `${GEMINI_BASE_URL}/${model}:generateContent`;

export interface TranslateOptions {
  apiKey: string;
  model: string;
  /** Defaults to "openai" (the original provider). */
  provider?: ProviderName;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class TranslationRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "TranslationRequestError";
  }
}

/** Rate limits and overload (429 / 5xx) are worth a pause before retrying. */
export const isTransient = (err: unknown) =>
  err instanceof TranslationRequestError && err.status !== undefined && (err.status === 429 || err.status >= 500);

/** Environment variable names per provider. */
export const PROVIDER_ENV: Record<ProviderName, { key: string; model: string; label: string }> = {
  openai: { key: "OPENAI_API_KEY", model: "OPENAI_MODEL", label: "OpenAI" },
  gemini: { key: "GEMINI_API_KEY", model: "GEMINI_MODEL", label: "Google Gemini" },
};

export type ResolvedProvider =
  | { ok: true; provider: ProviderName; apiKey: string; model: string }
  | { ok: false; error: string };

/**
 * Picks the provider from the environment:
 *   1. TRANSLATION_PROVIDER=openai|gemini, if set;
 *   2. otherwise whichever single provider has an API key;
 *   3. if both have keys, TRANSLATION_PROVIDER must say which (no silent choice,
 *      since the two are billed separately).
 * The model is always required; no default model is assumed.
 */
export function resolveProvider(env: Record<string, string | undefined>): ResolvedProvider {
  const val = (k: string) => env[k]?.trim() || undefined;
  const explicit = val("TRANSLATION_PROVIDER")?.toLowerCase();

  let provider: ProviderName;
  if (explicit) {
    if (!PROVIDER_NAMES.includes(explicit as ProviderName)) {
      return { ok: false, error: `TRANSLATION_PROVIDER must be one of ${PROVIDER_NAMES.join(", ")} (got "${explicit}").` };
    }
    provider = explicit as ProviderName;
  } else {
    const withKey = PROVIDER_NAMES.filter((p) => val(PROVIDER_ENV[p].key));
    if (withKey.length === 0) {
      return {
        ok: false,
        error:
          "No translation provider is configured: OPENAI_API_KEY is not set and GEMINI_API_KEY is not set. Add one to .env.local (never commit it). The app itself does not need it and keeps working in English.",
      };
    }
    if (withKey.length > 1) {
      return {
        ok: false,
        error: "Both OPENAI_API_KEY and GEMINI_API_KEY are set. Set TRANSLATION_PROVIDER=openai or TRANSLATION_PROVIDER=gemini to choose.",
      };
    }
    provider = withKey[0];
  }

  const { key, model: modelVar } = PROVIDER_ENV[provider];
  const apiKey = val(key);
  const model = val(modelVar);
  if (!apiKey) {
    return {
      ok: false,
      error: `${key} is not set. Add it to .env.local (never commit it). The app itself does not need it and keeps working in English.`,
    };
  }
  if (!model) return { ok: false, error: `${modelVar} is not set. Add the model name to .env.local; no default is assumed.` };
  if (!MODEL_ID.test(model)) return { ok: false, error: `${modelVar} is not a valid model id.` };
  return { ok: true, provider, apiKey, model };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new TranslationRequestError("response content was not valid JSON");
  }
}

// ---------------------------------------------------------------- OpenAI
async function translateWithOpenAI(source: MarketSource, opts: TranslateOptions): Promise<unknown> {
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: userPrompt(source) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "market_translations", strict: true, schema: responseSchema() },
      },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });

  if (!res.ok) {
    // Status only: response bodies can echo request details.
    throw new TranslationRequestError(`OpenAI request failed with HTTP ${res.status}`, res.status);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null; refusal?: string | null } }>;
  };
  const message = body.choices?.[0]?.message;
  if (message?.refusal) throw new TranslationRequestError("model refused the request");
  if (!message?.content) throw new TranslationRequestError("response had no content");
  return parseJson(message.content);
}

// ---------------------------------------------------------------- Gemini
async function translateWithGemini(source: MarketSource, opts: TranslateOptions): Promise<unknown> {
  if (!MODEL_ID.test(opts.model)) throw new TranslationRequestError("invalid model id");
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(geminiUrl(opts.model), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Header, not ?key=, so the key never appears in a URL or a log line.
      "x-goog-api-key": opts.apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt() }] },
      contents: [{ role: "user", parts: [{ text: userPrompt(source) }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        // Full JSON Schema (incl. additionalProperties: false), same as OpenAI.
        responseJsonSchema: responseSchema(),
      },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new TranslationRequestError(`Gemini request failed with HTTP ${res.status}`, res.status);
  }

  const body = (await res.json()) as {
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  if (body.promptFeedback?.blockReason) throw new TranslationRequestError("model refused the request");
  const candidate = body.candidates?.[0];
  if (candidate?.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) {
    throw new TranslationRequestError(`model stopped early (${candidate.finishReason})`);
  }
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) throw new TranslationRequestError("response had no content");
  return parseJson(text);
}

/**
 * ONE request per market, returning all five locales together as strict JSON.
 * Returns the parsed, *unvalidated* object; the caller must run validate.ts.
 */
export async function translateMarket(source: MarketSource, opts: TranslateOptions): Promise<unknown> {
  return (opts.provider ?? "openai") === "gemini"
    ? translateWithGemini(source, opts)
    : translateWithOpenAI(source, opts);
}
