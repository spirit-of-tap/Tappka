# Individual Coaching Sessions — Design

## Source

GitHub issue #53 ("Individualni koucovani (1v1)"), Phase 1 Quick Win (implementation
difficulty 1/5). The issue's "Návrh digitalizace" section describes a larger future
vision (1:1 booking, pre-session goals, notifications, coach approval sharing) — this
spec deliberately scopes down to a session log, matching the phase-1 intent and the
`customer_meetings` reference feature's level of effort.

## Scope

Build a session log feature that mirrors the existing `customer_meetings` feature
(schema → RLS → queries → components → pages → team stats) as closely as possible.
Explicitly out of scope for this iteration:

- 1:1 booking / scheduling
- Pre-session goals/agendas (LC review, skill profile, rocket model)
- Notifications / reminders
- Coach approval or sharing workflow
- Import script for the 990 historical rows in `individual.xlsx` (the app feature only;
  historical data import is a separate future task)
- Dashboard `MetricsCard` widget (kept out — not important enough to justify changing
  a shared 2-column layout)

## Data model

New table `individual_coaching_sessions` in `db/schema/individual-coaching-sessions.ts`,
following the exact shape of `db/schema/customer-meetings.ts`:

| column | type | notes |
|---|---|---|
| `id` | `uuid` pk | `defaultRandom()` |
| `profile_id` | `uuid` not null | fk → `profiles.id`, `onDelete: cascade` |
| `session_at` | `timestamptz`, nullable | mirrors `meeting_at` — supports an "undated" bucket in the list UI |
| `coach_profile_id` | `uuid`, nullable | fk → `profiles.id`, `onDelete: set null` — set when the coach is an internal profile (the majority case) |
| `external_coach_name` | `text`, nullable | set when the coach is external to the org (the minority case) |
| `key_takeaways` | `text`, nullable | post-session insights; optional since a session can be logged before it's held |
| `action_steps` | `text`, nullable | post-session action items; optional |
| `removed_at` | `timestamptz`, nullable | soft delete |
| `created_at` | `timestamptz` not null | `defaultNow()` |
| `updated_at` | `timestamptz` not null | `defaultNow()` |
| `created_by_profile_id` | `uuid` not null | fk → `profiles.id`, `onDelete: restrict` |
| `updated_by_profile_id` | `uuid` not null | fk → `profiles.id`, `onDelete: restrict` |

No `overall_self_assessment` column (dropped per user decision — the Excel field is a
whole-of-studies summary, not a natural fit for a per-session row, and isn't needed for
this scope).

**Coach modeling** (added after the initial design pass, before migration): coaches are
usually existing `profiles` with `role = 'coach'`, but a student can occasionally be
coached by someone external to the org. Rather than a single free-text `coach_name`,
exactly one of `coach_profile_id` / `external_coach_name` is set — enforced by a check
constraint (`(coach_profile_id IS NOT NULL) <> (external_coach_name IS NOT NULL)`,
following the existing `check(...)` pattern used elsewhere in `db/schema/*.ts`, e.g.
`reservations.ts`'s `valid_time_range`). This mirrors the existing
`essay_coach_reads.coach_profile_id` → `profiles` relationship and its
`coach:profiles!coach_profile_id(id, name, role)` embed pattern already used in
`src/lib/essays/queries.ts`. `onDelete: set null` on the FK means a later-deleted coach
profile doesn't cascade-delete or block deletion of historical sessions — the session
just loses its live link (the UI falls back to showing nothing rather than a frozen
name, since the point of linking is to always reflect the coach's current profile name).
The picker in the form lists all `role = 'coach'` profiles org-wide (a student's coach
isn't always on their own team); selecting one auto-fills and locks the display name
to that profile's name, while choosing "external" reveals a free-text name field instead
— the two modes don't overlap.

Indexes (matching `customer_meetings`, plus one for the new FK):
- `individual_coaching_sessions_profile_idx` on `profile_id`
- `individual_coaching_sessions_coach_idx` on `coach_profile_id` (matches the existing
  `essay_coach_reads_coach_idx` precedent for a `coach_profile_id` column)
- `individual_coaching_sessions_created_desc_idx` on `created_at desc`

RLS (enabled, 4 permissive policies for `authenticated`, identical shape to
`customer_meetings`): a profile can select/insert/update/delete only rows where
`profile_id = current_profile_id()`.

## Excel field mapping (for reference / future import)

| Excel label | Column |
|---|---|
| Datum | `session_at` |
| Kouč | `coach_profile_id` (matched to a `profiles` row) or `external_coach_name` if no match |
| Co jsem si odnesl / uvědomění | `key_takeaways` |
| Akční kroky po koučování | `action_steps` |

("Sebehodnotící zpráva" has no column — out of scope, see above.)

## Routing & naming

- List page: `/koucovani` — title "Individuální koučování | Tappka"
- Detail page: `/koucovani/[sessionId]`
- Same access gate as `/schuzky`: redirect to `/auth/login` if unauthenticated,
  redirect to `/` if `!profile.beta_access_granted_at`

## Code layout

Mirrors the `customer-meetings` file layout:

- `src/lib/individual-coaching-sessions/types.ts`:
  - `IndividualCoachingSession = Tables<"individual_coaching_sessions">`
  - `IndividualCoachingSessionWithCoach extends IndividualCoachingSession { coach: Pick<Profile, 'id' | 'name' | 'picture'> | null }`
  - `coachDisplayName(session)` — returns `session.coach?.name ?? session.external_coach_name ?? ""`
- `src/lib/individual-coaching-sessions/queries.ts`:
  - `listIndividualCoachingSessions(supabase, profileId)` → `IndividualCoachingSessionWithCoach[]`,
    embedding `coach:profiles!coach_profile_id(id, name, picture)`
  - `countIndividualCoachingSessions(supabase, profileId)`
  - `getIndividualCoachingSession(supabase, id)` → `IndividualCoachingSessionWithCoach | null`
  - `listCoachProfiles(supabase)` → `Pick<Profile, 'id' | 'name' | 'picture'>[]` of all
    `role = 'coach'` profiles, for the form's picker
  - `getTeamCoachingSessionStats(teamId)` — returns `TeamMemberCoachingStats[]`
    (same shape as `TeamMemberMeetingStats`), using the admin client like
    `getTeamCustomerMeetingsStats`
- `src/components/individual-coaching-sessions/`:
  - `individual-coaching-session-list.tsx` — month-grouped list + create dialog,
    same structure as `customer-meeting-list.tsx`, displaying `coachDisplayName(session)`
  - `individual-coaching-session-form.tsx` — fields: `session_at` (datetime-local,
    optional), a coach `Select` populated from `coachProfiles` plus an "external" option
    that reveals a free-text name input (required in either mode), `key_takeaways`
    (textarea, optional), `action_steps` (textarea, optional)
  - `individual-coaching-session-detail.tsx` — detail view with edit/delete, showing
    `coachDisplayName(session)`
  - `info-card.tsx` — short explainer card, same pattern as customer-meetings' info-card
- `src/app/(main)/koucovani/page.tsx` and `src/app/(main)/koucovani/[sessionId]/page.tsx`

## Integration points

- **Dashboard**: none. `MetricsCard` is not touched.
- **Profile page** (`komunita/profil/[id]/page.tsx`): add a coaching-session count
  stat next to the existing meeting count stat, using `countIndividualCoachingSessions`.
- **Team page** (`komunita/tymy/[id]/page.tsx`): add a new "Koučování" tab containing
  `TeamCoachingSessionsChart` (`src/components/teams/team-coaching-sessions-chart.tsx`),
  a bar chart matching `TeamCustomerMeetingsChart`'s structure with a distinct bar
  color, fed by `getTeamCoachingSessionStats`.

## Testing

- `tests/integration/individual-coaching-sessions.int.test.ts` — verifies RLS:
  a profile can insert/select/update/soft-delete its own rows; another profile's
  client cannot see or modify them. Also verifies the `coach_profile_id` /
  `external_coach_name` check constraint rejects both-null and both-set inserts
  (same style as the existing `feedback_body_check` / `valid_time_range` constraint
  tests). (No integration test exists for `customer_meetings` today, but CLAUDE.md's
  testing rules require DB/RLS coverage live in the integration layer, so this is
  added net-new here.)
- No new unit/component tests planned beyond that, matching the reference feature's
  level of test coverage.

## Migration

Schema edit in `db/schema/individual-coaching-sessions.ts` → `pnpm db:migrate` →
review the generated migration for unexpected drops before applying, per CLAUDE.md.
