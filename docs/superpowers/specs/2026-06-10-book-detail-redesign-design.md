# Book detail page redesign

**Date:** 2026-06-10
**File touched:** `app/(main)/knihovna/[bookId]/page.tsx` (+ small helpers)

## Goal

Make the book detail page look professional and surface useful info that's already
in the database but currently hidden: page count, a Google Books preview link, and
a Goodreads link. Sort the essays about the book by popularity (upvotes).

## Data — all read from the existing `book` record (no external API calls)

The `books` table already stores the needed fields (verified against prod data:
546/611 have `preview_link`, 452/611 have `page_count`, 546/611 have `isbn_13`).

| UI element        | Source                              | Shown when            |
|-------------------|-------------------------------------|-----------------------|
| Pages             | `book.page_count`                   | not null              |
| Google preview    | `book.preview_link`                 | not null (http→https) |
| Goodreads         | `https://www.goodreads.com/search?q=` + `encodeURIComponent(book.title)` | always |
| ISBN              | `book.isbn_13`                      | not null              |
| Points            | `book.book_points`                  | status === approved   |
| Added by          | `book.added_by.name`                | present               |

`external_id` is never populated (0/611) — do not rely on it.

## Layout

### Top bar
- Keep "Zpět do knihovny" back link and the coach-only Upravit / Smazat buttons.

### Hero (two columns)
- **Left:** larger cover (~`w-40`/`w-44`), `rounded-lg`, subtle `shadow-md`/ring,
  `BookOpen` fallback when no `cover_path`.
- **Right:**
  - Title (`text-2xl`/`text-3xl font-bold`), author (`text-muted-foreground`).
  - Status badge + points badge (existing `BOOK_STATUS_COLORS` / labels).
  - Category tags (existing `book.tags` outline badges).
  - **Metadata strip:** small icon + value items, wrap on mobile —
    pages (`BookOpen`/`FileText`), ISBN (`Barcode`/`Hash`), points (`Award`),
    "Přidal/a {name}" (`User`). Each item hidden when its value is absent.
  - **Action buttons row:**
    - "Náhled" → `preview_link` (only if present), `target="_blank" rel="noopener noreferrer"`, external-link icon.
    - "Goodreads" → search URL (always), new tab.
- **Description:** below the hero, full width, readable typography
  (`max-w-prose`, `leading-relaxed`). Keep `rejection_reason` in destructive color.

### Essays section
- Query change: `getEssays(supabase, { bookId, pageSize: 500, sort: 'best' })`
  → orders by `vote_count` desc, then `created_at` desc.
- Each essay row → compact card: title (medium), author with avatar/initial,
  and a stat row reusing `EssayCard` iconography:
  - upvotes (`ChevronUp` + `vote_count`)
  - views (`Eye` + `view_count`)
  - comments (`MessageCircle` + `comment_count`, only when > 0)
- Whole card links to `/eseje/{id}`, hover state like existing rows.

### Comments section
- Keep. Light restyle: author avatar/initial + name, body, spacing to match.

## Out of scope
- No schema migration, no backfill, no Google Books / Goodreads API integration.
- No changes to the add-book wizard or edit form.
- Books missing `preview_link` / `page_count` simply omit those elements.

## Success criteria
- Page count, Google preview button, and Goodreads button render for a book that
  has the data (e.g. "Nikdy nedělej kompromis").
- Essays are ordered by `vote_count` descending with stats visible per row.
- Elements gracefully disappear when their underlying data is null.
- Layout looks clean and professional on desktop and mobile.
