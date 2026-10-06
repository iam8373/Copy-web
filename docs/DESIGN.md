# DESIGN

The design system for BharatPredict. Tokens are defined in **two files only**:
`src/app/globals.css` (CSS variables, per theme) and `tailwind.config.ts` (Tailwind names
for those variables). Non-CSS consumers (Recharts props, SVG) read
`src/lib/tokens.ts`, which only references the same CSS variables. Anything else must use
a token; `npm run check:tokens` fails on hard-coded hex colours or `px` values elsewhere.

Tailwind defaults for `fontSize`, `spacing`, `boxShadow`, etc. are **extended, never
replaced**, so existing utilities keep working.

## Principles

- Numbers first. Prices, odds and amounts use tabular figures, Latin digits, `en-IN`
  grouping and the ₹ symbol, in every language.
- Dark theme is border-led; light theme uses soft layered shadows.
- Motion explains a change and stops. Nothing moves under `prefers-reduced-motion`.
- Hover effects only inside `@media (hover: hover)`. Touch targets ≥ 44 px.
- No horizontal page scroll at 360 px.

## Typography

| Use | Family |
| --- | --- |
| UI (all locales) | Inter, then the active Noto (hi/mr → Devanagari, bn → Bengali, ta → Tamil, te → Telugu), then `system-ui` |
| Aligned numerals (order book, tables) | Geist Mono (`font-mono`) |

All fonts are self-hosted with `next/font/local` (`src/fonts/`), `display: swap`. No
Google Fonts requests at build or runtime. Weights: 400, 500, 600, 700.

Type scale (`text-<size>`; size / line-height in px):

| Token | Size / LH | Typical use |
| --- | --- | --- |
| `text-11` | 11 / 14 | badges, tiny captions |
| `text-12` | 12 / 16 | metadata, labels |
| `text-13` | 13 / 18 | secondary body, chips, table cells |
| `text-14` | 14 / 20 | **body on mobile**, buttons |
| `text-16` | 16 / 24 | card titles, **all inputs** (prevents iOS zoom) |
| `text-18` | 18 / 26 | section headings |
| `text-20` | 20 / 24 | page subtitles, panel figures |
| `text-24` | 24 / 28 | page titles |
| `text-32` | 32 / 40 | hero figures ("NN% chance") |

`.tnum` adds tabular numerals and is required on every price, % and amount.

## Spacing

4 px base. Allowed steps for padding, margin and gap: **4, 6, 8, 12, 16, 20, 24, 32, 48**
(Tailwind `1, 1.5, 2, 3, 4, 5, 6, 8, 12`). Page gutters: 16 px below `md`, 24 px from `md`
(`px-gutter`). Max content width **1280 px** (`max-w-content`).

## Radii

| Token | px | Use |
| --- | --- | --- |
| `rounded-chip` | 4 | inputs, chips |
| `rounded-btn` | 8 | buttons |
| `rounded-card` | 12 | cards |
| `rounded-panel` | 18 | panels (trade panel, chart block) |
| `rounded-dialog` | 24 | dialogs, bottom sheets (top corners) |
| `rounded-full` | — | avatars, dots |

## Elevation (three tokens only)

| Token | Dark theme | Light theme |
| --- | --- | --- |
| `shadow-card` | none (1 px `border-subtle` does the work) | 1 px ring ~6% + 2 soft layers |
| `shadow-popover` | faint ring + small drop | ring + medium layers |
| `shadow-dialog` | faint ring + large drop | ring + large layers |

## Colour

Brand tokens are kept (`accent-*`). Semantic tokens are what new code should use.

| Token | Dark | Light | Notes |
| --- | --- | --- | --- |
| `surface-1` | #0A0B0D | #FFFFFF | page background |
| `surface-2` | #141619 | #F6F7F9 | cards |
| `surface-3` | #1E2126 | #ECEEF2 | inputs, hover, wells |
| `border-subtle` | #2A2D33 | #DFE2E8 | dividers, card borders |
| `border-strong` | #666D78 | #7E858F | inputs, focus-adjacent (≥ 3:1) |
| `text-primary` | #FFFFFF | #0A0B0D | |
| `text-secondary` | #A1A5AB | #5D636E | ≥ 6.5 / 5.2 : 1 |
| `text-muted` | #8A8F97 | #646A75 | ≥ 4.5 : 1 on every surface |
| `brand` | #8D71FF | #6B47FF | text/icons on surfaces (≥ 4.5 : 1) |
| `brand-fill` | #6A46F5 | #6A46F5 | button fills; white text 5.5 : 1 |
| `success` (Yes) | #16C784 | #0E7B52 | ≥ 4.5 : 1 as text |
| `danger` (No) | #F6465D | #D30A24 | ≥ 4.5 : 1 as text |
| `warning` | #F7A83B | #995B06 | |

Finding: white text on the old primary fill `#7C5CFF` is 4.35 : 1 (fails AA at 14 px), so
buttons now fill with `brand-fill`.

**Yes = success, No = danger**, everywhere (buttons, chips, order book sides).

### Chart palette (outcomes, in order)

The Okabe-Ito colour-blind-safe set, lightness-tuned so every line is ≥ 3 : 1 against the
card surface in both themes (WCAG non-text contrast).

| # | Name | Base | Dark | Light |
| --- | --- | --- | --- | --- |
| 1 | blue | #0072B2 | #0072B2 | #0072B2 |
| 2 | orange | #E69F00 | #E69F00 | #BD8200 |
| 3 | green | #009E73 | #009E73 | #009E73 |
| 4 | pink | #CC79A7 | #CC79A7 | #C972A2 |
| 5 | sky | #56B4E9 | #56B4E9 | #1C93D7 |
| 6 | vermillion | #D55E00 | #D55E00 | #D55E00 |
| 7 | yellow | #F0E442 | #F0E442 | #938A0C |
| 8 | grey | #999999 | #999999 | #8B8B8B |

Exposed as `--chart-1` … `--chart-8` and `chart-1…8` colours.

## Breakpoints and layout

Tailwind defaults: `sm` 640, `md` 768, `lg` 1024, `xl` 1280.

- `< md`: one column, BottomNav visible.
- `md`: two-column grids.
- `lg`: market page = chart/info on the left, **sticky trade panel** on the right
  (~360 px). Below `lg` the trade panel is a bottom sheet opened by sticky Yes/No buttons.

## Motion

| Token | Value |
| --- | --- |
| `duration-xs` | 150 ms |
| `duration-sm` | 220 ms |
| `duration-md` | 400 ms |
| `duration-lg` | 500 ms |
| `ease-out` | cubic-bezier(0, 0, 0.2, 1) |
| `ease-standard` | cubic-bezier(0.4, 0, 0.2, 1) |
| `ease-emphasized` | cubic-bezier(0.19, 1, 0.22, 1) |

Rules: page enter fade 220 ms; list stagger 30 ms steps, max 8 items, once; accordion and
sheet 220 ms standard; chart line draw-in 400 ms on first paint only; odds flash 900 ms
(existing `FlashValue`); odometer 220–400 ms emphasized. Nothing that a user is reading
keeps animating past 500 ms. All of it is disabled under `prefers-reduced-motion`.

## Components

Shared primitives live in `src/components/ui/` (Phase 2) and are the only place new
buttons, chips, tabs, sheets and similar are built.

## Enforcement

- `npm run check:tokens` — fails on hex colours or `px` values outside the token files.
- Locale key parity — every new string goes into all six locale files.
- e2e — 360 px overflow, reduced motion, both themes.
