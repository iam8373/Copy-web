import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * WCAG AA contrast for every token pairing the UI actually uses, computed from
 * src/app/globals.css (both themes). Tinted fills (e.g. Yes buttons:
 * text-success on bg-success/15) are alpha-blended over the surface first.
 * A token change that breaks AA fails here before it ships. Tints stop at 20%
 * (hover); stronger tints of a colour under the same colour's text fail AA.
 */

type RGB = [number, number, number];
const css = readFileSync(join(__dirname, "../../src/app/globals.css"), "utf8");

function block(selector: string): Record<string, RGB> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("}", start));
  const out: Record<string, RGB> = {};
  for (const m of Array.from(body.matchAll(/--([a-z0-9-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g))) {
    out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  return out;
}

const dark = block(":root");
const THEMES: Record<string, Record<string, RGB>> = { dark, light: { ...dark, ...block("html.light") } };

const lum = ([r, g, b]: RGB) => {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: RGB, b: RGB) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const blend = (fg: RGB, alpha: number, bg: RGB): RGB =>
  fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha))) as RGB;

const WHITE: RGB = [255, 255, 255];
const SURFACES = ["surface-1", "surface-2", "surface-3"] as const;

for (const [name, v] of Object.entries(THEMES)) {
  test.describe(`contrast: ${name} theme`, () => {
    test("body text tokens are AA (4.5:1) on every surface", () => {
      for (const text of ["text-primary", "text-secondary", "text-muted"]) {
        for (const s of SURFACES) {
          expect(ratio(v[text], v[s]), `${text} on ${s}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    test("semantic colours are AA as text on cards and pages", () => {
      for (const c of ["brand", "success", "danger", "warning"]) {
        for (const s of ["surface-1", "surface-2"]) {
          expect(ratio(v[c], v[s]), `${c} on ${s}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    test("white on button fills is AA", () => {
      expect(ratio(WHITE, v["brand-fill"]), "white on brand-fill").toBeGreaterThanOrEqual(4.5);
      expect(ratio(WHITE, v["brand-fill-hover"]), "white on brand-fill-hover").toBeGreaterThanOrEqual(4.5);
    });

    test("tinted chips, badges and Yes/No buttons are AA", () => {
      // [text token, tint token, tint alpha, underlying surface]
      const pairs: Array<[string, string, number, string]> = [
        ["success", "success", 0.15, "surface-2"], // Yes button / selected outcome
        ["danger", "danger", 0.15, "surface-2"], // No button
        ["success", "success", 0.2, "surface-2"], // Yes button hover (max tint)
        ["danger", "danger", 0.2, "surface-2"],
        ["brand", "brand", 0.2, "surface-2"],
        ["warning", "warning", 0.2, "surface-2"],
        ["brand", "brand", 0.15, "surface-2"], // selected chip, brand badge
        ["brand", "brand", 0.15, "surface-1"],
        ["warning", "warning", 0.15, "surface-2"], // Demo data badge
        ["warning", "warning", 0.1, "surface-1"], // highlighted chip
        ["danger", "danger", 0.15, "surface-2"], // Live badge
      ];
      for (const [text, tint, alpha, surface] of pairs) {
        const bg = blend(v[tint], alpha, v[surface]);
        expect(ratio(v[text], bg), `${text} on ${tint}/${alpha} over ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    test("input and focus borders are 3:1 (non-text contrast)", () => {
      for (const s of SURFACES) {
        expect(ratio(v["border-strong"], v[s]), `border-strong on ${s}`).toBeGreaterThanOrEqual(3);
      }
      // The focus ring is brand on the page surface.
      expect(ratio(v.brand, v["surface-1"]), "focus ring").toBeGreaterThanOrEqual(3);
    });

    test("chart lines are 3:1 against the card", () => {
      for (let i = 1; i <= 8; i++) {
        expect(ratio(v[`chart-${i}`], v["surface-2"]), `chart-${i}`).toBeGreaterThanOrEqual(3);
      }
    });
  });
}
