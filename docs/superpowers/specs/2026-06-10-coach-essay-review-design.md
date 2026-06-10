# Coach Essay Review — Design

**Date:** 2026-06-10
**Status:** Approved

## Problem

Coaches have no dedicated place to see new essays written by students in their
team, and no way to deliberately acknowledge that they have reviewed one. Today
essay views are tracked passively (opening an essay records a view and shows the
author a "Viděl/a: {name}" banner), but there is no explicit "I reviewed this"
signal and no review inbox.

## Goals

1. A coach-only section listing essays from students in the coach's team, split
   into **unread (new)** and **read** tabs.
2. An explicit **"Označit jako přečtené"** action. Opening an essay does NOT mark
   it read — only the deliberate action does. The action is reversible.
3. The essay author sees that their coach has explicitly read the essay, in
   addition to the existing passive "Viděl/a" banner.

## Decisions (from brainstorming)

- **Read signal:** explicit button, separate from passive view-tracking.
- **Placement:** new coach-only sidebar item (group "Čtení").
- **Scope:** students in the coach's own team (`profiles.team_id` match). Admins
  may review any team.
- **Inbox behavior:** Unread / Read tabs (read essays are retained, not dropped).
- **Author banner:** keep the existing passive "Viděl/a" banner AND add a
  stronger "Přečteno koučem {name}" banner once explicitly marked.

## Data model

New table `public.essay_coach_reads`:

| column | type | notes |
|---|---|---|
| `essay_id` | uuid | FK → `essays(id)` on delete cascade |
| `coach_profile_id` | uuid | FK → `profiles(id)` on delete cascade |
| `read_at` | timestamptz | default `now()` |

Primary key `(essay_id, coach_profile_id)` — one read per coach per essay;
re-marking is idempotent (upsert), unmarking deletes the row.

Helper function `public.coach_can_review_essay(p_essay_id uuid) returns boolean`
(`security invoker`, `set search_path = ''`): true when the caller is a
coach/admin AND (caller is admin OR the essay author's `team_id` equals the
caller's `team_id`).

### RLS (separate policy per op, `(select auth.uid())`, fully qualified)

- **select:** `coach_profile_id = public.current_profile_id()` OR caller is the
  essay author (so the author's banner can list who read it).
- **insert:** `coach_profile_id = public.current_profile_id()` AND
  `public.coach_can_review_essay(essay_id)`.
- **delete:** `coach_profile_id = public.current_profile_id()`.
- **no update.**

## Queries (`lib/essays/queries.ts`)

- `getUnreadTeamEssaysForCoach(supabase, coach)` — published essays whose author
  is a team member (same `team_id`, excluding the coach) with no read row for
  this coach. Ordered by `created_at` desc.
- `getReadTeamEssaysForCoach(supabase, coach)` — same scope but with a read row;
  ordered by `read_at` desc, includes `read_at`.
- `getCoachUnreadCount(supabase, coach)` — count for the sidebar badge.
- `getEssayCoachReads(supabase, essayId)` — who explicitly marked it read
  (profile name + `read_at`), for the author banner.

Types: add `EssayCoachRead`, `EssayCoachReadWithProfile`, and a
`read_at`-bearing list item type in `lib/essays/types.ts`.

## API (`app/api/essays/[id]/coach-read/route.ts`)

Follows the existing `vote/route.ts` pattern.

- **POST:** upsert a read row for the current coach. Role + team enforced by RLS;
  return 403 on policy violation, 201 on success.
- **DELETE:** remove the current coach's read row (unmark).

## UI

### Coach inbox — `app/(main)/eseje/ke-kontrole/page.tsx`

Server component. Redirects non-coach/admin to `/`. Fetches unread + read lists,
renders a client `CoachReviewList` with two tabs (Nepřečtené / Přečtené, with
counts). Each row shows author, title, snippet, book, date, a link to the essay,
and a mark-read / unmark toggle (optimistic; moves the item between tabs).

### Sidebar — `components/app-sidebar.tsx`

Add a coach/admin-only "Ke kontrole" item (Inbox icon) in the "Čtení" group, with
an unread-count badge. Count is fetched server-side in `app/(main)/layout.tsx`
and passed to `AppSidebar` (no realtime; refreshes on navigation).

### Essay detail — `app/(main)/eseje/[essayId]/page.tsx`

- Keep `SeenByCoachBanner` (passive) for the author.
- Add `ReadByCoachBanner` ("Přečteno koučem {name} · {date}") shown to the author
  when an explicit read row exists.
- For a coach/admin viewing a team essay, render an inline mark-read / unmark
  control on the detail page.

## Out of scope (YAGNI)

- Realtime notifications / push when a new essay arrives.
- Per-essay coach feedback field (the existing comment thread covers feedback).
- Cross-team coach assignments (one team per coach, admins see all).
