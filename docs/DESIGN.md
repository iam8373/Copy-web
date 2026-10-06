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
| `brand` | #9B83FF | #5228FF | text/icons on surfaces and on its own ≤ 20 % tint (≥ 4.5 : 1) |
| `brand-fill` | #6A46F5 | #6A46F5 | button fills; white text 5.5 : 1 |
| `success` (Yes) | #16C784 | #0C6B47 | ≥ 4.5 : 1 as text, also on its ≤ 20 % tint |
| `danger` (No) | #F76174 | #B3081F | ≥ 4.5 : 1 as text, also on its ≤ 20 % tint |
| `warning` | #F7A83B | #885105 | ≥ 4.5 : 1 as text, also on its ≤ 20 % tint |

Tinted fills (`bg-success/15` behind `text-success`, etc.) never go above **20 %**: the
Phase 6 contrast test found the previous shades at 4.0–4.4 : 1 on their own tints, so the
light-theme success/danger/warning/brand and dark-theme brand/danger were adjusted.
`tests/e2e/contrast.spec.ts` checks every pairing in both themes.

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

Tailwind defaults: `sm` 640, `md` 768, `lg` 1024, `xl` 1280, plus `xs` 400 (header
wordmark only).

- `< md`: one column, BottomNav visible.
- `md`: two-column grids.
- `lg`: market page = chart/info on the left, **sticky trade panel** on the right
  (360 px, `grid-cols-market`). Below `lg` the trade panel is a bottom sheet opened by a
  fixed Yes/No bar that sits on top of the BottomNav (`--bottom-nav-h`, 0 from `sm`).

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

Where each rule lives:

| Rule | Implementation |
| --- | --- |
| Page enter fade | `src/app/template.tsx` (opacity only; a transform would trap `position: fixed` children) |
| List stagger | `MarketGrid` / `MarketRow` via `useFirstPaint()` — 30 ms × index, first 8 cards, first paint only |
| Accordion | Rules panel: `grid-template-rows` 0fr → 1fr, 220 ms standard; `visibility: hidden` when closed |
| Sheet / dialog | `Dialog`: slide-up / fade-in on enter (220 ms), slide-down / fade-out on exit (150 ms) |
| Chart draw-in | `PriceChart`: Recharts animation only during first paint, never under reduced motion |
| Odds flash | `FlashValue` (900 ms colour flash) |
| Odometer | `AnimatedNumber` (220 ms default, 400 ms for the chart headline), emphasized curve |
| Reduced motion | Global CSS rule (1 ms) + `useReducedMotion()` for JS-driven motion (carousel, odometer, chart, dialog exit) |

Only status indicators loop (live pulse dot, skeleton pulse, button spinner).

## Components

Shared primitives live in `src/components/ui/` and are the only place new buttons,
chips, tabs, sheets and similar are built. Import from `@/components/ui`. A test-only
gallery of all of them is at `/e2e-ui` (dev server and e2e builds only).

| Component | Notes |
| --- | --- |
| `Button` | `primary` (brand-fill), `secondary`, `outline`, `ghost`, `yes`, `no`. Sizes `sm` 32 / `md` 40 / `lg` 48 px visual; a `::before` hit area keeps every one ≥ 44 px. `loading` sets `aria-busy`, shows a spinner and keeps the width. `buttonClasses()` styles links the same way. |
| `IconButton` | Square 32/40/48. `label` is required (aria-label + title). |
| `Chip` | Filter/sort toggle, 32 px visual, `aria-pressed`. `tone="highlight"` = the starred warm chip. `rounded-chip`. |
| `Badge` | Non-interactive status: `neutral`, `brand`, `success`, `danger`, `warning`; optional `dot` / `dot="pulse"`. |
| `Card` | `surface-2` + `border-subtle` + `shadow-card`; `radius="panel"` for the trade panel and chart block; `interactive` for hover border. |
| `EmptyState` | Icon, title, body, optional action; `size="compact"` inside tabs. Used instead of invented rows. |
| `Tabs` / `TabPanel` | WAI-ARIA tabs, automatic activation, Left/Right/Home/End, roving tabindex, scrolls at 360 px. `underline` (44 px tall) or `pill`. |
| `Segmented` | One-of-N switch that changes a view in place (sort, chart range, Yes/No). Buttons with `aria-pressed` in a labelled group; optional `yes`/`no` tone. Use `Tabs` when each option owns a panel. |
| `Tooltip` | (i) trigger. Opens on hover (hover-capable pointers), keyboard focus or tap; Escape / outside click close; kept inside the viewport. |
| `Dialog` | Portalled. Bottom sheet below `sm`, centred from `sm` (or `layout="center"`). Focus moves to `[data-autofocus]`, Tab is trapped, Escape/backdrop/close button close it, page scroll locked, focus returns to the trigger. Optional sticky `footer` with safe-area padding. |

Keyboard focus uses one ring (`FOCUS_RING`: 2 px `brand` ring, offset from `surface-1`),
only on `:focus-visible`.

`cn()` uses a `tailwind-merge` configured with our `text-11…32` sizes and
`shadow-card/popover/dialog`. Without it, `cn("text-13", "text-success")` dropped one of
the two classes (it read `text-13` as a colour).

## Gotcha

Never combine a display utility (`flex`, `grid`, `block`) with the `hidden` attribute: the
class wins and the element stays visible. Toggle `hidden`/`flex` classes instead.

## Enforcement

| Guard | What it checks |
| --- | --- |
| `npm run check:tokens` (CI) | No hex colours or `px` values outside the three token files |
| Locale parity (`tsc` + `i18n.spec.ts`) | Every string exists in all six locales |
| `contrast.spec.ts` | WCAG AA for every token pairing, both themes, incl. ≤ 20 % tints |
| `sweep.spec.ts` | Every route × both themes at 360 px: no overflow, no runtime errors, one `h1`, named controls, image alt; visible focus on the first 25 tab stops |
| `ui-primitives.spec.ts` | Hit areas ≥ 44 px, ARIA and keyboard behaviour of the primitives |
| `motion.spec.ts` | Motion rules above, and nothing running under reduced motion |
| `home-nav.spec.ts`, `market-page.spec.ts` | Page-level behaviour of Phases 3–4 |
