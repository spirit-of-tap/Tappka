# Individuální koučování Redesign — Design

**Date:** 2026-08-22 · **Scope:** `/koucovani` page rebuilt on the shared system established by `/schuzky`.

## Why people visit

1. **Compliance** — school requires coaching logs (case #1).
2. **Before next coaching** — revisit previous action steps (akční kroky are self-made TODOs).
3. **Pattern reflection** — recurring themes across months; served by search.

Data insight: extreme length variance (one-liners → structured essays). Same coach repeats often → rows need previews to be tellable apart.

## Content hierarchy

1. **Akční kroky** — forward-looking commitments; the revisit-worthy part.
2. **Co jsem si odnesl** — insight archive for depth.
Preview = first meaningful line of takeaways; fallback to actions when takeaways empty.

## Page layout (top → bottom)

- `PageHeader` — title, count via pluralizeCz, ⓘ help dialog (old InfoCard copy inside), create: header button (≥sm) + mobile FAB above tab bar (`bottom-[calc(5.25rem+env(safe-area-inset-bottom))]`), single shared dialog, two triggers.
- `MetricProgress` — new metric `individual-coaching`: target 1/semester ("alespoň jedno sezení za semestr").
- Search input — client-side over coach name/takeaways/action steps; non-matching months hidden while searching.
- Timeline — `MonthSection` newest-first, **empty months skipped entirely**.
- Row (collapsed) — `ProfileAvatar` if picture else initials disc · name (font-medium) · date pill `[DD.MM.]` · preview line (muted, clamped) · chip right (**Chybí poznámky** warning / **Bez data** outline) · ⋮ overflow (Upravit → existing form dialog; Smazat → AlertDialog confirm).
- Expanded row — tap toggles inline panel: labeled blocks "Co jsem si odnesl" then "Akční kroky", full text, whitespace-pre-wrap. Multiple rows may be open simultaneously.

## Open-loop status (new `status.ts`)

- undated → Bez data (outline)
- dated + empty key_takeaways → Chybí poznámky (warning tint)
- filled → null (calm)
- No planned state; form rejects future dates (max + validation + noValidate).

## Metric config addition

```ts
"individual-coaching": {
  label: "Individuální koučování",
  period: "semester",
  target: 1,
}
```

## Files

| Action | File |
|---|---|
| Create | `src/lib/individual-coaching-sessions/status.ts` + `.test.ts` |
| Create | `src/components/individual-coaching-sessions/individual-coaching-session-row.tsx` + test |
| Create | `src/components/individual-coaching-sessions/individual-coaching-sessions-view.tsx` + test |
| Modify | `src/lib/metrics/config.ts` (+ individual-coaching entry, test) |
| Modify | `customer-meeting-form`-style future guard → `individual-coaching-session-form.tsx` |
| Delete | `individual-coaching-session-list.tsx`, `individual-coaching-session-card.tsx` |
| Rewrite | `src/app/(main)/koucovani/page.tsx` (server shell → view) |

## Data flow / testing

Server page: auth → listIndividualCoachingSessions + listCoachProfiles → semester count → pass stable `now`. View state: search, expanded-id set, dialogs. Optimistic prepend on create; in-place update on edit; remove on delete.

TDD per task; full unit+component suite, typecheck, lint, production build green before commits.
