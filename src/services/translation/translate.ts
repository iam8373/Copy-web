import { responseSchema, systemPrompt, userPrompt } from "./prompt";
import type { MarketSource } from "./types";

/**
 * SERVER / SCRIPT ONLY. Never import from a client component (ESLint enforces
 * this for src/app and src/components). The API key is passed in by the
 * caller, which reads it from the environment; it is never logged.
 *
 * Provider: Google Gemini only (docs/DECISIONS.md D-018). The request asks for
 * strict JSON matching responseSchema(); the parsed object is returned
 * *unvalidated* and the caller must run validate.ts on it.
 */
if (typeof window !== "undefined") {
  throw new Error("services/translation/translate must not run in the browser");
}

export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/** Model ids go into the URL path, so only allow plain id characters. */
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export const geminiUrl = (model: string) => `${GEMINI_BASE_URL}/${model}:generateContent`;

/** Per request. Reasoning models can take well over a minute for five locales. */
export const DEFAULT_TIMEOUT_MS = 120_000;

export interface TranslateOptions {
  apiKey: string;
  model: string;
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

export type ResolvedConfig =
  | { ok: true; apiKey: string; model: string }
  | { ok: false; error: string };

/** Reads GEMINI_API_KEY and GEMINI_MODEL. No default model is assumed. */
export function resolveConfig(env: Record<string, string | undefined>): ResolvedConfig {
  const apiKey = env.GEMINI_API_KEY?.trim();
  const model = env.GEMINI_MODEL?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error:
        "GEMINI_API_KEY is not set. Add it to .env.local (never commit it). The app itself does not need it and keeps working in English.",
    };
  }
  if (!model) return { ok: false, error: "GEMINI_MODEL is not set. Add the model name to .env.local; no default is assumed." };
  if (!MODEL_ID.test(model)) return { ok: false, error: "GEMINI_MODEL is not a valid model id." };
  return { ok: true, apiKey, model };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new TranslationRequestError("response content was not valid JSON");
  }
}

/**
 * ONE request per market, returning all five locales together as strict JSON.
 * Returns the parsed, *unvalidated* object; the caller must run validate.ts.
 */
export async function translateMarket(source: MarketSource, opts: TranslateOptions): Promise<unknown> {
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
        // Full JSON Schema, including additionalProperties: false.
        responseJsonSchema: responseSchema(),
      },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });

  if (!res.ok) {
    // Status only: response bodies can echo request details.
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
