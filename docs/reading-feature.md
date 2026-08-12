# Reading Feature — Implementation Overview

Branded as **"Čtení"** (Beta), behind `beta_access` flag. The core loop: **students read books → write essays → earn book points → coaches approve & mark read → community votes → 120-point goal**.

---

## Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Renders `ReadingProgressCard` widget if `"reading"` in user's layout |
| `/prehled` | Overview | Tabbed view — "Moje" (my progress + essays) / "Tým" (team points chart) |
| `/hledat` | Search / Discover | Unified search (essays + books), category browsing, team leaderboard, popular essays |
| `/knihovna` | Library | Redirects → `/hledat` |
| `/knihovna/nova` | Add Book | 3-step wizard: local search → external (Google Books / Open Library) → manual entry |
| `/knihovna/[bookId]` | Book Detail | Cover, title, author, status, tags, metadata, description, linked essays, comments |
| `/knihovna/[bookId]/upravit` | Edit Book | Coach/admin edit form |
| `/eseje/nova` | New Essay | Create essay linked to a book |
| `/eseje/[essayId]` | Essay Detail | Book info, "Přečteno koučem" banner, comments |
| `/eseje/[essayId]/upravit` | Edit Essay | Edit existing essay |
| `/eseje/ke-kontrole` | Coach Review | Inbox of unread essays for coaches |
| `/settings/kniha-knih` | Library Mgmt | Coach dashboard — approve (1–3 pts) or reject pending books |

---

## UI Components

### Dashboard / Overview
- `ReadingProgressCard` — dashboard widget with essay count, pending books, link to `/prehled`
- `PersonalProgress` — Duolingo-style progress bar toward 120 pts with milestones (20/40/60/80/100/120)
- `PrehledTabs` — "Moje" / "Tým" tab switcher

### Books / Library
- `BookCard` — cover, title, author, tags, essay count, page count, points
- `AddBookWizard` — 3-step add wizard (local → external → manual)
- `BookDescription` — expandable description
- `BookEssaysList` — essays linked to a book
- `BookEditForm` — coach edit form
- `BookDeleteButton` — confirmation dialog
- `CategoryPicker` — tag badge selector
- `LoadMoreBooks` — IntersectionObserver infinite scroll
- `CoachDashboard` — approval/rejection tabbed view
- `CoachApprovalRow` — assign 1–3 pts or reject

### Essays
- `EssayCard` — title, snippet, book cover, vote/view/comment counts
- `EssayVoteButton` — upvote toggle with particle burst animation
- `MyEssayList` — user's essays with indicators
- `TopicPills` — horizontally scrollable category filters
- `ReadByCoachBanner` — "Přečteno koučem [names]" green banner
- `CoachReadButton` — optimistic toggle for marking read

### Search / Discovery
- `SearchPageClient` — unified search, category browsing, team leaderboard

### Charts
- `TeamBookPointsChart` — recharts bar chart of team member points

---

## Database Schema

### Tables (Drizzle — `db/schema/`)

| Table | Key columns |
|-------|-------------|
| `books` | `title_cs`, `title_en`, `author`, `isbn_13`, `description`, `google_books_cover_url`, `book_points` (0–3), `page_count`, `preview_link`, `source` (manual, google_books, open_library), `external_id`, `status` (pending, approved, rejected), `created_by_profile_id` |
| `tags` | Book categories (8: Finance, Inovace, Komunikace, Leadership, Management, Marketing, Multidisciplinární, Osobní rozvoj) |
| `book_tags` | M:N join (book_id, tag_id) |
| `book_comments` | Soft-delete via `removed_at` |
| `essays` | `book_id` (FK → books, SET NULL on delete) |
| `essay_votes` | (essay_id, voter_profile_id) — trigger-based `vote_count` on essays |
| `essay_coach_reads` | (essay_id, coach_profile_id, read_at) — with `coach_can_review_essay()` RLS helper |
| `team_reading_lists` | Team reading lists |
| `team_reading_list_books` | Books in team reading lists |

### Views
- `books_with_essay_count` — adds aggregated `essay_count` column

### RLS
All tables have RLS enforced. Policies restrict by auth role (authenticated), team membership (coach/admin), and helper functions like `coach_can_review_essay()`.

---

## Book Points System

- **Goal**: 120 points (`BOOK_POINTS_GOAL`)
- **Per year**: 40 points (`BOOK_POINTS_PER_YEAR`)
- **Per book**: 1, 2, or 3 (assigned by coach on approval)
- **Milestones**: 20 → 40 → 60 → 80 → 100 → 120

---

## API Routes (`/api/`)

| Route | Methods |
|-------|---------|
| `/api/books` | GET (list/filter), POST (create with duplicate check + cover download) |
| `/api/books/search` | GET (local title/author search) |
| `/api/books/external-search` | GET (Google Books + Open Library) |
| `/api/books/[id]` | GET, PATCH (approve/reject/edit), DELETE |
| `/api/books/[id]/comments` | GET, POST |
| `/api/essays/[essayId]/vote` | POST/ DELETE (upvote / remove) |
| `/api/essays/[essayId]/coach-read` | POST/ DELETE (mark read / unmark) |

---

## Library Layer (`src/lib/`)

| File | Responsibility |
|------|----------------|
| `books/types.ts` | Types & constants (categories, point goals, page size) |
| `books/queries.ts` | `getBooks`, `getBookById`, `getBookComments`, `getPendingBooks`, `getRejectedBooks`, `searchBooksLocally`, `getBooksByProfilePoints` |
| `books/points.ts` | Czech-aware point formatting (`2body` → "2 body") |
| `books/tags.ts` | Tag resolution & assignment helpers |
| `books/external/` | Google Books API + Open Library API integration |
| `essays/types.ts` | `Essay`, `EssayWithDetails`, `EssayCoachRead`, `EssayFilters`, `EssaySortOrder` |

---

## Navigation (Sidebar)

Čtení (Beta) — under `beta_access` flag:
- **Přehled** → `/prehled`
- **Hledat** → `/hledat`
- **Ke kontrole** → `/eseje/ke-kontrole` (coach/admin, with badge count)
- **Nastavení** → `/settings/kniha-knih` (coach/admin — library management)

Auto-expands when on any `/prehled`, `/hledat`, `/eseje/*`, `/knihovna/*`, or `/settings/kniha-knih`.

---

## Tests

| File | Layer | What it covers |
|------|-------|----------------|
| `tests/e2e/reading.spec.ts` | E2E | Full flow: auth redirects, page loads, navigation |
| `reading-progress-card.test.tsx` | Component | Rendering: essay count, pending books, link |
| `types.test.ts` (dashboard) | Unit | Widget availability by role |
| `tags.test.ts` (books) | Unit | `tagNamesFromJoin()` utility |

---

## File Index (54 files)

**Pages (8):**
`src/app/(main)/page.tsx`, `prehled/page.tsx`, `hledat/page.tsx`, `knihovna/page.tsx`, `knihovna/nova/page.tsx`, `knihovna/[bookId]/page.tsx`, `knihovna/[bookId]/upravit/page.tsx`, `settings/kniha-knih/page.tsx`

**Components (21):**
`reading-progress-card.tsx`, `personal-progress.tsx`, `prehled-tabs.tsx`, `book-card.tsx`, `add-book-wizard.tsx`, `book-description.tsx`, `book-essays-list.tsx`, `book-edit-form.tsx`, `book-delete-button.tsx`, `category-picker.tsx`, `load-more-books.tsx`, `coach-dashboard.tsx`, `coach-approval-row.tsx`, `essay-card.tsx`, `essay-vote-button.tsx`, `my-essay-list.tsx`, `read-by-coach-banner.tsx`, `coach-read-button.tsx`, `topic-pills.tsx`, `search-page-client.tsx`, `team-book-points-chart.tsx`

**API Routes (5):**
`/api/books/route.ts`, `/api/books/search/route.ts`, `/api/books/external-search/route.ts`, `/api/books/[id]/route.ts`, `/api/books/[id]/comments/route.ts`

**DB Schema (3):**
`db/schema/books.ts`, `db/schema/essays.ts`, `db/schema/views.ts`

**Migrations (2):**
`20260610000001_reading_hub.sql`, `20260610120000_essay_coach_reads.sql`

**Library (11):**
`books/types.ts`, `books/queries.ts`, `books/points.ts`, `books/tags.ts`, `books/external/index.ts`, `books/external/google-books.ts`, `books/external/open-library.ts`, `essays/types.ts`, `dashboard/types.ts`

**Tests (4):**
`reading.spec.ts`, `reading-progress-card.test.tsx`, `types.test.ts` (×2)

**Other:**
`app-sidebar.tsx`, `2026-06-10-reading-hub.md` (plan)
