# Zpětná vazba (Feedback board) — Design

**Date:** 2026-07-09
**Status:** Approved (pending spec review)

## Summary

A lightweight product-feedback feature. A **Zpětná vazba** entry in the sidebar opens a
**shared board of sticky-note feedback**. Any authenticated user can drop a note ("what's
on their heart") through a dead-simple form. Admins can write a single response to a note
and archive it. Active notes show on the main board; resolved ones move to an **Archiv**
tab so people can see feedback is received and acted on.

This intentionally reuses the shape of the existing **room-issues** feature (users report,
coaches/admins resolve). The one deliberate difference: management here is **admin-only**,
not coach+admin.

## Goals

- Users can submit free-text feedback in one or two clicks — no fancy form.
- Everyone sees everyone's feedback (transparency / community feel).
- Admins can respond to and archive notes so the loop visibly closes.
- Keep the data model to **one table**.

## Non-goals (YAGNI)

- No comment threads / back-and-forth (single admin response per note only).
- No upvotes/reactions.
- No categories, tags, or titles — just a body.
- No realtime updates; the board reflects state on navigation/refresh.
- No email/notification on response.

## Data model — one table

`public.feedback`, created via Drizzle schema (`db/schema/feedback.ts`) then
`pnpm db:generate`. RLS policies added via a separate custom SQL migration.

| column | type | constraints / notes |
|---|---|---|
| `id` | uuid | primary key, default `gen_random_uuid()` |
| `author_id` | uuid | not null, references `public.profiles(id)` on delete cascade |
| `body` | text | not null |
| `created_at` | timestamptz | not null, default `now()` |
| `archived_at` | timestamptz | nullable — `null` = active, non-null = archived |
| `admin_response` | text | nullable — the admin's single reply |
| `admin_response_by` | uuid | nullable, references `public.profiles(id)` |
| `admin_response_at` | timestamptz | nullable |

Rationale for the admin "comment" being columns on the row (not a child table): the user
asked for one table and a lightweight loop. A single response per note satisfies "so they
can see we're working with it" without a comments table.

Index: `create index on public.feedback (archived_at, created_at desc)` to serve the
active/archive lists ordered newest-first.

### RLS policies (custom migration, one policy per operation)

All policies `SECURITY INVOKER` context; use `(select auth.uid())`. Admin check resolves
the caller's role from `public.profiles`.

- **select** — any authenticated user (shared board):
  `to authenticated using (true)`
- **insert** — authenticated, may only insert as themselves:
  `with check (author_id = (select id from public.profiles where user_id = (select auth.uid())))`
  *(exact author→profile linkage to match the app's existing pattern — see Open
  implementation details.)*
- **update** — admin only:
  `using (public.is_admin())` where the helper checks the caller's profile role = `'admin'`.
- **delete** — author's own note OR admin:
  `using (author_id = <caller profile> or public.is_admin())`

A small `SECURITY INVOKER`, `search_path = ''` helper (e.g. `public.is_admin()`) keeps the
admin check DRY across policies; if a helper feels heavy, inline the subquery instead.
Author→profile resolution must follow whatever the essays/room-issues code already does
(profile id vs. auth user id) — confirmed during implementation, not assumed here.

## Backend

- `lib/feedback/types.ts` — derived DB types (`Tables<'feedback'>`), plus
  `FeedbackWithAuthor` (row + joined author name/role). Use `type`, not `interface`, for
  derived DB types.
- `lib/feedback/queries.ts` — `listActive(supabase)` and `listArchived(supabase)`: select
  with author join, ordered `created_at desc`, filtered by `archived_at is null` /
  `is not null`. Signatures take `SupabaseClient<Database>`.
- `POST /api/feedback` — create a note. Body: `{ body: string }`. 401 if not
  authenticated; 400 if body empty. Sets `author_id` to caller's profile.
- `PATCH /api/feedback/[id]` — **admin only** (mirror room-issues role guard, but
  `role === 'admin'`). Accepts any of: `{ admin_response?: string | null, archived?: boolean }`.
  Setting `admin_response` also stamps `admin_response_by`/`admin_response_at`; `archived`
  toggles `archived_at` between `now()` and `null`.
- `DELETE /api/feedback/[id]` — author-own or admin (RLS enforces; route returns 403/404
  appropriately).

## Frontend

- `app/(main)/zpetna-vazba/page.tsx` — server component. Fetches `listActive` +
  `listArchived`, resolves current user's role, passes all to the board.
- `components/feedback/feedback-board.tsx` — `"use client"`. Tabs **Aktivní / Archiv**
  (shadcn `Tabs`). Holds list state so create/archive/delete update optimistically.
  Renders `NewFeedbackForm` above the active list.
- `components/feedback/new-feedback-form.tsx` — a single `Textarea` + **Odeslat** button.
  Posts to `POST /api/feedback`, prepends the new note to the active list. No title field.
- `components/feedback/feedback-note-card.tsx` — sticky-note-styled card showing: body,
  author name + role badge (reuse `ROLE_LABELS` / `ROLE_COLORS` from `lib/komunita/types`),
  relative created time, and the admin-response block when present. When `isAdmin`, shows
  actions: respond (inline textarea → PATCH), archive/unarchive (PATCH), delete (DELETE).
- `components/app-sidebar.tsx` — add a **Zpětná vazba** nav item (with an appropriate
  lucide icon, e.g. `MessageSquareHeart` or `Sticker`) pointing to `/zpetna-vazba`.

Visual direction: warm, sticky-note-style cards (subtle paper tint, gentle shadow). The
frontend-design skill will be used at build time; it must respect the existing OKLCH theme
tokens and light/dark themes.

## Testing (four layers, per `docs/runbooks/testing.md`)

- **component** (`*.test.tsx`):
  - `feedback-note-card` renders body, author + role badge, and admin response when set;
    admin actions appear only when `isAdmin`.
  - `new-feedback-form` posts body and clears/prepends on success; disabled on empty.
- **integration** (`tests/integration/*.int.test.ts`) — RLS:
  - any authenticated user can `select`;
  - author can `insert` a note as themselves; cannot insert as someone else;
  - non-admin **cannot** `update` (archive/respond); admin can;
  - author can `delete` own note; non-author non-admin cannot; admin can.
- **e2e** (`tests/e2e/*.spec.ts`): open **Zpětná vazba** from the sidebar → submit a note →
  it appears on the Aktivní board.

## Open implementation details (resolve during build, not blocking)

1. Exact `author_id` linkage (profile id vs. auth user id) — match essays/room-issues.
2. Whether to add an `is_admin()` SQL helper or inline the role subquery in each policy.
3. Icon choice for the sidebar entry.
