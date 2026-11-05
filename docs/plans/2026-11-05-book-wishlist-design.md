# Chci si přečíst — design

**Date:** 2026-11-05
**Status:** Implemented; migration applied locally
**Migration:** `supabase/migrations/20261105114255_smart_blue_marvel.sql`

## Goal

Give each user a private "want to read" shelf: books they might read next,
saved from the catalogue and visible inside **Moje čtení**.

## Decisions

| Decision | Choice |
| --- | --- |
| Primary job | Private reading pipeline |
| What can be saved | Catalogue books only (`books.id`) |
| State per book | One flag: saved / not saved |
| Placement | Cover strip at the top of `/cteni/hledat` (Objevovat) |
| Library integration | None — no availability, reservations or notifications |
| Visibility | Private; RLS scopes every read/write to the owner |

Deliberately out of scope: custom freeform books, reading states
(want/reading/done), priority, notes, sorting controls, sharing with
teammates/coaches, library availability and acquisition signals.

## Data model

`public.book_wishlist` — a pure join table:

```
profile_id  uuid  not null  → profiles(id) on delete cascade
book_id     uuid  not null  → books(id)    on delete cascade
created_at  timestamptz not null default now()
primary key (profile_id, book_id)
index (profile_id, created_at)
```

RLS is enabled with three owner-only policies (select / insert / delete).
No update policy. Deleting a book or profile removes the bookmarks.

## How it works

The `/cteni` layout fetches the viewer's saved book IDs once and mounts
`WishlistProvider` (client context). Every `WishlistButton` reads and writes
that single store, so feeds, cards and the book detail stay consistent without
prop-drilling a set through each component.

- `POST /api/books/[id]/wishlist` — idempotent upsert.
- `DELETE /api/books/[id]/wishlist` — idempotent delete of the caller's row.
- `getMyWishlist()` — joined `BookWithProfiles[]`, newest first (Objevovat).
- `getMyWishlistBookIds()` — IDs for the layout.

The button toggles optimistically, shows a toast, and reverts its state if the
request fails. On Moje, removal immediately drops the row because the section
filters by the same context.

## UI

- **Objevovat → Chci si přečíst** (after the partner discount card, before
  curated picks): a scrolling strip of covers with titles and a count.
  Hidden when empty and while searching or browsing a category. Saving and
  browsing live on the same page; Moje stays focused on progress, loans and
  essays.
- **Book detail**: one equal-width action stack under the cover —
  Číst zdarma → Chci si přečíst / Uloženo ke čtení → Náhled.
- **Feed cards, search rows, shelf rows**: icon-only bookmark, always on the
  trailing edge, with a tooltip.
- **Toasts**: “Uloženo do „Chci si přečíst““; removal toast has a **Zpět**
  action that restores the book (removal has no confirmation).

Czech copy is first-person and gender-neutral (`Chci si přečíst`, `Až narazíš…`).

## Testing

- Component: `wishlist-button.test.tsx` (add, remove, failed request revert),
  `wishlist-section.test.tsx` (hidden when empty, covers + count, store filtering).
- Integration: `tests/integration/book-wishlist.int.test.ts` (owner-only RLS,
  cross-user insert rejection, delete scoping, duplicate PK).
- Typecheck + `pnpm test` after the migration regenerates
  `src/lib/supabase/database.types.ts`.
