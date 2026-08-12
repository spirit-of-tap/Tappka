# Schvalování knih koučem: review workbench ve Správě knihovny

**Date:** 2026-08-12
**Status:** Approved design
**Touches:** `src/app/(main)/cteni/sprava/page.tsx`, `src/components/books/coach-dashboard.tsx`, `src/components/books/coach-book-row.tsx` (deleted), new `src/components/books/review-*.tsx`, `src/lib/books/re-enrich.ts`, `tests/e2e/add-book.spec.ts`
**Schema:** unchanged — no migration, no new tables, no new columns
**API:** unchanged — `PATCH /api/books/[id]` keeps all four actions exactly as built

## Problem

The `Ke zpracování` tab of `/cteni/sprava` is where a coach decides whether a
student's book proposal enters BOB. It is rendered by `CoachProcessingRow`, a flat
`border-b` list row. Four failures, only one of them cosmetic:

1. **The AI's suggested score is thrown away.** The add-book flow stores Perplexity's
   score in `books.book_points` and its rationale in `books.list_status_reason`. The row
   hardcodes `useState<1 | 2 | 3>(1)`, so the picker always opens on 1 no matter what the
   AI proposed. The coach never learns there was a suggestion, and the number that ships
   is whatever the default happened to be.
2. **The AI's rationale is silently laundered into the coach's verdict.** `reason` is
   initialised from `book.list_status_reason` — the AI's text — under the label
   *"Důvod ke schválení či zamítnutí"*. Whatever sits in that box at save time is written
   back to `list_status_reason` and emailed to the student by `notifyBookDecided`. The
   coach cannot tell which words are theirs.
3. **Nothing on the screen is editable.** `PATCH action: 'edit'` already accepts
   `title`, `author`, `description`, `tags` and `is_rocket_model`, but the only route to
   it is `/cteni/knihy/[id]/upravit` — a separate page. A coach who spots a mangled title
   must leave the queue and lose their place.
4. **Context that exists is not shown.** `page_count`, `title_en`, `preview_link`, the
   submission date and the tags are all on `BookWithProfiles` and none of them render.
   The cover is 48×64 px and every line of text is `text-xs`.

## Decisions

| Question | Decision |
| --- | --- |
| Layout | Master–detail workbench: a queue rail plus a wide detail panel. |
| Which fields can the coach edit inline? | Exactly what `PATCH action: 'edit'` already supports: `title_cs`, `author`, `description`, `tags`, `is_rocket_model`. No API change. |
| ISBN, page count, cover? | Read-only. They come from enrichment; a coach who needs to fix them uses the full edit page. |
| How is the AI verdict shown? | Its own read-only card — score as pips plus the rationale. |
| Does the coach's reason still prefill from the AI text? | Yes, but explicitly labelled as an AI draft to be edited, and the helper text says it will be emailed to the student. |
| Does the points picker still default to 1? | No. It preselects the AI's suggestion, clamped to 1–3, falling back to 1 when `book_points` is null. |
| Scope | The `Ke zpracování` tab plus the page frame (shell width, header, tab bar). The other five tabs keep their current components. |
| Schema | Unchanged. Preserving the AI verdict past the decision would need new columns; it was considered and rejected as out of scope. |
| Keyboard shortcuts, duplicate detection | Out. Neither was asked for. |

## Page frame

`src/app/(main)/cteni/sprava/page.tsx`:

- `PageShell size="wide"` becomes **`size="full"`**. `wide` resolves to `max-w-4xl`
  (896 px), which cannot hold a rail beside a detail panel. `PageShell`'s own
  `container mx-auto px-3 sm:px-6` still keeps the page off the viewport edges.
- The hand-rolled header `<div>` is replaced by the existing `PageHeader` component:
  `title="Správa knihovny"`, `description`, `action={<Button asChild>…Přidat knihu}`.
- Data fetching is untouched — the same seven parallel queries, the same props into
  `CoachDashboard`.

`src/components/books/coach-dashboard.tsx`:

- `TabsList` gains `overflow-x-auto` with no wrapping. Seven triggers overflow on any
  narrow viewport today.
- Count badges keep their current logic. `destructive` remains on `Ke zpracování` alone —
  it is the only count that means *someone is waiting on you*.
- The `processing` `TabsContent` renders `<ReviewWorkbench>` instead of mapping
  `CoachProcessingRow`. Its empty state moves into the workbench.

## The workbench

`ReviewWorkbench` is a client component receiving the pending books and the dashboard's
existing handlers. It owns exactly one piece of state: `selectedId`.

```
lg:grid-cols-[minmax(240px,300px)_1fr]  gap-6
┌── ReviewQueueRail ──┬── ReviewDetailPanel ──────────────┐
│ sticky, own scroll  │  hero / AI verdict / facts /      │
│                     │  sticky decision bar              │
└─────────────────────┴───────────────────────────────────┘
```

### Queue rail — `review-queue-rail.tsx`

`lg:sticky lg:top-20 lg:self-start`, with `max-h-[calc(100vh-8rem)] overflow-y-auto` so
a long queue scrolls inside the rail rather than pushing the panel down.

- Header: `Fronta · {n} knih` with a muted `nejstarší první` hint, which is what
  `getProcessingBooks` actually orders by (`created_at` ascending).
- Each item is a `<button>`: a 32×44 cover thumb, the title clamped to two lines, the
  author, and a right-aligned AI-score pill rendering `formatPoints(book.book_points)`
  from the existing `src/lib/books/points.ts`, or `—` when `book_points` is null.
  PostgREST returns the `numeric` column as a string, which is exactly what
  `pointsNumber` already guards against.
- The selected item takes `bg-accent` **and** `border-l-2 border-primary`. A background
  tint on its own reads as hover, not selection.

### Detail panel — `review-detail-panel.tsx`

One `Card`, sections divided by `Separator`.

**Hero.** A 112×160 cover (`w-28 h-40`) with `rounded-md ring-1 shadow-sm`, beside:

- `<h2 className="text-xl font-semibold">` for `title_cs`; `title_en` on a lighter line
  below when present and different from `title_cs`.
- The author in `text-sm text-muted-foreground`.
- A row of muted chips: `{page_count} stran`, `ISBN {isbn_13}`, and the source rendered
  as an external link when `external_id` is set — `Google Books`
  (`books.google.com/books?id=…`) or `Open Library` (`openlibrary.org{external_id}`),
  matching the URL construction in the current row. `manual` renders as a plain
  `Ručně` chip. Each chip is omitted when its field is null.
- The submitter: `Avatar` from `created_by.picture`, the name, and the relative
  submission date from `created_at`.
- Top-right: `ListStatusBadge` and `RocketBadge`, both reused unchanged.

**AI verdict — `ai-verdict-card.tsx`.** Rendered only when `book_points` is non-null or
`list_status_reason` is non-empty. A tinted panel (`bg-primary/5 border border-primary/15
rounded-lg p-4`) headed by a `Sparkles` icon and the label `Návrh AI`. The score renders
as three pips filled to the suggested value plus `formatPointsWithLabel(book_points)` —
the existing helper, so the Czech pluralisation (`1 bod` / `2 body` / `5 bodů`) is
correct rather than hardcoded. The rationale renders read-only beneath.

**Facts — the `Údaje o knize` block.** Read-only by default:

- the description through the existing `BookDescription` (it already handles the
  expand/collapse for long text),
- tags as a `Badge` row, or `Bez štítků` when empty,
- Rocket Model as a state line.

An `Upravit` pencil button in the section header swaps the block for `BookEditForm`,
which already renders exactly these five fields and already supports `onSaved` for the
non-navigating case. It gains one new optional prop, `onCancel`, so the workbench can
render `Uložit` beside `Zrušit`; when `onCancel` is absent the form is unchanged, so the
standalone edit page and `BookEditDialog` keep working as-is. On save, the dashboard's
existing `handleEdited` patches `processing` and every other list.

**Decision bar — `review-decision-bar.tsx`.** `sticky bottom-0 bg-card/95 backdrop-blur
border-t`, so the decision stays reachable however long the description runs.

- Label `Rozhodnutí kouče`.
- Points: a `ToggleGroup` of 1/2/3, preselected from the AI's suggestion via a new
  `suggestedBookPoints(book_points): 1 | 2 | 3` in `src/lib/books/points.ts`, which
  rounds through the existing `pointsNumber` coercion and clamps to 1–3, falling back to
  `1` when `book_points` is null or 0. `coach-dashboard.tsx`'s `handleMove` currently
  inlines the same `Math.round(Number(book.book_points ?? 1)) as 1 | 2 | 3` cast; it
  switches to the helper, removing the unchecked cast from a second site.
  A small `návrh AI` marker sits under whichever value the AI proposed, so the coach can
  see at a glance whether they are agreeing or overriding.
- Reason: a `Textarea` labelled `Důvod rozhodnutí *`, prefilled from
  `list_status_reason`, capped at 1000 characters with a live counter. Helper text:
  *"Text je předvyplněn návrhem AI — uprav ho před rozhodnutím. Odešle se studentovi
  e-mailem."* Both halves are true: the prefill is the AI's, and `notifyBookDecided`
  mails the stored reason.
- Actions: a primary `Schválit do longlistu` (`ThumbsUp`) and a destructive
  `Odmítnout` (`ThumbsDown`). `Dohledat údaje` and `Smazat knihu` move into a `⋯`
  `DropdownMenu`, so two buttons carry the decision instead of five competing for it.
- Rejection still writes `book_points: 0` server-side regardless of the picker; the
  picker stays visible and is simply not consulted on that path, exactly as today.

### Auto-advance

After a successful approve or reject the book leaves `processing`, so the current
selection would dangle. The next id is computed from the current list **before** the
handler fires and applied after it resolves; if the decided book was last, selection
falls back to the previous one, and to `null` when the queue empties. This avoids an
effect that watches for a vanished selection.

### Narrow viewports

Below `lg` the grid collapses to one column and the same `selectedId` drives visibility:
with nothing selected the rail is full-width; selecting a book hides the rail and shows
the detail panel with a `← Zpět na frontu` button. No routing, no second state.

### Empty queue

The `Empty` primitive with a `BookOpen` icon: `Fronta je prázdná` /
`Všechny navržené knihy jsou zpracované.`

## Component inventory

| File | Change |
| --- | --- |
| `src/components/books/review-workbench.tsx` | **New.** Grid, `selectedId`, responsive panes, empty state, auto-advance. |
| `src/components/books/review-queue-rail.tsx` | **New.** |
| `src/components/books/review-detail-panel.tsx` | **New.** Hero plus composition of the sections. |
| `src/components/books/ai-verdict-card.tsx` | **New.** |
| `src/components/books/review-decision-bar.tsx` | **New.** |
| `src/lib/books/re-enrich.ts` | **New.** The enrich→PATCH sequence lifted out of `coach-book-row.tsx` so it is testable without a component. |
| `src/lib/books/points.ts` | Gains `suggestedBookPoints`. |
| `src/lib/books/points.test.ts` | **New.** The file currently has no test. |
| `src/components/books/book-edit-form.tsx` | Gains optional `onCancel`. |
| `src/components/books/coach-book-row.tsx` | **Deleted.** |
| `src/components/books/coach-book-row.test.tsx` | **Deleted**; its two cases move to `review-decision-bar.test.tsx`. |
| `src/components/books/coach-dashboard.tsx` | Processing tab renders the workbench; `TabsList` scroll fix. |
| `src/app/(main)/cteni/sprava/page.tsx` | `size="full"` plus `PageHeader`. |

Reused unchanged: `BookRowHeader`, `book-status-badges`, `BookDescription`,
`DeleteBookDialog`, `CategoryPicker`, `StorageImage`, `Spinner`.

## Data flow

`CoachDashboard` keeps owning the `processing` array and every mutation handler.
`classify`, `handleApprove`, `handleReject`, `handleEdited` and `handleDeleted` are
unchanged in signature and behaviour. `ReviewWorkbench` receives:

```
books: BookWithProfiles[]
onApprove: (book, points: 1 | 2 | 3, reason: string) => Promise<boolean>
onReject:  (book, reason: string) => Promise<boolean>
onEdited:  (book: BookWithProfiles) => void
onDeleted: (bookId: string) => void
```

The only new client state anywhere is `selectedId` in the workbench and the form state
already local to `BookEditForm` and the decision bar.

## Error handling

Every mutation keeps today's contract: a `fetch` whose failure raises a `sonner` error
toast and returns `false`, leaving local state untouched so the book stays in the queue.

Two additions:

- The decision buttons stay disabled while `reason.trim()` is empty — as today — **and**
  for as long as the facts block is in edit mode, whether or not anything was typed. A
  coach must not approve a book whose title they are halfway through fixing, and
  "is the form open" is a state the workbench already knows, where "are there unsaved
  changes" would mean diffing form state it does not own.
- `re-enrich.ts` returns a discriminated result rather than toasting internally, so the
  decision bar owns the toast and the test can assert on the return value.

## Testing

**Unit** (`src/lib/books/points.test.ts`, new — the module has no test today):
`suggestedBookPoints` over null, `0`, the PostgREST string form (`"2.00"`), a fractional
legacy value (`0.33` → `1`), and an out-of-range value (`5` → `3`).

**Component** (`src/components/books/*.test.tsx`, run by `pnpm test`):

- `review-decision-bar.test.tsx` — the points toggle preselects from `book_points`;
  the reason prefills from `list_status_reason`; approve and reject are both disabled on
  an empty reason; `Dohledat údaje` fires the enrich call then the `action: 'edit'` PATCH
  carrying the fresh description. The last two assertions are the two cases ported from
  the deleted `coach-book-row.test.tsx`, so no coverage is lost.
- `review-queue-rail.test.tsx` — renders every pending book, marks the selected one,
  calls `onSelect` on click.
- `review-workbench.test.tsx` — a successful decision advances the selection to the next
  book; the empty state renders when the queue is empty.

**E2E** (`tests/e2e/add-book.spec.ts`): the coach block at lines 181–208 currently finds
its controls through `#reason-${bookId}` plus two `locator('..')` hops. It is rewritten
to click the book by title in the queue rail and then act on the decision bar through
role and name queries. Its assertions are unchanged — the stored `book_points` is the
coach's `1`, `list_status` becomes `longlist`, and the detail page renders `1 bod`.

`re-enrich.ts` gets no unit test of its own — it is a two-`fetch` sequence with no
branching logic beyond error propagation, and the decision-bar component test already
asserts on both calls. Everything else in this change is rendering, so nothing further
belongs in the unit layer.
