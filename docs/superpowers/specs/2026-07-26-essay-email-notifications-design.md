# Essay Email Notifications — Design

## Problem

Students get no signal when a coach reads their essay, when someone comments on it, or when someone votes ("likes") it — they have to keep checking the app. Add opt-in-by-default email notifications for these three events, with per-event toggles in a new personal settings page.

## Scope

In scope: email notifications for `essay_comments` insert, `essay_votes` insert, `essay_coach_reads` first-insert (per coach per essay). Per-event on/off toggle. Out of scope: in-app notification center, digesting/batching multiple events into one email, notifications for essay views (passive `essay_views`), notifications for anything outside the reading/essay section.

## Decisions (already made)

- **Email provider**: Resend.
- **From address**: `Tappka <notifications@tiimi.cz>`.
- **Send timing**: immediate, non-blocking — using Next.js `after()` (not bare fire-and-forget) so the callback isn't killed when the serverless function freezes right after the response is sent.
- **Toggle granularity**: three independent switches, not one master toggle.
- **Default state**: all three default ON.
- **Recipient address**: `profiles.work_email` (always present, verified) — not `personal_email`.
- **Settings location**: new page, not bolted onto an existing one.
- **Language**: Czech, matching the rest of the app's UI.
- **No batching/digest**: each event sends its own email (e.g., a burst of comments sends a burst of emails). Acceptable for MVP; flagged here as the first thing to revisit if it becomes noisy.
- **No self-notifications**: if the actor triggering the event is the essay's author, skip sending (defense in depth — e.g. an admin reading/commenting on their own essay shouldn't self-notify).

## Data model

New table `notification_preferences`, 1:1 with `profiles`, following the existing audit-column convention (see `db/schema/essays.ts` for the pattern being matched):

```ts
export const notificationPreferences = pgTable("notification_preferences", {
  profileId: uuid("profile_id").primaryKey().notNull(),
  essayCoachReadEmail: boolean("essay_coach_read_email").default(true).notNull(),
  essayCommentEmail: boolean("essay_comment_email").default(true).notNull(),
  essayVoteEmail: boolean("essay_vote_email").default(true).notNull(),
  createdAt: timestamp(...).defaultNow().notNull(),
  updatedAt: timestamp(...).defaultNow().notNull(),
  createdByProfileId: uuid("created_by_profile_id").notNull(),
  updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
  foreignKey({ columns: [table.profileId], foreignColumns: [profiles.id], name: "notification_preferences_profile_id_fkey" }).onDelete("cascade"),
  pgPolicy("Users manage their own notification preferences", { as: "permissive", for: "all", to: ["authenticated"], using: sql`(profile_id = current_profile_id())`, withCheck: sql`(profile_id = current_profile_id())` }),
]).enableRLS();
```

No row is required to exist for every profile. A missing row means "all three ON" at the application layer — this avoids a backfill migration for existing profiles. A row is created (upserted) only the first time a user flips a toggle.

## Email sending

- New dependency: `resend`.
- Env var `RESEND_API_KEY` (secret; goes in `.env.local`, not `.env.example`).
- `src/lib/notifications/constants.ts` — `NOTIFICATION_FROM_EMAIL = 'Tappka <notifications@tiimi.cz>'`.
- `src/lib/notifications/send-email.ts` — thin wrapper creating a lazily-instantiated Resend client and a `sendEmail({ to, subject, html })` function.
- `src/lib/notifications/email-templates.ts` — plain HTML-string templates (no `react-email`; three simple transactional emails don't justify a templating library), one per event type, each linking to `/eseje/{essayId}`.
- `src/lib/notifications/essay-notifications.ts` — three exported functions:
  - `notifyEssayCommented(supabase, { essayId, commenterProfileId })`
  - `notifyEssayVoted(supabase, { essayId, voterProfileId })`
  - `notifyEssayCoachRead(supabase, { essayId, coachProfileId })`

  Each function:
  1. Fetches the essay's `author_profile_id` + title via a new `getEssayAuthorInfo(supabase, essayId)` query in `src/lib/essays/queries.ts`.
  2. Returns early if `authorProfileId === actorProfileId` (self-notification guard).
  3. Fetches the author's profile (`getProfileById` from `src/lib/komunita/queries.ts`) for `work_email`/`name`.
  4. Reads `notification_preferences` for the author; treats a missing row as all-true; returns early if the relevant column is `false`.
  5. Sends the email via `sendEmail(...)`, catching and logging errors (a failed send must never surface as a user-facing error).

## Route changes

- `src/app/api/essays/[id]/comments/route.ts` (`POST`): after the successful insert, `after(() => notifyEssayCommented(...).catch(console.error))` before returning the response.
- `src/app/api/essays/[id]/vote/route.ts` (`POST`): same, after successful insert. (Duplicate votes already 409 before this point, so every 201 is a genuinely new vote — no dedup needed.)
- `src/app/api/essays/[id]/coach-read/route.ts` (`POST`): needs a small behavioral fix first. It currently does `.upsert(..., { ignoreDuplicates: true })` with no `.select()`, so there's no way to distinguish "first read" from "already read, re-opened." Add `.select()` to the upsert — with `ignoreDuplicates: true`, PostgREST only returns a row for genuinely new inserts — and only fire `notifyEssayCoachRead` when a row comes back. Without this fix, a coach re-opening an already-read essay would re-notify the author every time.

`after` is imported from `next/server` (stable in Next 16). This is the reason the design uses `after()` rather than a bare unawaited promise: without it, sending happens in a background task that can be frozen by the platform the instant the response is flushed, silently dropping emails.

## Settings UI

- New route `/settings/notifikace`:
  - `src/app/(main)/settings/notifikace/page.tsx` — server component, auth-required (redirect to `/auth/login` if no user), no role gate. Fetches current preferences (defaulting missing values to `true`) and passes as `initial*` props to a client component, mirroring `src/app/(main)/settings/kniha-knih/page.tsx`.
  - `src/components/settings/notification-preferences-form.tsx` — client component, three shadcn `Switch` rows, one per event type, each following the exact optimistic-update pattern in `src/components/beta/beta-page-content.tsx` (local `useState` mirroring server value → optimistic set → `fetch` PATCH → rollback state on non-OK response → `router.refresh()`).
- New route `src/app/api/profile/notification-preferences/route.ts`:
  - `PATCH`: auth check → `getCurrentUserProfile` → validate body is a partial `{ essay_coach_read_email?, essay_comment_email?, essay_vote_email?: boolean }` → upsert onto `notification_preferences` with `onConflict: 'profile_id'`, merging with existing values (so toggling one switch doesn't reset the others to their column defaults) → return updated row.
- `src/components/nav-user.tsx`: add a "Notifikace" entry to the avatar dropdown, linking to `/settings/notifikace`. This is the first personal-account entry point in that menu.

## Testing

- `tests/integration/notification-preferences.int.test.ts` (same shape as `tests/integration/essay-votes.int.test.ts`: seed via raw SQL + `withRollback`):
  - A profile cannot read or write another profile's `notification_preferences` row (RLS).
  - A profile can upsert its own row and read it back.
- Unit tests for `src/lib/notifications/essay-notifications.ts` with the Resend client mocked:
  - Self-notification (actor === author) is skipped, no send attempted.
  - Preference explicitly `false` skips the send.
  - Missing preference row still sends (default-true).
  - Happy path calls `sendEmail` with the expected `to`/subject/link.
- Regression test for the coach-read dedup fix: inserting the same `(essay_id, coach_profile_id)` pair twice only triggers one notification (second upsert returns no row).

## Rollout note

Requires a schema migration (`notification_preferences` table) — per project convention, run `pnpm db:migrate` and check the generated migration for unexpected drops before applying.
