# Schvalování knih koučem: review workbench ve Správě knihovny

**Date:** 2026-08-12
**Status:** Approved design — revised 2026-08-12 after review of the first build
**Revision:** The decision bar is no longer sticky; the AI verdict moved into it and
is confirm-or-edit rather than prefill-plus-card; and the score now carries the
verdict (0 rejects, 1–3 approve) instead of two separate buttons. See
[The decision bar](#decision-bar).
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
| How is the AI verdict shown? | A read-only card at the foot of the panel, inside the decision bar. The coach confirms it in one click or switches to editing — the card and an input never show the same text at once. |
| Does the coach's reason prefill from the AI text? | Only on entering edit mode, where the card is gone. Confirming submits the AI's rationale as written. |
| What values can the coach assign? | 0, 1, 2 or 3. **0 is the rejection** — there is no separate reject button; the score is the verdict. |
| Does the points picker still default to 1? | No. It preselects the AI's suggestion verbatim, including a suggested **0**, which previously rounded up to 1 and silently turned a refusal into an approval. With no suggestion at all it preselects nothing. |
| Is the decision bar sticky? | No. It sits at the foot of the panel and scrolls with it. |
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

- The tab bar switches to `variant="line"`. A segmented pill container holding seven
  long labels is a wall; an underline bar reads as page navigation and survives any
  number of sections. `TabsList` now owns its own overflow (`max-w-full overflow-x-auto
  no-scrollbar`), so the bar scrolls without the visible track the first build showed.
- The seven near-identical `TabsTrigger` blocks collapse into a `tabs` array, and the
  six hand-tuned count `Badge`s become `TabsTriggerCount`. `tone="attention"` is spent
  on `Ke zpracování` alone — it is the only count that means *someone is waiting on you*,
  and making every count red would mean none of them reads as urgent.
- The `processing` `TabsContent` renders `<ReviewWorkbench>` instead of mapping
  `CoachProcessingRow`. Its empty state moves into the workbench.

## The workbench

`ReviewWorkbench` is a client component receiving the pending books and the dashboard's
existing handlers. It owns exactly one piece of state: `selectedId`.

```
lg:grid-cols-[minmax(240px,300px)_1fr]  gap-6
┌── ReviewQueueRail ──┬── ReviewDetailPanel ──────────────┐
│ stretches to match, │  hero / facts / decision bar      │
│ scrolls inside      │  (AI verdict lives in the bar)    │
└─────────────────────┴───────────────────────────────────┘
```

### Queue rail — `review-queue-rail.tsx`

The two columns are exactly the same height, and **the panel is the only thing that sets
it**. From `lg` up the rail's grid cell is `relative` and the rail itself is
`absolute inset-0`, so the rail is out of flow and its own length never contributes to
the row: 5 books or 500, it renders as tall as the panel beside it. The rail is a flex
column whose list takes `flex-1 min-h-0 overflow-y-auto`, so it scrolls inside itself
past that point. The panel takes `h-full` for the reverse case, keeping the decision bar
at the bottom of the card rather than floating mid-column when a book is short.

A `max-h` cap on the rail was tried first and is wrong: it bounds the rail *below* the
row height, so a panel taller than the cap leaves the rail visibly short — the same
mismatch, plus an inner scrollbar the panel does not have.

Below `lg` none of this applies: the rail is static, the column has no imposed height,
`flex-1` resolves to the list's own height, and the rail scrolls with the page.

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

The panel borrows the book detail page's visual language so the two screens read as one
product: the same `aspect-[2/3] rounded-xl shadow-lg ring-1 ring-border/50` cover, the
same `rounded-full bg-muted` metadata pills, the same `MetaItem` icon rows, and the same
`border-t border-border/60` section rule.

**Hero.** `flex-col sm:flex-row` — the cover centres above the text on a phone and moves
beside it from `sm` up. It is `w-32 sm:w-40`, beside:

- `title_cs` as a `text-2xl font-bold tracking-tight` link to the book's detail page;
  `title_en` on a lighter line when present and different; the author at `text-lg`.
- A pill row: tags (through `BOOK_CATEGORY_LABELS`), `ISBN {isbn_13}`, and the source —
  rendered as an external link when `external_id` is set, `Google Books`
  (`books.google.com/books?id=…`) or `Open Library` (`openlibrary.org{external_id}`).
  `manual` renders as a plain `Ručně zadáno` pill. Each pill is omitted when its field
  is null.
- A meta row: `{page_count} stran` and the submitter — `ProfileAvatar` from
  `created_by.picture`, the name, and the submission date.
- Top-right: `ListStatusBadge` and `RocketBadge`, both reused unchanged.

**Facts — the `Údaje o knize` block.** Read-only by default:

- the description through the existing `BookDescription` (it already handles the
  expand/collapse for long text),
- Rocket Model as a state line. Tags live in the hero pill row, where the book detail
  page also puts them.

An `Upravit` pencil button in the section header swaps the block for `BookEditForm`,
which already renders exactly these five fields and already supports `onSaved` for the
non-navigating case. It gains one new optional prop, `onCancel`, so the workbench can
render `Uložit` beside `Zrušit`; when `onCancel` is absent the form is unchanged, so the
standalone edit page and `BookEditDialog` keep working as-is. On save, the dashboard's
existing `handleEdited` patches `processing` and every other list.

<a id="decision-bar"></a>
### Decision bar — `review-decision-bar.tsx`

At the foot of the panel, scrolling with it. Not sticky: a bar pinned over a long
description competes with the thing the coach is reading to make the decision.

**The score is the verdict.** `book_points` runs 0–3, where **0 rejects the book**. There
is no separate reject button — the picker decides which list the book lands on, and the
single call to action restates it:

| Points | List | Call to action |
| --- | --- | --- |
| 0 | `archived` | `Zamítnout knihu` (destructive, `ThumbsDown`) |
| 1–3 | `longlist` | `Schválit do longlistu` (`ThumbsUp`) |

`CoachDashboard.handleDecide` performs that branch; the classify route already enforces
the same pairing, forcing `book_points: 0` on `archived` and refusing 0 elsewhere.

**Confirm or edit — never both.** The bar has two states, which is what keeps the AI's
rationale from appearing twice at once:

- *Confirm* (the default when the book carries a **complete** suggestion — a score
  **and** a rationale): the read-only `AiVerdictCard` plus the call to action and an
  `Upravit rozhodnutí` button. One click accepts the AI's score and its rationale as
  written. A half-suggestion is not confirmable — a button that claims everything is
  ready over an empty required field is a lie — so the bar opens in edit mode instead.
- *Edit*: the verdict card is replaced by a `ToggleGroup` of 0/1/2/3 and a `Textarea`,
  both seeded from the suggestion so the coach adjusts rather than retypes. A dot marks
  whichever value the AI proposed. `Zpět k návrhu AI` restores the untouched suggestion.

**Points helpers.** `suggestedReviewPoints(book_points): 0 | 1 | 2 | 3 | null` is new in
`src/lib/books/points.ts`. It preserves a stored 0 — the rubric's Výjimka C/D use it to
mean *reject*, and rounding it up to 1 would silently flip a refusal into an approval —
and returns `null` when nothing scored the book, so no suggestion is invented for a
manually filled entry. The existing `suggestedBookPoints` keeps its 1–3 clamp for list
moves, where 0 is not on the table; `coach-dashboard.tsx`'s `handleMove` inlines the same
`Math.round(Number(book.book_points ?? 1)) as 1 | 2 | 3` cast today and switches to it,
removing the unchecked cast from a second site.

**Reason.** `Textarea` labelled `Důvod rozhodnutí *`, capped at 1000 characters with a
live counter, helper text *"Odešle se studentovi e-mailem."* — true, `notifyBookDecided`
mails the stored reason.

**Overflow.** `Dohledat údaje` and `Smazat knihu` sit in a `⋯` `DropdownMenu`, so one
button carries the decision instead of five competing for it.

### Auto-advance

After a successful decision the book leaves `processing`, so the current
selection would dangle. The next id is computed from the current list **before** the
handler fires and applied after it resolves; if the decided book was last, selection
falls back to the previous one, and to `null` when the queue empties. This avoids an
effect that watches for a vanished selection.

### Narrow viewports

Below `lg` the grid collapses to one column and the same `selectedId` drives visibility:
with nothing selected the rail is full-width; selecting a book hides the rail and shows
the detail panel with a `← Zpět na frontu` button. No routing, no second state.

Three details make that more than a reflow:

- The rail's inner scroller (`max-h` + `overflow-y-auto`) is `lg:`-only. Below that the
  rail *is* the page, and a nested scroll area inside a scrolling page is a trap.
- Selecting a book from partway down the rail would otherwise open the panel mid-scroll,
  so the workbench calls `scrollIntoView` on the panel when the viewport is under
  `1024px`. The same call runs after every decision at any width — the decision bar is at
  the foot of a tall panel, so a coach who just decided is parked at the bottom.
- The hero stacks (`flex-col sm:flex-row`), the cover steps down to `w-32`, and the two
  decision buttons take `flex-1 sm:flex-none` so they fill the width of a phone instead
  of wrapping awkwardly.

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
| `src/lib/books/points.ts` | Gains `REVIEW_POINT_VALUES`, `ReviewPoints` and `suggestedReviewPoints`. |
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
`classify`, `handleEdited` and `handleDeleted` are unchanged. `handleApprove` and
`handleReject` collapse into one `handleDecide` that branches on the score, since the
score now carries the verdict. `ReviewWorkbench` receives:

```
books: BookWithProfiles[]
onDecide:  (book, points: 0 | 1 | 2 | 3, reason: string) => Promise<boolean>
onEdited:  (book: BookWithProfiles) => void
onDeleted: (bookId: string) => void
```

The only new client state anywhere is `selectedId` in the workbench and the form state
already local to `BookEditForm` and the decision bar.

## Error handling

Every mutation keeps today's contract: a `fetch` whose failure raises a `sonner` error
toast and returns `false`, leaving local state untouched so the book stays in the queue.

Two additions:

- The call to action stays disabled while no score is picked or `reason.trim()` is empty
  — as today — **and** for as long as the facts block is in edit mode, whether or not
  anything was typed. A coach must not decide a book whose title they are halfway through
  fixing, and "is the form open" is a state the workbench already knows, where "are there
  unsaved changes" would mean diffing form state it does not own.
- `re-enrich.ts` returns a discriminated result rather than toasting internally, so the
  decision bar owns the toast and the test can assert on the return value.

## Testing

**Unit** (`src/lib/books/points.test.ts`, new — the module has no test today):
`suggestedReviewPoints` over null/undefined (no suggestion), a stored `0` and `"0.00"`
(stays a rejection), the PostgREST string form (`"2.00"`), fractional legacy values
(`0.33` → `0`, `1.5` → `2`), and out-of-range values (`5` → `3`, `-1` → `0`). Plus
`suggestedBookPoints`, which must never return 0 because a list move cannot reject.

**Component** (`src/components/books/*.test.tsx`, run by `pnpm test`):

- `review-decision-bar.test.tsx` — the bar opens in confirm mode on a complete
  suggestion and shows no duplicate input; confirming submits the AI's score and
  rationale unchanged; a score with no rationale is not confirmable; a suggested **0**
  produces `Zamítnout knihu` and submits `0`; picking 0 in edit mode flips the call to
  action; edit mode seeds from the suggestion and `Zpět k návrhu AI` restores it; the
  decision is blocked on an empty reason and while the facts form is open;
  `Dohledat údaje` fires the enrich call then the `action: 'edit'` PATCH carrying the
  fresh description. That last case is ported from the deleted
  `coach-book-row.test.tsx`, so no coverage is lost.
- `review-queue-rail.test.tsx` — renders every pending book, shows the AI score (and a
  dash where there is none), marks the selected one, calls `onSelect` on click.
- `review-workbench.test.tsx` — opens on the head of the queue, follows a rail pick, a
  successful decision advances the selection, a failed one does not, and the empty state
  renders when the queue is empty.

**E2E** (`tests/e2e/add-book.spec.ts`): the coach block currently finds its controls
through `#reason-${bookId}` plus two `locator('..')` hops. It is rewritten to click the
book by title in the queue rail, switch out of confirm mode via `Upravit rozhodnutí`,
then act through role and name queries — which also asserts the picker opened on the
AI's `2` before the coach overrides it. Its outcome assertions are unchanged: the stored
`book_points` is the coach's `1`, `list_status` becomes `longlist`, and the detail page
renders `1 bod`.

`re-enrich.ts` gets no unit test of its own — it is a two-`fetch` sequence with no
branching logic beyond error propagation, and the decision-bar component test already
asserts on both calls. Everything else in this change is rendering, so nothing further
belongs in the unit layer.
