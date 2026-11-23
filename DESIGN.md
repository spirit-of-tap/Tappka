---
name: Tappka
description: Student portal of Tiimiakatemia Prague (TAP). shadcn/ui (new-york) + Tailwind v4 + next-themes. Tokens here mirror src/app/globals.css (light values; dark theme lives there too).
colors:
  primary: "#b31b1b"
  primary-foreground: "#ffffff"
  background: "oklch(0.965 0.012 80)"
  card: "#ffffff"
  sidebar: "oklch(0.993 0.004 80)"
  sidebar-primary: "oklch(0.484 0.184 27.7)"
  hero: "oklch(0.3 0.04 12)"
  hero-foreground: "oklch(0.97 0.012 60)"
  hero-muted: "oklch(0.84 0.03 30)"
  hero-success: "oklch(0.8 0.16 150)"
  spotlight: "oklch(0.484 0.184 27.7)"
  spotlight-foreground: "#ffffff"
  spotlight-muted: "color-mix(in oklch, #ffffff 90%, {colors.spotlight})"
  foreground: "#2c1a1d"
  secondary: "#2c1a1d"
  muted: "oklch(0.94 0.012 75)"
  accent: "oklch(0.93 0.02 70)"
  destructive: "oklch(0.581 0.223 27.9)"
  destructive-strong: "oklch(0.5 0.19 27.9)"
  success: "oklch(0.6 0.14 145)"
  success-strong: "oklch(0.489 0.14 145)"
  warning: "oklch(0.758 0.152 69.3)"
  warning-strong: "oklch(0.51 0.152 69.3)"
  info: "oklch(0.635 0.089 195.1)"
  chart-1: "oklch(0.537 0.206 27.8)"
  chart-2: "oklch(0.758 0.152 69.3)"
  chart-2-strong: "oklch(0.51 0.152 69.3)"
  chart-3: "oklch(0.635 0.089 195.1)"
  chart-3-strong: "oklch(0.483 0.089 195.1)"
  chart-4: "oklch(0.628 0.183 327.5)"
  chart-5: "oklch(0.554 0.16 287.7)"
typography:
  heading:
    fontFamily: Poppins
    fontWeight: 700
  body:
    fontFamily: Roboto
    fontWeight: 400
  quote:
    fontFamily: Pacifico
    fontWeight: 400
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  "2xl": 16px
  "3xl": 20px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.xl}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.background}"
    rounded: "{rounded.xl}"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "#ffffff"
    rounded: "{rounded.xl}"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.2xl}"
  hero-panel:
    backgroundColor: "{colors.hero}"
    textColor: "{colors.hero-foreground}"
    rounded: "{rounded.3xl}"
  spotlight-panel:
    backgroundColor: "{colors.spotlight}"
    textColor: "{colors.spotlight-foreground}"
    rounded: "{rounded.3xl}"
  text-foreground:
    typography: "{typography.body}"
    textColor: "{colors.foreground}"
  badge-muted:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
  hover-accent:
    backgroundColor: "{colors.accent}"
  status-success:
    textColor: "{colors.success-strong}"
    backgroundColor: "{colors.success}"
  status-destructive:
    textColor: "{colors.destructive-strong}"
    backgroundColor: "{colors.destructive}"
  status-warning:
    textColor: "{colors.warning-strong}"
    backgroundColor: "{colors.warning}"
  status-info:
    backgroundColor: "{colors.info}"
  chart-1:
    backgroundColor: "{colors.chart-1}"
  chart-2:
    backgroundColor: "{colors.chart-2}"
    textColor: "{colors.chart-2-strong}"
  chart-3:
    backgroundColor: "{colors.chart-3}"
    textColor: "{colors.chart-3-strong}"
  chart-4:
    backgroundColor: "{colors.chart-4}"
  chart-5:
    backgroundColor: "{colors.chart-5}"
---

## Overview

TAP brand red/brown/white applied through a shadcn/ui (new-york) system on
Tailwind v4 + next-themes. The normative palette, radii, and fonts live in
`src/app/globals.css` (OKLCH, light + dark); if this file and the code
disagree, the code wins and this file should be updated. Every UI change must
use tokens — a hardcoded color in a component is a defect.

## Colors

Brand core: TAP red `#b31b1b` (primary, links, focus), TAP brown `#2c1a1d`
(foreground, secondary surface), TAP white `#fcfff7` (logo
text on red).

**Light and lively (motiv „Světlá a živá“, #212).** Cream page
(`--background`), white cards (`--card`) and a warm white sidebar
(`--sidebar`, with a right border) that uses the normal page tokens. Colour
comes from tinted tiles, not dark blocks: each sidebar section has a colour
(Společné = `primary`, Můj rozvoj = `chart-5` violet, Můj tým = `chart-3`
teal) shown as a vertical stripe along the whole section and as the icon chip of its items, and every
section carries a one-line hint saying who it is for. Beta modules get a small
amber dot (`sr-only` "Beta"). The dashboard (direction E): greeting on the page with quick actions and
the layout-settings button top right; a dark `bg-hero` card for the next TS
next to a solid TAP-red "Eseje ke kontrole" card (coaches) or the progress
card (members); then rooms (rolling week strip that filters the list),
the progress card that turns between Knižní body and Zákaznické schůzky
(dots, 7 s, pauses on hover/focus, no auto-turn with reduced motion) and the
team podium. Motion is light and always `motion-safe:`: cards rise in with
a stagger (`animate-rise`), rings draw (`animate-ring-draw`), podium steps
grow (`animate-bar-grow`); the route loader is the breathing T tile with a
sweeping bar.

Colour palettes (Nastavení → Vzhled) sit on top of light/dark: `data-palette`
on `<html>` (set before paint by `PALETTE_BOOT_SCRIPT`, stored per browser in
localStorage) swaps the surface, primary, sidebar, hero and spotlight tokens.
Palettes: Tappka (default, no attribute), Les, Oceán, Levandule, Meruňka,
Růžová, Grafit. Every palette redefines the same token set for light and dark
(including `hero`, `hero-muted`, `spotlight`, `spotlight-muted`); the `tappka`
blocks repeat `:root` / `.dark` exactly so a preview nested in another palette
still shows the brand colours — keep them in sync. Dark mode has two shades:
Klasický and Tlumený (`data-shade="dim"` sets `--shade-lift` 0.075, which every
dark surface token adds to its lightness, so it works with every palette; the
default dark `primary`, `ring` and `sidebar-primary` also add `lift × 1.5` so
`text-primary` stays ≥ 4.5:1 on lifted cards). Chart colours stay fixed so data
reads the same in every palette. Reading progress is a ring against the cumulative goal for the
current semester (`cumulativeSemesterMilestone`). The brand logo tile uses
`bg-tap-red` directly. Status
semantics: `success` green, `warning` amber (hue = chart-2), `info` teal
(hue = chart-3), `destructive` red.

### Hero and spotlight surfaces

Two feature surfaces carry their own text tokens; never put `foreground` /
`muted-foreground` on them.

| Surface | Use for | Text tokens | Focus ring |
|---|---|---|---|
| `bg-hero` (dark brown/palette-tinted in both themes) | the single most important info block of a page (next TS card, reservations summary) | `text-hero-foreground` (primary), `text-hero-muted` (secondary), `text-hero-success` (positive state, e.g. "free", "confirmed") | `focus-ring-hero` |
| `bg-spotlight` (full primary in light, primary sunk into the card in dark so it never glares) | one solid call to action per page (e.g. "Eseje ke kontrole") | `text-spotlight-foreground`, `text-spotlight-muted` | `focus-ring-spotlight` |

All pairs clear 4.5:1 in every palette, light, dark and dim. Interactive
elements placed on a feature surface use `focus-ring-hero` /
`focus-ring-spotlight` (3px ring in the surface's foreground at 70 % alpha)
instead of `focus-ring`, whose red ring is invisible there. At most one hero
and one spotlight per page.

### Text-safe status colours

`text-destructive` fails 4.5:1 on its own `bg-destructive/15` tint (≈ 4.2:1
light, ≈ 2.7:1 dark). Text on destructive tints (badges, inline errors) uses
`text-destructive-strong` (≈ 5.8:1 light, ≥ 5.2:1 dark and dim). Plain
`text-destructive` stays fine on `card` / `background`.

### Reservations room map (dark)

The reservations room map is a dark room: it uses the `bg-hero` surface with
`hero-*` text. Status is never colour alone: each state is a coloured dot
(`success` free, `chart-2` busy, `primary` mine, `hero-muted` closed)
plus a label in the legend, and the timeline component repeats the same states
with its own legend. Text states on the map use `text-hero-success` (free),
`text-chart-2` (busy) and `text-hero-foreground/80` (closed); dots may use the
surface tones because they are not text. The dots' glow (`shadow-[0_0_12px]`)
is the one allowed exception to "no coloured glows", limited to these status
dots.

Rules:

- Semantic tokens only; never hardcoded hex/oklch in components.
- Surface tones (`success`, `warning`, chart-2/3) are **not text-safe** in
  light mode — for text use the darkened `-strong` variants
  (`success-strong`, `warning-strong`, `chart-2-strong`, `chart-3-strong`).
  In practice the strong text sits on `/10` tinted backgrounds (where it
  clears AA ~5:1), not on the full-saturation token — the linter's
  contrast warnings on `status-*` / `chart-*` pairs reflect that out-of-
  context pairing, not a real usage.
- Chart hues 1–5 are categorical; keep one hue → one meaning per page.
- Every change must work in both `:root` (light) and `.dark`, and under
  `data-shade="dim"`.
- Text on `bg-hero` / `bg-spotlight` / destructive tints uses the dedicated
  tokens above, never `foreground` / `destructive`.
- Contrast floor: 4.5:1 for all text (including 11px badges) in every palette
  and shade. Verify new token pairs, don't eyeball them.

## Typography

Poppins 700 for all headings (`h1`–`h6`, `font-heading`). Poppins 800
(`font-extrabold`) is allowed only for display numerals (stats, rings, podium
points) and the dashboard greeting name — never for headings or body. Roboto
(`font-body`, the default) for body and UI; Pacifico (`font-quote`) only for
decorative brand moments (the dashboard greeting "Hezké pondělí, X!" is Pacifico
script plus the name in Poppins). All webfonts load with `latin-ext` so Czech
diacritics render. Tiptap content has its own scale (see `.tiptap` in
globals.css) — don't override.

Smallest text size is `text-xs`; the occasional `text-[11px]` badge is
tolerated but must still clear 4.5:1 (use `-strong` tokens). There is no
`text-2xs` token.

## Layout

Spacing follows the 4px scale (`sm`–`xl` above). Every page renders inside
`PageShell`; its header is the shared `PageHeader` (`title`, `description`,
`count`, `action`, `back`) — never hand-rolled `h1`/`h2` markup. Content width
is max-w constrained; pages stay single-column on mobile.

Header rules:

- Title: Poppins bold, `text-2xl sm:text-3xl tracking-tight`, always the
  page's single `h1`.
- Description: one sentence, no trailing period, ≤ ~90 chars, tykání,
  gender-neutral (`:` pairs); identical to the page's `metadata.description`.
- Counts go through the `count` prop with `pluralizeCz`; actions through
  `action`.
- Child pages navigate back via the `back` prop or `ui/page-back.tsx`
  (chevron + visible label, ≥44px tap height) — no bespoke back links.
- Exceptions: dashboard greeting ("Hezké pondělí, X!" in Pacifico script with
  the name in Poppins, one step larger than section titles), auth screens, `/beta` hero, `/reservations/[code]/quick`,
  essay editors (`sr-only h1`), 404.

## Elevation & Depth

Depth comes from layers, not shadows: cream page → white cards with 1px
`border` (`rounded-2xl`) → feature surfaces (`bg-hero`, `bg-spotlight`,
`rounded-3xl`). Hover = `accent` tint (`hover:bg-accent`). Interactive cards
may lift (`motion-safe:hover:-translate-y-0.5`) with at most `hover:shadow-md`.
No coloured glows and no `shadow-lg` / `shadow-xl`.

## Shapes

Radii derive from `--radius: 0.5rem` (see `rounded` tokens):

| Element | Class |
|---|---|
| Cards, dialogs, sheets | `rounded-2xl` |
| Hero / spotlight panels and other big feature surfaces | `rounded-3xl` |
| Buttons, inputs, selects, tiles inside cards | `rounded-xl` (`rounded-lg` for compact/dense controls) |
| Badges, chips, dots, avatars | `rounded-full` or `rounded-md` |

One radius per surface type; don't mix within a type.

## Motion

Easing token `ease-smooth` (`cubic-bezier(0.22, 1, 0.36, 1)`) for transitions.
Animation tokens live in `@theme inline` (`animate-*`):

| Class | Effect |
|---|---|
| `animate-rise` | card fades/rises in (stagger via `animation-delay`) |
| `animate-ring-draw` | progress ring stroke draws |
| `animate-bar-grow` | podium / bar grows from the baseline |
| `animate-breathe` | route loader tile pulses |
| `animate-sweep` | route loader bar sweeps |

Every use is wrapped in `motion-safe:` (`motion-safe:animate-rise`); other
keyframe utilities in globals.css sit inside `prefers-reduced-motion:
no-preference`. With reduced motion the end state is shown immediately.

## Components

shadcn/ui (new-york), icons from lucide-react. Add primitives with
`npx shadcn add <component>` — never hand-roll or fork one.

| Need | Use |
|---|---|
| Buttons / links as buttons | `Button` variants |
| Destructive confirmation | responsive `AlertDialog` — never `window.confirm()` |
| Dialogs on mobile | `ResponsiveDialog` (sheet on small screens) |
| Empty states | `Empty`, `EmptyTitle`, `EmptyDescription`, … (`ui/empty.tsx`) |
| Page header / shell | `PageHeader` + `PageShell` |
| Toasts | sonner `Toaster` — one per mutating action |
| Focus ring | `focus-ring` utility / `ring-ring/50`; `focus-ring-hero` on `bg-hero`, `focus-ring-spotlight` on `bg-spotlight` |
| Icons | lucide-react, size-4/5, no emoji |
| Scrolling strips | `.no-scrollbar` utility |

## Do's and Don'ts

- **Do** use semantic tokens, shared primitives, `focus-ring`, both themes,
  `prefers-reduced-motion` guards on new animations.
- **Don't** hardcode colors, raw `<button>`, native `confirm()`, bespoke
  empty states, emoji-as-icons, or hardcoded dark-mode-unaware colors.

## Czech Cop

Language: `cs`. **NO generic masculine.** Apply these rules in strict order:

1. **NEUTRAL FIRST:** Always attempt neutral phrasing before gendering. Use present tense, direct address, common nouns (`osoba`, `lidé`), or participles (`studující`). *(e.g., "Čekáme na schválení", not "Čekáme na adminy").*
2. **SEPARATOR IS STRICTLY `:`**: If gendering is unavoidable (past tense, specific roles), use **only** a colon (`autor:ka`, `přidal:a`, `koučů:ek`). **NEVER** use `/`, `*`, `_`, or `()`.
3. **ROLES:** Always `Student:ka`, `Mentor:ka`, `Kouč:ka`.
4. **EXCEPTIONS (Do not alter):** Names, quotes, titles, 1st-person plural ("Odeslali jsme"), and data-bound labels (book `Autor` field).
