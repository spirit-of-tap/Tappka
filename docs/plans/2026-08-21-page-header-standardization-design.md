# Page Header Standardization — Design

Date: 2026-08-21
Status: approved

## Problem

Audit of all 46 pages found only 12 use the shared `PageHeader`. The rest
hand-roll headers in five competing patterns: hand-copied `h1`+`p` markup,
bespoke `text-3xl` titles, entity hero headers with four different back-link
styles, `h2`-as-page-title (dashboard, reservations), and pages with no header
at all (`/reservations`). Descriptions mix tykání/vykání, trailing periods come
and go, counts are displayed three different ways, and 27 pages have no
`metadata` while several rendered descriptions silently diverge from their
metadata.

## Decisions

- **Approach:** evolve the existing `PageHeader` primitive into a mobile-first,
  native-feel header system (large title, back row, right-aligned count and
  action). No sticky bars, no scroll-collapse JS.
- **Tone:** tykání everywhere; gender-neutral per inclusive-czech-writing
  (colon pairs); present tense.
- **Copy rules:** one sentence, no trailing period, ≤ ~90 chars, sentence case.
- **Counts:** always through `count:` with `pluralizeCz`.
- **Metadata:** rendered description === `metadata.description`; every migrated
  page exports metadata; detail pages keep static descriptions (no
  `generateMetadata`).

## Component changes

```tsx
interface PageHeaderProps {
  title: string
  description?: string
  count?: { value: number; label: string }
  action?: ReactNode
  back?: { href: string; label: string } // NEW — renders PageBack above title
}
```

New `src/components/ui/page-back.tsx`: chevron-left + label link,
`text-sm text-muted-foreground`, ≥44px tap height, `className` passthrough for
hero overlays.

Visual spec:

| Element    | Mobile                                   | Desktop        |
| ---------- | ---------------------------------------- | -------------- |
| Back row   | chevron + label, muted, above title      | same           |
| Title      | `text-2xl` Poppins bold tracking-tight   | `sm:text-3xl`  |
| Description| `text-sm` muted                          | same           |
| Count/action| right-aligned on title row, wraps below | aligned right  |

Fixes baked in: `font-heading` on the `h1` (DESIGN.md compliance), heading
level always `h1`, visible labels on all back links.

## Archetypes

1. **Standard pages** — `<PageShell>` + `<PageHeader>`: `/moduly`,
   `/nastroje-techniky`, `/koucovani`, `/profil`, `/schuzky`,
   `/tymova-reflexe`, `/tymovy-denik`, `/tymove-dokumenty`, `/birth-giving`,
   `/cteni/sprava`; conversions from bespoke markup: `/komunita`,
   `/cteni/prehled`, `/portfolio`, `/settings/notifikace`,
   `/cteni/eseje/ke-kontrole`; new header on `/reservations`.
   Raw `container mx-auto` wrappers move to `PageShell`.
2. **Create forms** — `PageHeader back=…`: `/birth-giving/nova`,
   `/birth-giving/historie/nova`, `/tymova-reflexe/nova`,
   `/tymova-reflexe/semestralni/nova` (gain missing back rows), vykání → tykání.
3. **Detail pages** — `PageBack` + existing hero: book detail, `/pujcit`,
   team, profile, meeting, both reflexe details, birth-giving event.
4. **Exceptions** (documented): auth screens, `/beta` hero,
   `/reservations/[code]/quick` kiosk, essay editors (`sr-only h1` by design),
   dashboard greeting becomes `h1`.

## Implementation order

1. `PageBack` + evolved `PageHeader` (+ component tests)
2. Compliant pages: containers → `PageShell`, punctuation/copy pass
3. Bespoke → `PageHeader` conversions (index/create)
4. Detail pages → `PageBack`
5. `/reservations` header, metadata additions
6. Verify: `pnpm test`, typecheck, light+dark, 375px + desktop sweep

## Verification checklist

- Every touched page at 375px and ≥1280px, both themes
- One `h1` per page, Poppins headings
- `pnpm test` green, typecheck green
