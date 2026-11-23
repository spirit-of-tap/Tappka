---
name: Tappka
description: Student portal of Tiimiakatemia Prague (TAP). shadcn/ui (new-york) + Tailwind v4 + next-themes. Tokens here mirror src/app/globals.css (light values; dark theme lives there too).
colors:
  primary: "#b31b1b"
  primary-foreground: "#ffffff"
  background: "oklch(0.965 0.012 80)"
  card: "#ffffff"
  sidebar: "#2c1a1d"
  sidebar-primary: "oklch(0.76 0.13 28)"
  foreground: "#2c1a1d"
  secondary: "#2c1a1d"
  muted: "oklch(0.94 0.012 75)"
  accent: "oklch(0.93 0.02 70)"
  destructive: "oklch(0.581 0.223 27.9)"
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
spacing:
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.background}"
    rounded: "{rounded.md}"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
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
(foreground, secondary surface, the app frame), TAP white `#fcfff7` (logo
text on red).

**Frame and sheet (motiv „Plovoucí list“, #212).** On desktop the app is a
brown frame (`--sidebar`, TAP brown in light, near-black in dark) holding a
floating, rounded cream sheet (`--background`) with white cards (`--card`).
The sidebar is dark in both themes, so inside `[data-slot="sidebar"]`
`globals.css` remaps the generic tokens (`--foreground`, `--muted-foreground`,
`--primary`, `--border`, `--card`, …) to the frame. Components rendered in
the sidebar therefore use normal tokens and need no sidebar variants. TAP red
is too dark on brown, so `--primary` in the frame is a light coral
(`--sidebar-primary`); the brand logo tile uses `bg-tap-red` directly. On
mobile there is no frame, the page is the cream sheet. The dashboard header
(greeting + key counts) is a frame-coloured block (`[data-surface="frame"]`
gets the same token remap) that ends in a rounded cream corner, so the sheet
appears to start below it; the same surface is used for the Metriky card and
the training-session date tile. Status
semantics: `success` green, `warning` amber (hue = chart-2), `info` teal
(hue = chart-3), `destructive` red.

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
- Every change must work in both `:root` (light) and `.dark`.

## Typography

Poppins 700 for all headings (`h1`–`h6`, `font-heading`); Roboto
(`font-body`, the default) for body and UI; Pacifico (`font-quote`) only for
decorative brand moments. All webfonts load with `latin-ext` so Czech
diacritics render. Tiptap content has its own scale (see `.tiptap` in
globals.css) — don't override.

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
- Exceptions: dashboard hero greeting (`Vítej, …`, one step larger than
  section titles), auth screens, `/beta` hero, `/reservations/[code]/quick`,
  essay editors (`sr-only h1`), 404.

## Elevation & Depth

Depth comes from layers, not shadows: brown frame → cream sheet
(`rounded-2xl`, 8px inset from the frame) → white cards with 1px `border` +
`rounded-lg`. No heavy shadows. Hover = `accent` tint (`hover:bg-accent`).

## Shapes

Radii come from the `--radius: 0.5rem` scale (see `rounded` tokens).
`rounded-lg` for cards/dialogs, `rounded-md` for inputs/buttons — consistent
per surface type.

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
| Focus ring | `focus-ring` utility / `ring-ring/50` |
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
4. **EXCEPTIONS (Do not alter):** Names, quotes, titles, data-bound fields (e.g., `Autor`), and 1st-person plural (`Odeslali jsme`).deslali jsme", and data-bound labels (book `Autor` field).
