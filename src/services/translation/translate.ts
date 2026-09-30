import { responseSchema, systemPrompt, userPrompt } from "./prompt";
import type { MarketSource } from "./types";

/**
 * SERVER / SCRIPT ONLY. Never import from a client component (ESLint enforces
 * this for src/app and src/components). The API key is passed in by the
 * caller, which reads it from the environment; it is never logged.
 */
if (typeof window !== "undefined") {
  throw new Error("services/translation/translate must not run in the browser");
}

export const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

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

/**
 * ONE request per market, returning all five locales together as strict JSON
 * (structured output via json_schema). Returns the parsed, *unvalidated*
 * object; the caller must run validate.ts on it.
 */
export async function translateMarket(source: MarketSource, opts: TranslateOptions): Promise<unknown> {
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
    signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
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

  try {
    return JSON.parse(message.content);
  } catch {
    throw new TranslationRequestError("response content was not valid JSON");
  }
}
