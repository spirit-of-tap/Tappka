# Plan: "Kniha knih" + Eseje — Reading & Essays module for Tappka

## Context

Tappka today only handles room reservations. The school (Timia Akademia, ČZU) requires students to read and write essays as part of their 3-year programme: a student must earn **120 BookPoints** over their studies (40/year), where each approved book is worth 1–3 points. Today this is tracked in a legacy Power Apps app called TAPIS (Power BI statistics page, "Kniha knih" catalog, "Moje eseje"). We are replacing that module inside Tappka.

The feature introduces two linked primitives:

- **Kniha knih (Book of Books)** — a shared, coach-curated catalog of books. Students can add books (suggesting 1–3 points); a coach approves (assigning final points) or rejects (0 points). Approved books contribute points; rejected books stay visible but award no points.
- **Eseje (Essays)** — rich-text essays a student writes in-app with Tiptap. Essays may cite one book (or none). There is **no essay approval**; students own their essays entirely. Coaches and peers can comment. Views and a "seen by coach" indicator help authors understand reach.

Stats roll up per student (progress to 120) and per team (coach team overview).

---

## Scope & key decisions (from brainstorming)

| Question | Decision |
|---|---|
| Essay editor | Tiptap (headless, React) — stored as JSON in Postgres |
| Essay approval | None. Students fully own essays. |
| Essay visibility | School-wide to all authenticated users |
| Coach feedback | Free-form comments (like Facebook), coaches visually flagged |
| Views / read-receipts | Track distinct viewers per essay; show "seen by coach X" to author |
| Book approval | Coach approves, assigning 1–3 points, or rejects (→ 0 pts). Approved books are immutable. |
| Rejected books | Stay in catalog, labeled "Zamítnuto / 0 bodů" |
| Book add flow | Fuzzy local search → if no match, backend queries Google Books + Open Library → if still nothing, manual entry |
| Authors | Not modeled separately. Stored as free text on the book. |
| Essay ↔ book | One optional book per essay. No required-reading lists. |
| Points goal | 120 total (40/year), visualized against a goal line |
| Navigation | New top-level **Knihovna** (books). New top-level **Eseje** with tabs: *Moje / Tým / Celá škola*. Team statistics view added as a new tab on the existing **Komunita → tým detail** page so teams live in one place. |

---

## Data model

All tables live in `public`, RLS enabled, policies split per operation, `(select auth.uid())` idiom.

### `books`
- `id` uuid pk
- `title` text not null
- `author` text not null _(free text; no authors table)_
- `isbn_13` text unique nullable
- `description` text nullable
- `cover_path` text nullable — storage key under `book/<book_id>/<timestamp>-<uuid>.jpg`
- `tags` text[] not null default '{}'
- `suggested_points` smallint not null check (between 0 and 3) — what the student proposed
- `book_points` smallint not null default 0 check (between 0 and 3) — final, 0 if pending/rejected
- `status` enum `book_status` (`pending`, `approved`, `rejected`) — default `pending`
- `added_by_profile_id` uuid fk → `profiles.id`
- `approved_by_profile_id` uuid fk → `profiles.id` nullable
- `approved_at` timestamptz nullable
- `rejection_reason` text nullable
- `source` enum `book_source` (`manual`, `google_books`, `open_library`) — where metadata came from
- `external_id` text nullable — e.g. Google Books volumeId or OL work id
- `created_at`, `updated_at` timestamptz default now()
- Indexes: trigram GIN on `title` and `author` for fuzzy search; btree on `status`, `isbn_13`.

### `essays`
- `id` uuid pk
- `author_profile_id` uuid fk → `profiles.id` not null
- `book_id` uuid fk → `books.id` nullable — essays without a source are allowed
- `title` text not null
- `content_json` jsonb not null — Tiptap document JSON
- `content_text` text — plain-text mirror for full-text search (produced client-side from `editor.getText()` and sent alongside; DB also has a `tsvector` index on it)
- `published` boolean not null default true — draft flag for future use (v1 always true)
- `view_count` integer not null default 0 — maintained by trigger on `essay_views`
- `created_at`, `updated_at` timestamptz
- Indexes: `author_profile_id`, `book_id`, `created_at desc`, GIN on `to_tsvector('simple', content_text)` for search.

### `essay_comments`
- `id` uuid pk
- `essay_id` uuid fk → `essays.id` on delete cascade
- `author_profile_id` uuid fk → `profiles.id`
- `body` text not null
- `created_at`, `updated_at` timestamptz
- Flat (no replies) in v1. `coach_badge` rendered in UI from profile role.

### `book_comments`
- Same shape as `essay_comments` but `book_id` fk. Same flat structure.

### `essay_views`
- `essay_id` uuid fk → `essays.id` on delete cascade
- `viewer_profile_id` uuid fk → `profiles.id`
- `first_viewed_at`, `last_viewed_at` timestamptz
- Primary key: `(essay_id, viewer_profile_id)` — one row per distinct viewer.
- Author never counts (skipped in the upsert).
- "Seen by coach" = any row where `viewer_profile_id` belongs to a profile with role `coach` or `admin`.

### Enums / migration files

- `supabase/migrations/YYYYMMDDHHmmss_books_module_schema.sql` — creates enums, tables, RLS.
- `supabase/migrations/YYYYMMDDHHmmss_books_module_indexes.sql` — trigram + full-text search indexes.
- `supabase/migrations/YYYYMMDDHHmmss_books_module_views_rpc.sql` — `record_essay_view(essay_id)` security-definer RPC to upsert a view row for the caller's profile (enforces one-per-user without leaking other users' rows through RLS).

### RLS summary (policy per operation)

- **books**: SELECT for any authenticated user. INSERT for any authenticated (student adds). UPDATE restricted to coach/admin via role check (approval & point assignment). DELETE for admin only.
- **essays**: SELECT for any authenticated user. INSERT/UPDATE/DELETE for `author_profile_id = current profile`.
- **essay_comments / book_comments**: SELECT for authenticated; INSERT for authenticated (author = current profile); UPDATE/DELETE by author or admin.
- **essay_views**: no direct insert; only via RPC. SELECT constrained — author sees all viewers of their essays; others see only their own row (so view counts come via the `essays.view_count` column).

---

## Navigation / UI map

```
Sidebar
├── Domů                       (existing)
├── Rezervace                  (existing)
├── Knihovna         NEW       → /knihovna          — catalog of books, fuzzy search, add-book flow
├── Eseje            NEW       → /eseje             — tabs: Moje · Tým · Celá škola
├── Komunita                   (existing)
│   └── Tým detail                                   — NEW tab "Statistiky" (BookPoints chart like TAPIS screenshot)
└── Settings (coach/admin)
    └── NEW page: Kniha knih — správa                → /settings/kniha-knih
         ├── Čekají na schválení (pending books)
         └── Zamítnuté
```

### Page list

| Route | Purpose |
|---|---|
| `/knihovna` | Book grid (cover, title, author, points badge, status label). Filter by tags, status. Search bar (fuzzy). "Přidat knihu" button opens the add-book flow. |
| `/knihovna/[bookId]` | Book detail: cover, info, tags, points, essays written about it, book comments. |
| `/knihovna/nova` | Add-book flow — 3-step: local fuzzy search, external search (Google Books + Open Library), manual fallback. |
| `/eseje` | Tabs `?view=moje|tym|vse` (default `vse`). Card list: title, snippet, author, book badge, view count, comment count. |
| `/eseje/nova` | Tiptap editor — title, book picker (optional, searches `books`), editor body, publish button. |
| `/eseje/[essayId]` | Read-only render of Tiptap JSON + author info + book card + views/read-by-coach banner + comment thread. Auto-records a view. Author sees "Edit" button. |
| `/eseje/[essayId]/upravit` | Same editor in edit mode. |
| `/settings/kniha-knih` | Coach/admin dashboard: pending queue (approve → assign points, reject → reason), rejected list, approved browser. |
| `/komunita/tymy/[id]` *(existing)* | Add a **Statistiky** tab showing the TAPIS-style bar chart of BookPoints per member with 40/80/120 goal lines + pending-approval donut. |

---

## Key flows

### Add book flow (`/knihovna/nova`)

1. **Local search**: debounced input → client calls `GET /api/books/search?q=...` which runs a Postgres fuzzy query (`similarity()` on title + author). Results appear as picker cards. If the user picks one, they are redirected to write an essay about it (or back to catalog).
2. **External search fallback**: if no local match or user clicks "Nenašel jsem, hledej jinde" → `GET /api/books/external-search?q=...&isbn=...` fans out to Google Books + Open Library in parallel, normalizes results (title, author, isbn_13, description, cover URL, external_id, source). Results shown as picker.
3. **Pick external → create**: `POST /api/books` with normalized payload + `suggested_points` (student picks 1–3). Server downloads the cover to Supabase Storage (same pattern as profile pictures: presigned URL flow via `lib/storage/service.ts`), inserts the book with `status='pending'`.
4. **Manual fallback**: if external also fails, show a manual form (title, author, optional isbn, description, tags, suggested_points, optional cover upload). Submit → same `POST /api/books` but with `source='manual'`.
5. After submit, the student can immediately write an essay about the pending book; they just won't earn points until a coach approves.

### Coach approval (`/settings/kniha-knih`)

- Pending list sorted oldest-first. Each row shows cover, title, author, suggested points, who added it, and external links (Google Books / Open Library) if `external_id` is set.
- Actions: **Schválit** (dropdown 1/2/3 pts, defaulting to suggested) → updates `status='approved'`, sets `book_points`, `approved_by_profile_id`, `approved_at`. **Zamítnout** → prompt for reason, `status='rejected'`, `book_points=0`.
- Approved books are **immutable** for points (enforced via RLS + a `BEFORE UPDATE` trigger that blocks changes to `book_points`/`status` once `status='approved'`).

### Essay writing (`/eseje/nova`)

- Tiptap with `immediatelyRender: false` and the official `StarterKit` (bold/italic/lists/headings/code/blockquote). Client component. Saves content as `editor.getJSON()` → `POST /api/essays`. Also sends `editor.getText()` for the searchable `content_text` column.
- Book picker: typeahead against `/api/books/search`. Shows points badge ("2 body" / "Zamítnuto 0 bodů"). Student can explicitly skip choosing a book.
- Autosave every 5s after dirty via `PATCH /api/essays/[id]` once essay has an id; first save is on explicit "Zveřejnit".

### Essay viewing (`/eseje/[essayId]`)

- Server component fetches essay + book + comments + `view_count` + list of coach viewer profile_ids for read-by-coach banner.
- A small client component fires `POST /api/essays/[id]/view` on mount, which calls the `record_essay_view(essay_id)` RPC (upsert). Debounced/guarded so it runs once per session.
- Comments rendered server-side; posting via `POST /api/essays/[id]/comments`. Coach comments render with role badge using existing `ROLE_LABELS`/`ROLE_COLORS` in `lib/komunita/types.ts`.

### Team statistics (on team detail page)

- New tab appended to `app/(main)/komunita/tymy/[id]/page.tsx`.
- Server computes per-member: `sum(book_points)` over approved books cited in that member's essays (grouped by member; distinct book per member to avoid double-counting multiple essays on same book).
- Render a Recharts `BarChart` with horizontal reference lines at 40, 80, 120 (we already use `recharts` 2.15). Bar color split by approved vs pending contribution (pending = essays where the book is still `pending` — not counted toward the sum but shown in a secondary stack for motivation).
- Sibling donut: ratio of approved book points vs potential pending.
- **No new sidebar item** — the stats live where teams live, resolving the "komunita overlap" concern.

---

## External API adapters

- `lib/books/external/google-books.ts` — `searchGoogleBooks(query)`, `fetchByIsbn(isbn)`. Returns normalized `ExternalBookCandidate`.
- `lib/books/external/open-library.ts` — same shape.
- `lib/books/external/index.ts` — parallel fan-out, merges by ISBN-13, de-dupes.
- No API keys required for either (both have anonymous endpoints); if Google Books starts rate-limiting, add `GOOGLE_BOOKS_API_KEY` env var later. Document in `.env.local.example`.

## Cover image storage

- Extend `lib/storage/service.ts` context types to include `'book'`. Path: `book/<book_id>/<timestamp>-<uuid>.<ext>`.
- Server-side helper `downloadAndStoreCover(url, bookId)` fetches the external cover, validates content-type (`image/jpeg|png|webp`) and size (<2 MB), uploads via Supabase Storage, returns `cover_path`.
- Public download URLs generated via existing `/api/storage/presign-download`.

---

## Implementation phases

Each phase is independently shippable and testable.

1. **Schema** — create migrations (tables, enums, indexes, RLS, trigger for `view_count`, RPC `record_essay_view`, immutable-approved-book trigger). Apply via MCP per AGENTS.md rules.
2. **Types + queries** — `lib/books/types.ts`, `lib/essays/types.ts`, `lib/books/queries.ts`, `lib/essays/queries.ts`. Mirror patterns in `lib/komunita/` and `lib/reservations/`.
3. **Storage + external adapters** — extend `lib/storage/` for `'book'` context; add `lib/books/external/*`; add `/api/books/external-search` route.
4. **Books API** — `/api/books` (GET list, POST create), `/api/books/search` (fuzzy), `/api/books/[id]` (GET, PATCH admin/coach only for approval/rejection), `/api/books/[id]/comments` (GET/POST).
5. **Books UI** — `/knihovna` catalog grid (reuse the card + grid look from `komunita/lide`), book detail page, add-book wizard, `/settings/kniha-knih` coach dashboard.
6. **Install Tiptap** — `pnpm add @tiptap/react @tiptap/starter-kit @tiptap/pm`. Build `components/essays/tiptap-editor.tsx` (client) and `components/essays/tiptap-renderer.tsx` (reads JSON, renders static HTML via `generateHTML` for RSC-friendly read view).
7. **Essays API** — `/api/essays` (GET filterable by author/team/all, POST), `/api/essays/[id]` (GET/PATCH/DELETE), `/api/essays/[id]/comments`, `/api/essays/[id]/view`.
8. **Essays UI** — `/eseje` list with tabs, `/eseje/nova`, `/eseje/[id]`, `/eseje/[id]/upravit`.
9. **Team statistics tab** — add Recharts bar chart to `app/(main)/komunita/tymy/[id]/page.tsx`.
10. **Sidebar** — add "Knihovna" and "Eseje" entries to the sidebar component; gate the "Správa knihovny" settings link to coach/admin.
11. **Polish** — empty states, loading skeletons, error states, copy review (all Czech), "seen by coach" banner, view counter animation.

---

## Critical files to create / modify

### New

- `supabase/migrations/<ts>_books_module_schema.sql`
- `supabase/migrations/<ts>_books_module_indexes.sql`
- `supabase/migrations/<ts>_books_module_views_rpc.sql`
- `lib/books/types.ts`, `lib/books/queries.ts`
- `lib/books/external/{google-books.ts, open-library.ts, index.ts}`
- `lib/essays/types.ts`, `lib/essays/queries.ts`
- `app/api/books/route.ts`, `app/api/books/search/route.ts`, `app/api/books/external-search/route.ts`, `app/api/books/[id]/route.ts`, `app/api/books/[id]/comments/route.ts`
- `app/api/essays/route.ts`, `app/api/essays/[id]/route.ts`, `app/api/essays/[id]/comments/route.ts`, `app/api/essays/[id]/view/route.ts`
- `app/(main)/knihovna/page.tsx`, `app/(main)/knihovna/[bookId]/page.tsx`, `app/(main)/knihovna/nova/page.tsx`
- `app/(main)/eseje/page.tsx`, `app/(main)/eseje/nova/page.tsx`, `app/(main)/eseje/[essayId]/page.tsx`, `app/(main)/eseje/[essayId]/upravit/page.tsx`
- `app/(main)/settings/kniha-knih/page.tsx`
- `components/books/*` — `book-card.tsx`, `book-grid.tsx`, `book-detail.tsx`, `add-book-wizard.tsx`, `coach-approval-row.tsx`
- `components/essays/*` — `tiptap-editor.tsx`, `tiptap-renderer.tsx`, `essay-card.tsx`, `essay-list.tsx`, `essay-comment-thread.tsx`, `seen-by-coach-banner.tsx`
- `components/teams/team-book-points-chart.tsx`

### Modify

- `lib/storage/service.ts` — add `'book'` context, path helper.
- `lib/storage/supabase-s3-client.ts` — no change expected; extend MIME allow-list if needed.
- Sidebar component (wherever `Rezervace` / `Komunita` are registered) — add two entries.
- `app/(main)/komunita/tymy/[id]/page.tsx` — new "Statistiky" tab.
- `.env.local.example` — document optional `GOOGLE_BOOKS_API_KEY`.

---

## Verification

Run locally: `pnpm dev` (starts Supabase + Next.js).

1. **Migrations applied** — check `supabase/migrations/` files exist AND `supabase_apply_migration` MCP call succeeded for each; query `\d public.books` and `\d public.essays` in the local DB.
2. **Book add flow** — as a student, add a book via (a) local match, (b) Google Books, (c) Open Library, (d) manual fallback. Verify cover appears (downloaded to B2), status is `pending`, suggested_points stored.
3. **Coach approval** — log in as coach/admin, visit `/settings/kniha-knih`, approve one book with 2 pts, reject another with a reason. Verify `book_points`, `status`, `approved_by_profile_id` updated. Verify approved books render correctly in `/knihovna`.
4. **Essay creation** — write an essay in Tiptap citing an approved book, with and without a book. Verify JSON saved, search-text generated, list pages show it.
5. **View tracking** — open an essay as a different user, verify `essay_views` has a row, `essays.view_count` incremented, and the author sees the count bump. As a coach, open the essay — author sees "Seen by coach X".
6. **Comments** — post as student and coach; verify coach badge styling; verify author can delete own comment, admin can delete any.
7. **Team stats** — visit `/komunita/tymy/<team>` → Statistiky tab. Verify bar chart renders per-member BookPoints, 40/80/120 guide lines, pending portion distinct.
8. **Rejected book** — confirm labeled "Zamítnuto / 0 bodů" in catalog; essays referencing it render with "0 bodů" badge.
9. **RLS smoke** — in the DB, attempt to update an approved book's `book_points` as a non-admin session → should be blocked. Attempt to insert an `essay_view` directly → blocked (must go via RPC).
10. **Lint** — `pnpm lint` passes on all new files. No `any`, interfaces (not type aliases), named-constant magic values.

---

## Open questions deferred to implementation

- **Tiptap extensions beyond StarterKit** (images in essays? links? code blocks?) — start with StarterKit only, add extensions in phase 11 if users ask.
- **Essay search UX** — plan has `tsvector` index and API support; actual search UI (combined with `/eseje` tabs) to be refined during phase 8.
- **Pagination vs infinite scroll** for catalog / essay list — default to simple offset pagination (20/page) matching Komunita Lidé; swap to cursor if needed.
- **Notifications** (coach sees "new book waiting") — out of scope for v1; re-evaluate after module ships.
