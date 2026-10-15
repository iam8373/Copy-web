import { createServer, type Server } from "node:http";
import { DICTIONARIES } from "../../src/i18n";
import { TARGET_LOCALES } from "../../src/services/translation/types";

/**
 * A tiny stand-in for Gemini's generateContent endpoint (R5 tests). It
 * "translates" by replacing lowercase English words with a Devanagari letter,
 * which keeps numbers, acronyms and capitalised names intact, so the output
 * passes the same validators real output must pass. Yes/No use the glossary.
 */

const fake = (s: string) => s.replace(/\b[a-z][a-z']*\b/g, "क");

export function startGeminiMock(port: number): Promise<{ server: Server; calls: () => number }> {
  let calls = 0;
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      calls += 1;
      if (req.headers["x-goog-api-key"] !== "test-only-gemini-key") {
        res.writeHead(401).end();
        return;
      }
      const parsed = JSON.parse(body);
      const schema = parsed.generationConfig.responseJsonSchema;
      const input = JSON.parse(parsed.contents[0].parts[0].text);
      let out: Record<string, unknown>;
      if (schema.properties.hi.type === "array") {
        out = Object.fromEntries(
          TARGET_LOCALES.map((l) => [
            l,
            (input.labels as string[]).map((x) =>
              x === "Yes" ? DICTIONARIES[l].terms.yes : x === "No" ? DICTIONARIES[l].terms.no : `${fake(x)} ${l}`
            ),
          ])
        );
      } else {
        out = Object.fromEntries(
          TARGET_LOCALES.map((l) => [l, { title: `${fake(input.title)} (${l})`, description: input.description ? fake(input.description) : "" }])
        );
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(out) }] } }] }));
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, calls: () => calls })));
}
