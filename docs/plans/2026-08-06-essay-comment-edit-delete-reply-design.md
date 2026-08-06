# Essay Comments: Edit, Delete & Reply

Date: 2026-08-06

Fixes:
- #92 — Users cannot delete or edit their own comment
- #93 — Users cannot reply to an existing comment (only add new ones)

## Background

Comments are currently a flat, single-level feature (`db/schema/essays.ts`, `essay_comments`).
The DB + RLS already allow authors to update and delete their own rows, but the API route
(`src/app/api/essays/[id]/comments/route.ts`) only implements `GET` and `POST`, and the UI
(`src/components/essays/essay-comment-thread.tsx`) exposes no edit/delete/reply affordances.

## Goals

1. Users can edit and delete their own comments.
2. Users can reply to any existing comment.
3. The author of a comment is notified by email when someone replies to their comment.

## Non-goals

- Nested/indented thread rendering — replies stay flat in the list.
- Infinite reply depth UI.

## Design

### Data model

Add `parent_id` (nullable UUID, self-referencing FK to `essay_comments.id`,
`onDelete("set null")`) to `essayComments` in `db/schema/essays.ts`. Display remains flat;
`parent_id` exists purely to track reply relationships for notifications.

Requires `pnpm db:migrate` (user applies + checks drops).

### API route (`src/app/api/essays/[id]/comments/route.ts`)

- `PATCH` — edit a comment. Body `{ body }`. Validates ownership (RLS enforces, but also
  guard: only the author may edit). Rejects editing removed comments. Sets
  `updated_by_profile_id` and `updated_at`.
- `DELETE` — soft-delete a comment. Sets `removed_at`, `updated_by_profile_id`,
  `updated_at`. Only the author may delete (RLS also permits admins).
- `POST` — accepts optional `parent_id`. If provided, validates the parent comment exists
  in the same essay. Inserts with `parent_id`.

### Reply notifications (`src/lib/notifications/essay-notifications.ts`)

- New `notifyEssayReplied(...)`: looks up the parent comment's `author_profile_id`, and
  emails them using the existing `essay_comment_email` preference column. No-ops when
  `actorProfileId === commentAuthorId`, when the parent comment author has no work email,
  when not in beta, or when the preference is disabled.
- `POST` fires `notifyEssayCommented` (essay author) and `notifyEssayReplied` (parent
  comment author, only when a `parent_id` is present) in its `after()` hook.

### UI (`src/components/essays/essay-comment-thread.tsx`)

- New `currentProfileId` prop passed from the essay detail page.
- **Reply**: "Odpovědět" button per comment sets the reply target; composer placeholder
  becomes `Odpovědět na {name}...`; `POST` includes `parent_id`. Replies stay flat.
- **Edit**: "Upravit" button on own comments swaps body for an inline textarea with
  Save/Cancel; Save issues `PATCH`.
- **Delete**: "Smazat" button on own comments, `window.confirm`, then `DELETE`. Soft-deleted
  comments render as muted "Komentář byl smazán". Replies remain visible.

### Page (`src/app/(main)/cteni/eseje/[essayId]/page.tsx`)

- Pass `currentProfileId={profile.id}` to `EssayCommentThread`.

## Testing

- **Integration** (`tests/integration/`): reply insert with valid/invalid `parent_id`;
  edit owner vs non-owner; soft-delete owner/admin vs non-owner; removed rows filtered.
- **Component** (`essay-comment-thread.test.tsx`): reply target selection, inline edit
  save/cancel, delete confirm renders soft-deleted state.
- Verify `pnpm test`, `pnpm typecheck`, `pnpm lint` pass before finishing.
