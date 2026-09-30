# Self-hosted fonts

These files are committed so builds never contact Google Fonts
(`fonts.googleapis.com` / `fonts.gstatic.com`). They are loaded with
`next/font/local` in `fonts.ts`.

| File(s) | Source package | Version | Subset | Weights |
| --- | --- | --- | --- | --- |
| `inter-latin-*.woff2` | `@fontsource/inter` | 5.3.0 | latin | 400, 500, 600, 700 |
| `noto-sans-devanagari-devanagari-*.woff2` | `@fontsource/noto-sans-devanagari` | 5.3.0 | devanagari | 400, 600 |
| `noto-sans-bengali-bengali-*.woff2` | `@fontsource/noto-sans-bengali` | 5.3.0 | bengali | 400, 600 |
| `noto-sans-tamil-tamil-*.woff2` | `@fontsource/noto-sans-tamil` | 5.3.0 | tamil | 400, 600 |
| `noto-sans-telugu-telugu-*.woff2` | `@fontsource/noto-sans-telugu` | 5.3.0 | telugu | 400, 600 |

**License:** all fonts are under the SIL Open Font License 1.1 (`OFL-1.1`). The license
texts are included here as `OFL-Inter.txt` and `OFL-Noto.txt`, as the OFL requires when
redistributing the fonts.

## Loading behaviour

- Inter is the UI font for every locale and is preloaded.
- The four Noto families use `preload: false` and are only referenced from CSS under
  `html[data-script="devanagari" | "bengali" | "tamil" | "telugu"]`. A browser showing a
  Latin locale never requests them.
- Noto ships 400 and 600 only. Text styled `font-bold` (700) in an Indic locale renders
  at the nearest available weight (600) or is synthesised by the browser.

## Updating

The `@fontsource` packages are **not** project dependencies. To refresh:

```bash
mkdir -p /tmp/fontsrc && cd /tmp/fontsrc && npm init -y
npm install @fontsource/inter @fontsource/noto-sans-devanagari \
  @fontsource/noto-sans-bengali @fontsource/noto-sans-tamil @fontsource/noto-sans-telugu
# copy node_modules/@fontsource/<pkg>/files/<pkg>-<subset>-<weight>-normal.woff2 here
```

Then update the version column above.
