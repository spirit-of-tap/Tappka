# Content sources for essays (beyond books)

## Problem

Essays can currently only be written about `books` (`essays.book_id`). Students
also need to write essays about podcasts, conferences, leadership programs,
and similar learning sources, and earn points for them the same way they do
for books.

## Motivation

Concrete near-term need: students already consume podcasts, conferences, and
programs as part of their development and want essay/point credit for them.
The current book-intake flow explicitly rejects non-book content.

## Scope decision

This is additive. The `books` table, its routes (`/cteni/knihy`), its
enrichment pipeline, and every file under `src/lib/books/` and
`src/components/books/` stay untouched. A new, separate concept — a
"content source" — is introduced for everything that isn't a book.

## Approaches considered

**A — new table + second nullable FK on `essays` (chosen).** A new
`content_sources` table for podcast/conference/program/other. `essays` gets a
second nullable FK, `content_source_id`, alongside the existing `book_id`.

**B — fully polymorphic `essays.source_type` + `source_id`, dropping the
dedicated `book_id` FK.** Rejected: Postgres can't enforce a FK that
conditionally points at different tables depending on a type column. Doing
this properly needs trigger-based integrity checks in place of a real FK, and
it touches the existing `book_id` relationship for no functional gain.

**C — parallel `content_essays`/`content_essay_revisions`/etc. tables.**
Rejected: an essay's comments, votes, coach-reads, and view tracking should
behave identically no matter what it's about. Duplicating five child tables
and their UI (tiptap editor, voting, commenting) to avoid a second nullable
FK is not worth it.

## Data model

### New table: `content_sources`

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `kind` | enum `content_source_kind` (`podcast \| conference \| program \| other`) | extendable later via migration |
| `title` | text NOT NULL | |
| `creator` | text, nullable | podcast host / program provider |
| `description` | text, nullable | |
| `external_url` | text, nullable | |
| `points` | numeric(3,2), nullable | student self-assigns at submission; same allowed value set as book points |
| `status` | enum `content_source_status` (`pending_review \| approved \| archived`) | default `pending_review` |
| `created_by_profile_id` | uuid FK→profiles | submitter |
| `reviewed_by_profile_id`, `reviewed_at` | nullable | coach who approved/adjusted |
| audit columns | `created_at`, `updated_at`, `updated_by_profile_id` | matches existing convention |

No cover-image column: the UI shows a **predefined illustration selected by
`kind`** (a static asset map in the frontend, not a stored URL).

RLS mirrors `books`: authenticated users can view all rows (needed for the
shared catalog/search); authenticated users insert their own; only
coach/admin can update (approve, override points, archive) or delete. Enable
RLS on the new table per project convention.

### `essays` changes

- Add `content_source_id` uuid, nullable, FK→`content_sources` ON DELETE SET
  NULL — same shape as the existing `book_id`.
- `CHECK (NOT (book_id IS NOT NULL AND content_source_id IS NOT NULL))` — an
  essay is about at most one thing. Both null stays valid (this already
  happens today when a linked book is deleted via `ON DELETE SET NULL`, and
  the check must not break that).

### Points aggregation

A SQL view, `essay_points(essay_id, points)`, is the union of:
- published essays joined through `book_id` → `books.book_points`
- published essays joined through `content_source_id` → `content_sources.points`

Dashboard/progress queries (yearly point goal, team charts) read from this
view instead of joining `books` directly, so a podcast/conference/program
essay counts toward the same yearly total as a book essay.

## Review workflow

- No AI enrichment/scoring for content sources — that pipeline
  (`src/lib/books/enrichment/`) stays book-only. Points here are manually
  assigned.
- At submission, the student picks `kind`, fills title/creator/description/
  link, and assigns points from the same allowed value set books use. The
  points field defaults to **0.5 when `kind = podcast`** — a frontend-only
  form default, not a DB default or constraint; the student can change it
  before submitting, and other kinds have no pre-filled default.
- New coach review queue for `content_sources` with `status = pending_review`
  — parallel to, not merged with, the existing essay coach-review inbox. The
  coach approves/adjusts the student's self-assigned points and flips status
  to `approved` (or `archived`).

## UI / routes

- New route `/cteni/zdroje` (new catalog/list + add flow for content
  sources), parallel to `/cteni/knihy`.
- Existing unified search (`/cteni/hledat`) gains a second, clearly labeled
  section for content sources rather than merging the two lists — sources
  are discoverable from the same page but visually separate from books, per
  the "catalog, search, but separately" requirement.
- Essay creation flow: alongside "pick a book," a student can "pick a
  content source" (or add a new one inline) when starting an essay.

## Types & display layer

- `ContentSource = Tables<'content_sources'>` — DB-derived, same pattern as
  `Book`.
- `EssayWithDetails` gains an optional `contentSource` field alongside the
  existing `book` field; exactly one of the two is populated (or neither, for
  an orphaned essay).
- A new helper, `getEssaySourceDisplay(essay)`, returns
  `{ title, author, points, illustrationKind }` regardless of which source is
  set. `essay-card.tsx`, the essay editor header, and any other place that
  currently reads `essay.book.*` switch to this helper instead of branching
  on `book` vs `contentSource` inline.

## Testing

- Unit tests for `getEssaySourceDisplay` (book case, content-source case,
  orphaned case).
- Integration tests: `content_sources` RLS (view/insert/coach-update), the
  new `essays` check constraint (rejects both FKs set, allows either alone or
  neither), and the `essay_points` view's union behavior.
- Component test updates for `essay-card`/essay editor covering the
  content-source case in both themes.

## Out of scope

- AI enrichment/auto-scoring for content sources.
- Type-specific metadata fields (episode number, duration, institution,
  etc.) — the generic shape (title/creator/description/link/points) covers
  all kinds for now.
- Merging or renaming anything under the existing `books` concept.
