# Replace Wrong Google Books Record

Date: 2026-08-12

## Background

A book can end up in the library with the wrong Google Books volume attached (e.g. a
different edition was picked during add-book search). The stored `google_books_cover_url`
and `isbn_13` then point at the wrong record. The coach needs to re-search, pick the
correct version, and have the cover + ISBN rewritten in the DB.

## Goals

1. From the "Upravit knihu" dialog on the sprava page, the coach can search external
   providers, pick the correct version, and replace the stored record.
2. The DB rewrite covers `google_books_cover_url`, `isbn_13`, `external_id` (Google Books
   volume ID) and `source` — otherwise future data refreshes would re-apply the wrong volume.
3. Title/author/description are **not** rewritten by the replacement; the coach keeps
   manual editing (already in `BookEditForm`) and gains an AI fetch button that fills
   those fields for review.

## Non-goals

- No new DB columns, no migration, no schema change (pure app-level change).
- No cover re-download/storage — covers stay external URLs, rendered by `StorageImage`.
- No change to the add-book flow itself.

## Design

### API (`src/app/api/books/[id]/route.ts`)

New `action: 'replace-record'` branch in `PATCH`, coach/admin-guarded like the others.
Body: `{ cover_url, isbn_13, external_id, source }`.

- Validates `source` is one of `google_books | open_library`.
- Normalizes cover URL `http://` → `https://` (mirrors `normalizeVolume`).
- **ISBN conflict check**: if another book already has the same `isbn_13` → 409
  "Tato ISBN už má jiná kniha" (the table deliberately has no UNIQUE constraint —
  ISBN identifies an edition, not a work — so this is an app-level guard, not a DB one).
- Writes `google_books_cover_url`, `isbn_13`, `external_id`, `source`,
  `updated_by_profile_id`; returns the full refreshed book via `getBookById` so the
  dashboard can sync all tabs through the existing `handleEdited` hook.

### UI — edit dialog (`src/components/books/book-edit-dialog.tsx`, `book-edit-form.tsx`)

The dialog body swaps between the existing form and a new replace flow (both mounted,
toggled via CSS) so unsaved form edits survive the round trip:

- **"Nahradit záznam…" button** at the bottom of the form switches to the flow.
- **Step 1 — search:** debounced input (350 ms, min 2 chars) calling the existing
  `GET /api/books/external-search` (Google Books + OpenLibrary). Results show cover,
  title, author, ISBN, year, publisher; pick one.
- **Step 2 — confirm:** side-by-side summary of current vs. new cover + ISBN, note that
  the volume ID and source are also rewritten. "Potvrdit náhradu" → PATCH
  `replace-record` → `onSaved(book)` → dialog closes (existing contract).
- "Zpět" returns to the form.

### UI — AI fetch in `BookEditForm`

New "Dohledat údaje přes AI" button (disabled until title + author are non-empty) next
to the description field. POSTs to the existing `/api/books/enrich` with the book's
`isbn_13` / `page_count` as extra context and **fills** the title/author/description
fields — no save, the coach reviews before hitting "Uložit změny". Reuses the
`reEnrichBook` pattern (`src/lib/books/re-enrich.ts`) minus the auto-save. Surfaces the
route's 429 budget error message as-is.

## Testing

Per `docs/runbooks/testing.md`:

- Component test for the replace flow: open dialog → switch to replace → search → pick →
  confirm → PATCH payload correct → `onSaved` called with refreshed book.
- Component test for the AI button: mock `/api/books/enrich`, assert fields get filled,
  no PATCH is sent.
- API-route behavior (409 conflict, invalid source) is covered where route logic is
  tested today; `pnpm test` + typecheck must pass.
