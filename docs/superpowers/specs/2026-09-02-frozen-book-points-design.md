# Frozen book points for pre-cutover essays

## Problem

`books.book_points` was recently recreated/rescored: comparing production
against the retired old system's export (`data/02_09_2026/Sources.csv`), 330
of 528 traceable books (62%) now have a different point value than they had
under the old system. `book_points` is a single live value with no history —
every points calculation in the app reads it fresh on every request, joining
`essays → books.book_points`. This means the rescore silently and
retroactively changed what every already-written essay is worth, for every
student, immediately.

Policy: essays published before **2026-09-03** keep the point value the book
had under the old system (their author already earned that credit and
shouldn't lose it to a later rescore). Essays published on/after 2026-09-03
use the current, live `book_points` value ("new book points count from
09-03").

## Non-goals

- `content_sources.points` (a parallel non-book scoring source essays can
  link to via `essays.content_source_id`) has the identical live-value
  problem, but **`content_sources` does not exist in production yet** — it's
  part of this branch's unshipped work. Out of scope here; extend later if
  needed once that table ships.
- No general-purpose point-versioning system. This is a one-time freeze tied
  to one known rescore event, matching the precedent set by
  `20260611074302_book_points_ai_legacy_and_reason.sql` /
  `20260611081405_apply_effective_book_points.sql` (dual-value + one-time
  backfill, not an ongoing history table).

## Schema drift note

This branch (`feat/beta-cohort-feature-access`) and production have already
diverged: production's `essays` table has no `content_source_id` column (nor
does `content_sources` exist at all), both part of this branch's pending,
unshipped work. The migration this spec adds is purely additive (one nullable
column on `essays`) and doesn't touch or depend on `content_source_id` /
`content_sources`, so it's safe to land and deploy independently of when that
other work ships.

## Design

### 1. New column: `essays.frozen_book_points`

```ts
frozenBookPoints: numeric("frozen_book_points", { precision: 3, scale: 2 }),
```

Matches `books.book_points`'s current type exactly (`numeric(3,2)`, range
0–3 per `books_book_points_check`) — confirmed via `20260718212747_noisy_medusa.sql`,
which reverted an earlier, since-undone `numeric(5,2)` widening.

Nullable. `NULL` means "use the live `books.book_points` value" (this is a
new essay, or its book never existed in the old system, or it has no legacy
value to protect). Non-null means "use this value instead, regardless of what
`books.book_points` currently holds."

`NULL` is also exactly the flag the UI badge needs (see §4) — no separate
marker column.

### 2. One-time backfill

For every essay with `published_at < '2026-09-03'`, resolve a frozen value by
tracing back to the old system, reusing the exact technique validated during
the 21-missing-essays migration:

1. **Essay came from the old system** (`essays.external_id` is set): look up
   that ID in the old `Essays.csv` export → read its `SourceID` → look up
   `SourceID` in `Sources.csv` → `BookPoints`. This is unambiguous per essay
   even where duplicate old book records were later merged into one book,
   because each migrated essay already points at the exact old source row it
   was written against.
2. **Essay was written natively in the new system** (`external_id` is null)
   before the cutover, for a book that originated in the old system: trace
   `essay.book_id → books.external_id` → `Sources.csv` by that ID; if
   `external_id` was overwritten by a later Google Books re-source (as seen
   for 9 of the 21 migrated essays), fall back to exact normalized
   `title_cs` match against `Sources.csv` titles.
3. **No trace found** (book never existed in the old system, or genuinely
   unmatchable): leave `frozen_book_points = NULL`. Nothing to protect — the
   live value is correct because there was only ever one value.

Backfill script follows the pattern of `scripts/essayimport/*.mjs`: dry-run
by default (`DRY=false` to write), reports counts (resolved via essay trace /
resolved via book trace / unresolved), and is idempotent (only touches rows
where `published_at < '2026-09-03' AND frozen_book_points IS NULL`).

### 3. Query changes

Every place that reads `book_points` for a scoring calculation must prefer
`frozen_book_points` when present. Confirmed call sites
(`src/lib/essays/queries.ts`):

- **`getUserBookPointsStats`** (~L1281): add `frozen_book_points` and
  `published_at` to the `bookEssays` select; when populating the `approved`
  Map, use `Number(row.frozen_book_points ?? row.books.book_points)`.
- **`getAuthorsApprovedBookPoints`** (~L1365): same change; select doesn't
  currently include `published_at` — needs adding (see §4, dedup rule).
- **`getTeamBookPointsStats`** (~L1418): structurally different — currently
  tracks only *which* books a profile wrote about (`Set<"book:<id>">`), then
  looks up a flat `book_id → book_points` map afterward, so it has no
  per-essay granularity today. Needs restructuring to carry the resolved
  per-essay value through (see §4), not just book membership.
- **`src/app/api/portfolio/data/route.ts`** (~L105) and
  **`.../portfolio/generate/route.ts`** (~L95): per-essay display, no dedup
  involved — `Number(essay.frozen_book_points ?? book?.book_points ??
  contentSource?.points ?? 0)`.

### 4. Same-book dedup tie-break

The existing dedup (one credit per `(author, book)` pair, via `Map.set`
keyed by `book:<id>`) currently has no explicit ordering — whichever row the
query happens to return last silently wins, which never mattered while
`book_points` was a single live value. It matters now. Rule: **the earliest
essay (by `published_at`) for that `(author, book)` pair determines the
credited value.** Empirically checked against production: 0 of 165
same-author/same-book pairs currently span the 2026-09-03 cutover (nothing to
migrate), but this must be correct going forward as new essays accumulate.

Implementation: when building the per-`(author, book)` map, only overwrite an
existing entry if the new row's `published_at` is earlier than the stored
one's — don't rely on query return order.

### 5. UI: gentle legacy-points indicator

Wherever an essay's point contribution is shown (essay detail page, list/feed
cards, portfolio), show a small non-blocking badge/tooltip when
`frozen_book_points IS NOT NULL` — e.g. "Body za tuto esej jsou zamčené ze
staršího systému." No restriction on editing or removing the essay: essays
are already soft-deleted (`removed_at`), and the points queries already
filter `removed_at IS NULL`, so removing an essay already drops it from the
author's total today — adding a special block for frozen-point essays would
be a new restriction not justified by an actual gap.

## Rollout

1. Add the column to `db/schema/essays.ts`, generate the migration
   (`pnpm db:migrate`), commit schema + migration together.
2. Ship the query/UI changes on this branch.
3. User merges this branch to production (their deploy process).
4. Run the backfill script against production once the column exists there
   (dry-run first, reviewed, then live).

## Testing

- Unit: dedup tie-break (earliest `published_at` wins) with rows returned
  out of order.
- Integration: `getUserBookPointsStats` / `getAuthorsApprovedBookPoints` /
  `getTeamBookPointsStats` each return the frozen value for a pre-cutover
  essay and the live value for a post-cutover essay on the same book.
- Backfill script: dry-run against a fixture CSV pair covering all three
  resolution cases (essay-trace hit, book-trace hit via title fallback,
  unresolved) plus the duplicate-source-merge scenario.
