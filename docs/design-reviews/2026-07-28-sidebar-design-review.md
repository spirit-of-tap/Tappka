# Sidebar Design Review — 2026-07-28

Design review of every page reachable from the app sidebar (Dashboard, Místnosti, Zák. schůzky,
Koučování, Týmová reflexe, Komunita, Čtení, Zpětná vazba), produced by a workflow of 8 parallel
per-page reviews + 1 synthesis pass.

## Overall assessment

The app has real design maturity in its newest, most-iterated feature areas — per-field autosave
with a 3-state save indicator (Týmová reflexe), adaptive responsive dialogs, purpose-built empty
states with icon+copy+CTA, and careful Czech-language microcopy are all genuinely well executed.
Several components (`PersonalProgress`, the conflict-resolution dialog, `TeamReflectionCalendar`)
show real craft beyond template-level UI.

**The gap is consistency, not capability.** The same handful of patterns — status color, empty
state, focus ring, destructive confirmation, toast feedback, page header, container shell — are
each solved correctly in one or two places and then re-solved differently everywhere else, so the
app reads as several well-built features stitched together rather than one coherent design system
in practice. Nearly every "high" severity finding below is an instance of this same failure
mode — a hardcoded color instead of a token, a raw `<button>` instead of the `Button` component, a
native `confirm()` instead of the shared `AlertDialog` — rather than a missing capability.

The primitives needed already exist: design tokens in `globals.css`, the `Empty*` components, the
responsive `AlertDialog`, `sonner` toast conventions, a `Button` with a proper focus ring. The
highest-leverage work is auditing and enforcing their use everywhere, plus building the 2-3 shared
layout components (`PageHeader`, `PageShell`) that are conspicuously missing, rather than adding
any new feature. Since the roadmap has this codebase entering a stabilization/tech-debt-paydown
phase after 2026-10-01, this consistency pass (items 1-8 below) is well-timed to run in that
window.

## Prioritized improvements

| # | Improvement | Affected pages | Effort |
|---|---|---|---|
| 1 | Introduce semantic color tokens and eliminate hardcoded Tailwind colors app-wide | Místnosti, Týmová reflexe, Komunita, Čtení/knihovna, Zpětná vazba | large |
| 2 | Add error/success toast feedback to every mutating action, especially Čtení and Zpětná vazba | Čtení, Zpětná vazba | medium |
| 3 | Standardize `focus-visible` keyboard-focus ring across all custom Links/buttons | Dashboard, Zák. schůzky, Koučování, Komunita, Čtení, Místnosti | medium |
| 4 | Consolidate all empty states onto the shared `Empty*` primitives | Dashboard, Zpětná vazba | small |
| 5 | Replace native `window.confirm()` destructive dialogs with the shared responsive `AlertDialog` | Místnosti | small |
| 6 | Design one shared list-page header pattern (h1 + de-emphasized count + primary CTA) | Zák. schůzky, Koučování, Týmová reflexe, Dashboard | medium |
| 7 | Unify h1 typography scale via a shared `PageHeader` component | All 8 sections | small |
| 8 | Extract a shared page-shell/container component; fix Zpětná vazba's missing horizontal padding | Čtení, Komunita, Zpětná vazba | medium |
| 9 | Backfill missing `loading.tsx` skeletons for data-heavy detail routes | Komunita, Týmová reflexe, Zpětná vazba | small |
| 10 | Fix the cluster of concrete correctness bugs surfaced during review (see below) | Koučování, Místnosti, Týmová reflexe, Dashboard | small |
| 11 | Fix icon-only button accessibility and touch-target size | Dashboard, Koučování | small |
| 12 | Make the primary create/edit interaction in reservations keyboard-reachable | Místnosti | large |

### #10 in detail — concrete bugs, not just polish

- Editing a coaching session fires two stacked "Sezení aktualizováno" toasts (double `toast.success` call).
- Empty-state "Přidat sezení" button on Koučování is wrapped in a `Dialog` with no `DialogContent` — it only works by accident via shared state with another dialog.
- `EditReservationDialog` is mounted twice with identical props inside the same reservation row.
- The "Nová reflexe" CTA can create a monthly team reflection in January/May, violating the app's own semester-only rule for those months.
- A dashboard widget whose render precondition silently fails (e.g. beta access revoked) gets stuck on an infinite loading skeleton instead of an explicit "unavailable" state.

## Cross-page inconsistencies

1. **Hardcoded colors instead of tokens** — the single most repeated finding. `room-card.tsx`'s
   "Volná" and "Obsazeno" badges resolve to nearly the same red hue; `getReservationColorClasses`,
   `ROLE_COLORS`, the semester-reflection violet accent, the `knihovna` status pill, and the
   feedback sticky-note surface all hardcode raw Tailwind colors instead of `primary` / `secondary`
   / `muted` / `accent` / `destructive` / `chart-1..5`. Fixing the token layer once resolves 5+
   high-severity findings at once.
2. **Missing `focus-visible` rings** — whole-card `Link`s, disclosure toggle buttons, and
   icon-only actions across six feature areas don't inherit `Button`'s focus ring
   (`focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]`).
3. **Three competing empty-state implementations** — the shared `Empty/EmptyMedia/EmptyTitle/
   EmptyDescription/EmptyContent` set (used well in schuzky, koucovani, tymova-reflexe,
   prehled-tabs, coach-review-list) vs. a hand-rolled dashed-border block (dashboard) vs. a bare
   `<p>` (feedback board).
4. **Three destructive-confirmation patterns** — the themed responsive `AlertDialog`, a
   differently-worded `AlertDialog`, and native `window.confirm()`, all for the same
   cancel/delete action in reservations.
5. **Toast feedback is all-or-nothing per section** — `sonner` is used in 20+ places
   (dashboard/reservations/tymova-reflexe/schuzky/koucovani) but completely absent from the
   reading section (essays/books/search) and the feedback board, where failures are silent.
6. **Three h1 typography conventions** with no evident rule: plain `text-3xl font-bold`
   (dashboard, reservations, komunita, prehled, portfolio), responsive `text-xl sm:text-2xl
   font-bold tracking-tight` (tymova-reflexe, schuzky, koucovani — the newer beta pages), and a
   flat `text-2xl font-bold` that matches neither (zpetna-vazba).
7. **Oversized passive stat competes with the primary CTA** on three sibling beta pages built in
   the same period (schuzky, koucovani, tymova-reflexe) plus the dashboard's separate toolbar row —
   a large count outweighs both the h1 and the "create new" button, which is stranded alone in its
   own full-width row.
8. **Container padding/max-width is a one-off value per route** with no shared page-shell
   component; Zpětná vazba ships with zero horizontal padding, so content touches the viewport
   edge on mobile.
9. **`loading.tsx` coverage is inconsistent** — some sections have it for every route, some only
   for the index page, some (Týmová reflexe, Zpětná vazba) have none at all despite parallel
   data-fetching on first paint.

---

## Per-page findings

### Dashboard (`/`)

**Strengths**
- All six widgets share one disciplined `Card`/`CardHeader`/`CardTitle`/`CardDescription`/
  `CardAction`/`CardContent` composition — a real visual system, not five one-off card designs.
- No bespoke colors anywhere — verified via grep, every color is a design token.
- Hero heading typography matches other top-level pages (`reservations/page.tsx:89`,
  `reservations/[code]/page.tsx:148`).
- Czech pluralization/grammatical-number copy handled carefully and consistently across widgets.

**Issues**
| Severity | Issue | Location |
|---|---|---|
| high | A widget whose render precondition silently fails (e.g. beta access revoked) shows an infinite loading skeleton instead of an "unavailable" state | `src/app/(main)/page.tsx:119` |
| high | Edit-mode icon buttons override the design system's icon-button size (`size-6`, 24px) instead of using the existing `icon-sm` variant (32px) | `src/components/dashboard/dashboard-editor.tsx:167` |
| medium | Empty-dashboard state hand-rolls markup instead of the shared `Empty*` components used by 3 other list views | `src/components/dashboard/dashboard-editor.tsx:79` |
| medium | Widget-picker's raw `<button>`s have hover styling but no visible keyboard focus ring | `src/components/dashboard/dashboard-editor.tsx:90` |
| medium | Vertical spacing around the widget grid uses three unrelated one-off values (32px/16px/40px) | `src/app/(main)/page.tsx:133` |
| low | Layout edits toast on failure but not on success | `src/components/dashboard/dashboard-editor.tsx:58` |
| low | The edit-mode toolbar row always renders, creating a second top bar even in read mode | `src/components/dashboard/dashboard-editor.tsx:109` |

### Místnosti (`/reservations`, `/reservations/settings`, `/reservations/[code]`)

**Strengths**
- Heading scale is consistent and reused verbatim across all three routes.
- Room grid groups by how the physical space is actually used (TS rooms / Quiet+Repre / D107),
  not a generic alphabetical list.
- `MyReservations`' empty state is purpose-built; the "+N dalších" progressive disclosure avoids a
  cluttered list.
- Genuine care in the mobile drag-to-create interaction: separate long-press (400ms + haptic) vs.
  mouse-drag paths with scroll-lock, tuned to avoid hijacking page scroll.
- The conflict-resolution dialog turns a scheduling collision into a real decision UI
  (book-before / book-after / alternative room) instead of a blocking error toast.

**Issues**
| Severity | Issue | Location |
|---|---|---|
| high | "Volná" (available) and "Obsazeno" (occupied) badges render in nearly the same red hue — the one signal that most needs unambiguous color-coding fails to differentiate | `src/components/reservations/room-card.tsx:31` |
| high | Six unrelated hardcoded color hues (red/purple/blue/emerald/orange/gray) spread across files instead of design tokens | `src/lib/reservations/utils.ts:343` |
| medium | Cancelling a reservation is confirmed via three different UI patterns (themed `AlertDialog`, differently-worded `AlertDialog`, native `window.confirm()`) depending on screen | `src/components/reservations/reservation-detail-dialog.tsx:223` |
| medium | `EditReservationDialog` is mounted twice with identical props in the same row | `src/components/reservations/my-reservations.tsx:209` |
| medium | The core drag-to-create interaction and reservation rows have no keyboard path at all | `src/components/reservations/day-schedule.tsx:498` |
| low | Availability filtering has no loading state between debounce and network round-trip | `src/components/reservations/room-filter.tsx:70` |
| low | Two arbitrary pixel widths (`w-[140px]`, `w-[120px]`) break from the Tailwind spacing scale | `src/components/reservations/room-filter.tsx:232` |

### Zák. schůzky (`/schuzky`, `/schuzky/[meetingId]`) — beta

**Strengths**
- Good empty state using the shared `Empty*` primitives with an icon, a human sentence, and a
  direct CTA — the reference pattern the rest of the app should be judged against.
- Responsive dialogs correctly degrade to a bottom drawer on mobile via the shared
  `ResponsiveDialog` wrapper, used consistently for create and edit.
- Sensible native affordances: `datetime-local` input, disabled+spinner submit state, inline
  field-level validation before hitting the network.
- Consistent Czech toast voice for create/edit/delete.

**Issues**
| Severity | Issue | Location |
|---|---|---|
| medium | Meeting card `Link` has no focus-visible ring, unlike every button in the app | `src/components/customer-meetings/customer-meeting-list.tsx:250` |
| medium | "Nová schůzka" button sits alone on its own row, competing with a large count and an `InfoCard` for visual dominance — nothing signals it's the primary action | `src/app/(main)/schuzky/page.tsx:122` |
| medium | Month-group disclosure `<button>` has no `aria-expanded`/`aria-controls` | `src/components/customer-meetings/customer-meeting-list.tsx:146` |
| medium | "Smazat" trigger uses an ad hoc `text-destructive` className override instead of `variant="destructive"` | `src/components/customer-meetings/customer-meeting-detail.tsx:112` |
| low | Meeting-count Czech pluralization is wrong for values like 22-24 or 32-34 | `src/app/(main)/schuzky/page.tsx:36` |
| low | Collapse/expand toggle uses two different verbs ("rozbalit"/"skrýt") for one action | `src/components/customer-meetings/customer-meeting-list.tsx:158` |
| low | Empty-month placeholder likely under WCAG AA contrast; empty intermediate months add noise | `src/components/customer-meetings/customer-meeting-list.tsx:244` |
| low | Raw Supabase error message can leak into an otherwise fully Czech-localized inline error banner | `src/components/customer-meetings/customer-meeting-form.tsx:91` |
| low | No status signal (completed vs. upcoming) in the meeting detail header | `src/app/(main)/schuzky/[meetingId]/page.tsx:45` |

### Koučování (`/koucovani`) — beta

**Strengths**
- Adaptive dialogs via the shared `ResponsiveDialog` primitive.
- Genuine design-system reuse: header/count layout, `InfoCard` shell, and month-grouped list are
  copy-consistent with sibling features rather than reinvented.
- No bespoke hex values anywhere in the reviewed files.
- Empty state uses the dedicated `Empty*` primitives with a direct CTA.
- Destructive delete is gated behind an `AlertDialog` with a name-bearing confirmation and
  performs a soft delete.

**Issues**
| Severity | Issue | Location |
|---|---|---|
| high | Editing a session fires two stacked "Sezení aktualizováno" toasts | `src/components/individual-coaching-sessions/individual-coaching-session-card.tsx:92` |
| high | Empty-state "Přidat sezení" button is wrapped in a second `Dialog` with no `DialogContent` — only works by accident via shared state | `src/components/individual-coaching-sessions/individual-coaching-session-list.tsx:200` |
| high | Icon-only Edit/Delete buttons lose their accessible name below the `sm` breakpoint (`hidden` text, no `aria-label`) | `src/components/individual-coaching-sessions/individual-coaching-session-card.tsx:127` |
| medium | Edit/Delete buttons shrink to 32px icon-only touch targets on mobile, sitting close together | `src/components/individual-coaching-sessions/individual-coaching-session-card.tsx:124` |
| medium | The session count is the most visually dominant element, not the primary "add session" action | `src/app/(main)/koucovani/page.tsx:37` |
| medium | `InfoCard` states a per-semester expectation but the page only shows an all-time count with no current-semester completion signal | `src/components/individual-coaching-sessions/info-card.tsx:14` |
| low | A session with no notes yet gives no invitation to fill them in | `src/components/individual-coaching-sessions/individual-coaching-session-card.tsx:174` |
| low | Month/"Bez data" toggle buttons have no visible focus-visible style | `src/components/individual-coaching-sessions/individual-coaching-session-list.tsx:155` |

### Týmová reflexe (`/tymova-reflexe`, `/tymova-reflexe/[id]`, `/tymova-reflexe/nova`, `/tymova-reflexe/semestralni/*`) — beta, actively being edited on this branch

**Strengths**
- Per-field autosave with debounce, dirty-field tracking, conflict merge, and a clear 3-state
  indicator — a genuinely well-designed real-time editing model.
- Full-bleed clickable card pattern correctly solves the nested-interactive-element problem with
  an overlay `Link` plus a `pointer-events-auto` escape hatch for the delete button.
- `TeamReflectionCalendar` turns a compliance checklist into real information design: collapsible
  school years, computed ročník labels, and a legend.
- Reuses the app's actual primitives (`Card`, `Empty*`, `AlertDialog`) rather than inventing
  bespoke patterns.

**Issues**
| Severity | Issue | Location |
|---|---|---|
| high | The "Nová reflexe" CTA can create a monthly reflection in January/May, violating the app's own semester-only rule | `src/components/tymova-reflexe/team-reflection-list.tsx:45` |
| medium | Header has two competing focal points — the reflection count outsizes the page's own h1 | `src/app/(main)/tymova-reflexe/page.tsx:39` |
| medium | No loading state anywhere in this route section for server-side data fetches | `src/app/(main)/tymova-reflexe/page.tsx:24` |
| medium | Semester-reflection accent color is raw Tailwind `violet-500`, bypassing the design system's existing `chart-5` token | `src/components/tymova-reflexe/semester-reflection-card.tsx:56` |
| low | Save-state microcopy for the identical dirty state differs between monthly ("Neuloženo") and semester ("Neuložené změny") editors | `src/components/tymova-reflexe/semester-topic-editor.tsx:150` |
| low | Arbitrary `text-[11px]` used instead of the Tailwind type scale, which CLAUDE.md's style guide explicitly flags | `src/components/tymova-reflexe/team-reflection-card.tsx:36` |
| low | Mobile calendar grid (`grid-cols-4` on a 9-month school year) leaves an orphaned single cell on the last row | `src/components/tymova-reflexe/team-reflection-calendar.tsx:147` |

### Komunita (`/komunita`, `/komunita/profil/[id]`, `/komunita/tymy/[id]`)

**Strengths**
- Diacritics-insensitive search correctly handles Czech names ("Kucera" finds "Kučera").
- `TeamBadges` progressively discloses old/removed teams behind a "Staré týmy (n)" toggle instead
  of dumping every team ever created into one row.
- `UserCard` is a single shared component reused across the community directory and every role
  group inside a team page, keeping the person-card visual language identical.
- The profile page distinguishes book-derived essays from free-form ones with a restrained,
  deliberate visual treatment rather than one undifferentiated pile.

**Issues**
| Severity | Issue | Location |
|---|---|---|
| high | Three unrelated hardcoded color systems run in parallel on the profile page (`ROLE_COLORS`, per-team gradient banner, amber "Nad rámec četby" block) | `src/lib/komunita/types.ts:44` |
| high | The two data-heaviest routes in the section have no `loading.tsx`, unlike the directory page | `src/app/(main)/komunita/profil/[id]/page.tsx:29` |
| medium | Clickable Links/cards throughout the section don't share the app's focus-visible ring treatment | `src/components/komunita/user-card.tsx:25` |
| medium | The profile page opts out of the section's shared page shell (`container mx-auto py-6 space-y-6`) with no shared "detail page" abstraction | `src/app/(main)/komunita/profil/[id]/page.tsx:68` |
| medium | Empty/no-results states are descriptive dead ends with no actionable CTA, even though a working "clear search" affordance already exists one line away | `src/components/komunita/komunita-content.tsx:100` |
| low | Competing/duplicated sizing definitions (`h-15` class + inline `style={\{height:'60px'}}`) on the same essay-thumbnail node | `src/app/(main)/komunita/profil/[id]/page.tsx:184` |

### Čtení (`/prehled`, `/hledat`, `/eseje/*`, `/knihovna/*`, `/settings/kniha-knih`) — beta

**Strengths**
- `PersonalProgress` is a genuinely well-crafted piece: a single bar shows approved vs. pending
  points as two tonal layers of the same primary color, milestone ticks, tabular-nums.
- Empty states are treated as an actual UI state almost everywhere, not an afterthought.
- A consistent row/card interaction language (`hover:bg-muted/30|50`, `group-hover:text-primary`,
  `transition-colors`) is reused across five+ components.
- Loading/pending feedback on async actions uses a real `Spinner` and disabled state consistently.

**Issues**
| Severity | Issue | Location |
|---|---|---|
| high | Zero toast/error feedback anywhere in the reading section — publish, approve/reject/remove, and comment-post all fail silently, unlike 20+ other feature areas that use `sonner` | `src/components/essays/essay-editor-form.tsx:57` |
| high | `/hledat` has no `<h1>` or page title at all, unlike every sibling page in the section | `src/components/search/search-page-client.tsx:81` |
| medium | Container padding/max-width is a different one-off value on every page in the section (`py-6` no max-w, `py-10 max-w-2xl`, `max-w-3xl`, `max-w-4xl`, ...) | `src/app/(main)/hledat/page.tsx:81` |
| medium | "Rejected" status color is hand-rolled with raw red/emerald/amber instead of the app's `destructive` token used for the identical concept elsewhere | `src/app/(main)/knihovna/[bookId]/page.tsx:30` |
| medium | Back-link says "Zpět do knihovny" but `/knihovna` redirects to `/hledat`, a leftover from a library→search rename | `src/app/(main)/knihovna/[bookId]/page.tsx:108` |
| medium | Category/team toggle pills have no `aria-pressed`, only a color change | `src/components/search/search-page-client.tsx:100` |
| low | Orphaned component `library-filters.tsx` is never imported anywhere in the codebase | `src/components/books/library-filters.tsx:1` |
| low | Row-as-Link components rely on hover-only affordance with no explicit focus-visible state | `src/components/essays/my-essay-list.tsx:44` |
| low | Inconsistent abbreviation of "no points" ("0 b." vs "0 bodů") for the identical concept | `src/app/(main)/knihovna/[bookId]/page.tsx:164` |
| low | The essay-detail vote CTA introduces a one-off `<style>` keyframe animation system found nowhere else, with no `prefers-reduced-motion` guard | `src/components/essays/essay-vote-button.tsx:64` |

### Zpětná vazba (`/zpetna-vazba`) — footer entry

**Strengths**
- Optimistic client state updates on create/patch/delete give instant UI feedback without a
  refetch.
- Reuses the app's real shadcn primitives (`Tabs`, `Button`, `Textarea`, `Spinner`).
- Deterministic hash-based card tilt gives the "sticky note" metaphor visual variety while
  explicitly avoiding a hydration mismatch.
- Per-tab empty copy is written with intent, inviting action on the active tab specifically.
- Admin-only destructive/state actions are correctly gated and disabled during in-flight requests.

**Issues**
| Severity | Issue | Location |
|---|---|---|
| high | Every write action (post, archive/restore, delete) fails silently — no error handling, no reuse of the app's `sonner` toast pattern | `src/components/feedback/new-feedback-form.tsx:20` |
| high | The floating heart button duplicates the sidebar's "Zpětná vazba" entry and keeps pulsing even while already on the feedback page | `src/components/feedback/floating-feedback.tsx:7` |
| medium | Empty states are a bare paragraph, ignoring the app's own `Empty*` convention used one component over | `src/components/feedback/feedback-board.tsx:43` |
| medium | Page heading (`text-2xl font-bold`) matches neither of the app's two existing h1 conventions | `src/app/(main)/zpetna-vazba/page.tsx:23` |
| medium | No horizontal padding on the page container — content sits flush against the viewport edge on mobile | `src/app/(main)/zpetna-vazba/page.tsx:21` |
| medium | Feedback cards use a full bespoke amber "sticky note" skin that out-shouts the page's actual primary action (the compose box) | `src/components/feedback/feedback-note-card.tsx:62` |
| low | Inconsistent in-flight/loading affordance — the compose form swaps in a `Spinner`, the note-card actions only disable | `src/components/feedback/feedback-note-card.tsx:82` |
| low | Archive tab never surfaces a count, unlike the Active tab | `src/components/feedback/feedback-board.tsx:75` |
| low | No route-level `loading.tsx` despite two sequential DB reads before first paint | `src/app/(main)/zpetna-vazba/page.tsx:15` |
