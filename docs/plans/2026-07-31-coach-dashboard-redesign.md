# Coach book dashboard redesign (2026-07-31)

## Problem

The coach dashboard's current tabs don't match the real workflow:

- "Ke zpracování" rows don't show the book description ("what it is / why read it"),
  and the primary actions aren't approve/reject.
- Shortlist and longlist books are invisible after classification — the coach can't
  review, re-classify, change points, or delete them.
- Deleting a book silently orphans its essays (`essays.book_id` FK is `ON DELETE SET NULL`).
  Duplicates can't be removed and their essays rerouted to the original book.
- "Výběr" has no way to add books by searching, and no counts.

## Decisions (confirmed with user)

- Full essay reroute on delete: DB function + migration + API + dialog with book search.
- Processing approval: coach picks points 1–3 at approval time; no auto-recommendation.
- Longlist is a table: columns Titulek, Autor, Body, Eseje, Status.

## Design

### DB function (custom migration)

```sql
reassign_essays_to_book(
  p_source_book_id uuid,
  p_target_book_id uuid,
  p_updated_by_profile_id uuid
) RETURNS integer
```
`SECURITY DEFINER`, `SET search_path TO ''`. Updates `public.essays` SET
`book_id = p_target_book_id, updated_at = now(), updated_by_profile_id = ...`
WHERE `book_id = p_source_book_id`. Returns number of moved essays.
Migration: `20260731132644_red_lila_cheney.sql` (created via `db:generate:custom`).

### API changes

- `DELETE /api/books/[id]` — accept optional body `{ reroute_to_book_id?: string }`.
  When provided: validate target exists, call `reassign_essays_to_book`, then delete.
- New `PATCH /api/books/[id]` action `points` — validate 1–3, update `book_points`
  (+ `updated_by_profile_id`). Used by the ⋮ menu; doesn't touch `list_status`.
- `GET /api/books` — support `status=all` to search across every status (for
  reroute book search + category search-add).
- New `GET /api/books/[id]/essays-count` — active essay count (`removed_at IS NULL`)
  for the delete warning.

### Queries

- `getShortlistedBooks` / `getLonglistedBooks` select from `books_with_essay_count`
  view (proven pattern from `getBooks` popular sort) so the table gets real
  `essay_count`.

### Components

- **`coach-processing-row.tsx`** (replaces `coach-book-row.tsx` role in the
  processing tab): shows description via `BookDescription`, tags, "Přidal/a".
  Points selector 1–3. Primary actions: **Schválit** (→ longlist, primary) and
  **Odmítnout** (→ archived, 0 b, destructive). Secondary: "Do výběru" (category
  select) and delete via shared dialog.
- **`coach-list-table.tsx`** (new, shortlist + longlist): table view with cover,
  title, author, body, essays, and a primary action per list —
  longlist: **Do shortlistu**; shortlist: **Do longlistu**. A ⋮ menu contains:
  Změnit body (points dialog), Upravit (edit dialog), Smazat (delete dialog).
- **`delete-book-dialog.tsx`** (new, shared): fetches active essay count. If > 0,
  shows warning that essays lose their source, plus an optional "Přesměrovat eseje
  na jinou knihu" search (finds original book via `/api/books?q=..&status=all`).
  Confirm calls DELETE with `reroute_to_book_id` when chosen.
- **`points-dialog.tsx`** (new): 1–3 selector → `action: 'points'`.
- **`book-edit-dialog.tsx`** (new): embeds `BookEditForm` with an optional
  `onSaved` callback (avoids the current router.push detail-page redirect).
- **`category-book-search.tsx`** (new, Výběr tab): search input → book results →
  pick category → add (highlight action). Excludes already-highlighted books.
  Shows total + per-category counts.
- **`coach-dashboard.tsx`**: wire new rows/table, per-category counts in Výběr,
  essay counts from view, delete dialog state, points/edit dialogs.

### Tabs (final order)

1. Ke zpracování — approve (points 1–3 → longlist) / reject (→ archived 0 b) /
   highlight / delete-with-reroute
2. Shortlist — table, demote to longlist, points/edit/delete in ⋮
3. Longlist — table, promote to shortlist, points/edit/delete in ⋮
4. Výběr — category manager + search-add + counts, remove from category
5. Archivované — read-only list with delete

## Edge cases

- Reroute target must exist; target ≠ source enforced by UI (source excluded from search).
- Deleted books with rerouted essays: essays now point to the original book.
- Archived (rejected) books get 0 points (already enforced by schema check).
- No categories yet → "Do výběru" shows hint to create one first.

## Testing

- Unit: `points.ts` untouched; no new pure logic beyond API validation.
- Integration: RLS allows coach to delete books; function is SECURITY DEFINER so
  it bypasses essay RLS. Add integration test for `reassign_essays_to_book`
  (coach moves essays of another author → allowed) and delete-with-reroute.
- E2E: dashboard flow approve/reject, promote/demote, delete-with-reroute.
