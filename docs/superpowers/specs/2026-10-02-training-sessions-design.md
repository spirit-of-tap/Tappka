# Training Sessions (TS) — Design

## Source

Brainstorm with the product owner on 2026-10-02 (preceded by an external
ChatGPT ideation thread). Training sessions replace lectures: each team runs
its own ~4h sessions (1st/2nd year twice a week, 3rd year once), facilitated
by team members, on a topic known well in advance, with preparation published
later. Today they live in a Microsoft List, where it is hard to see which
sessions fall on the same day and whether a session collides with your own.

**Roadmap note:** this is a deliberate exception to the winter 2026/27
stabilization phase (no new modules), approved by the product owner.

## Goals

- One place where a student sees *what concerns them*: their team's upcoming
  TS, sessions they joined elsewhere, and whether preparation is ready.
- A community-wide catalog to discover other teams' TS and take a guest seat,
  with live occupancy and a clear warning when it overlaps your own TS.
- Preparation written in the same rich editor as essays, so that the archive
  of past TS is searchable and readable as inspiration for future facilitators.
- Attendance and a single team reflection per TS, private to the team.

## Scope

In v1:

- TS CRUD (team-owned), cancel/restore, facilitators
- Preparation (Tiptap, draft → published)
- Team reflection (Tiptap)
- Attendance (team members + guests), reusing the Týmový deník selector
- Guest seats with capacity, atomic join/leave, realtime occupancy
- Participant overlap warning
- "New TS" prefilled from the team's existing recurring TS schedule in Rezervace
- Přehled + Objevovat pages, TS detail, full-text search over topic + preparation

Out of scope (deferred):

- Email / in-app / MS Teams notifications (e.g. "preparation published")
- Semester schedule generator for TS records
- Booking or modifying rooms from a TS — Rezervace stays the source of truth
  for room occupancy and is not touched by this module
- Calendar view
- Coach/admin management of other teams' TS
- **Unrelated bug, noted for stabilization:** `reservations.no_overlap` lost its
  `WHERE status='active'` predicate in `20260226001550` and was never given
  `WHERE cancelled_at IS NULL`, so cancelled reservations still block the slot.

## Roles & access summary

| | Owning team member | Other authenticated (students, mentors, coaches, admins) |
|---|---|---|
| TS basics, facilitators, guest list | read + write | read |
| Preparation (published) | read + write | read |
| Preparation (draft) | read + write | — |
| Reflection | read + write | — |
| Attendance | read + write | — |
| Guest seat | — (own team cannot be guest) | join / leave own seat |

"Team member" = `profiles.team_id = training_sessions.team_id` for
`current_profile_id()` with `access_removed_at IS NULL`. Coaches/admins get no
elevated rights in this module (observers who may take a guest seat).
The module is gated to **beta cohort B** like other team modules
(`src/lib/feature-access.ts`).

## Data model

All tables in a new `db/schema/training-sessions.ts`, RLS enabled, following
house conventions (`created_by_profile_id` / `updated_by_profile_id`,
`created_at` / `updated_at` with `handle_updated_at` trigger, `removed_at`
soft delete where noted). All timestamps `timestamptz`; UI renders Prague time.

### `training_sessions`

| column | type | notes |
|---|---|---|
| `id` | `uuid` pk | |
| `team_id` | `uuid` not null | fk → `teams.id` |
| `topic` | `text` not null | 1–200 chars |
| `description` | `text` null | short plain-text blurb, ≤ 2000 chars |
| `starts_at` | `timestamptz` not null | |
| `ends_at` | `timestamptz` not null | CHECK `ends_at > starts_at` |
| `room_id` | `uuid` null | fk → `rooms.id`; display only, no booking |
| `location_note` | `text` null | e.g. "venku", "online", ≤ 200 chars |
| `guest_capacity` | `integer` not null default 0 | CHECK `0..50`; 0 = closed to guests |
| `cancelled_at` | `timestamptz` null | cancel ≠ delete; restorable |
| `cancelled_by_profile_id` | `uuid` null | |
| `removed_at` | `timestamptz` null | soft delete for mistakes only |
| audit columns | | |

Indexes: `(team_id, starts_at)`, `(starts_at)` where `removed_at IS NULL`.

Derived status (never stored): `cancelled` if `cancelled_at`; else `past` if
`ends_at <= now()`; `ongoing` if started; else `upcoming`.

RLS: select for all authenticated where `removed_at IS NULL`; insert/update
only by owning-team members (`withCheck` keeps `team_id` = own team). No hard
delete.

### `training_session_facilitators`

`(training_session_id, profile_id)` pk, audit `created_*`. Select: all
authenticated. Insert/delete: owning-team members, and `withCheck` requires
`profile_id` to belong to the session's team.

### `training_session_preparations`

1:1 with session (`training_session_id` pk/fk). `content_json jsonb not null`
(Tiptap doc, same extensions as essays), `content_text text not null` (plain
text extracted server-side on save, used for search), `published_at
timestamptz null` (null = draft), audit columns.

Select: all authenticated when `published_at IS NOT NULL`, otherwise owning
team only. Insert/update: owning team. Unpublishing is allowed (sets
`published_at` back to null).

### `training_session_reflections`

1:1 with session. `content_json jsonb not null`, `content_text text not null`,
audit columns. All operations owning team only. The UI enables editing once
the session has started.

### `training_session_attendees`

`(training_session_id, profile_id)` pk, `status attendance_status not null`
(reuses the existing enum from `team-activities.ts`), audit columns. All
operations owning team only; `withCheck` requires `profile_id` to be either a
member of the session's team or a current guest of the session. As in Týmový
deník, unrecorded = absent.

### `training_session_guests`

`(training_session_id, profile_id)` pk, `joined_at timestamptz default now()`.
Select: all authenticated (who is coming is public). **No direct
insert/delete policies** — writes only via the RPCs below.

## Database functions & triggers (custom migrations)

Created via `pnpm db:generate:custom`, `CREATE OR REPLACE`, `search_path ''`.

- `join_training_session(p_session_id uuid) returns integer` (new guest count),
  `SECURITY DEFINER`. Locks the session row `FOR UPDATE`, then raises with a
  stable code in `MESSAGE` if: `not_found` (missing/removed), `cancelled`,
  `already_started` (`starts_at <= now()`), `own_team`, `capacity_full`
  (current guests ≥ `guest_capacity`). Idempotent for an existing seat.
- `leave_training_session(p_session_id uuid) returns integer`,
  `SECURITY DEFINER`. Removes caller's seat; refuses `already_started`.
- `search_training_sessions(p_query text) returns setof uuid`,
  `SECURITY INVOKER` (RLS applies): ids of sessions whose `topic`,
  `description`, or **published** preparation `content_text` match
  `ILIKE '%' || p_query || '%'`.
- Capacity guard: updating `guest_capacity` below the current guest count is
  rejected in the API (409 with the current count); no guest is auto-removed.
- Realtime trigger `broadcast_training_session_change` on
  `training_session_guests` (insert/delete) and `training_sessions` (update of
  `starts_at`, `ends_at`, `room_id`, `location_note`, `guest_capacity`,
  `cancelled_at`, `topic`): `realtime.send(payload, event,
  'community:training_sessions:feed', true)`.
  - Events: `guest_joined`, `guest_left`, `session_updated`.
  - Payload: `{ session_id, guest_count }` (+ `profile_id` for guest events).
- `realtime.messages` policy: authenticated may `select` where
  `realtime.topic() = 'community:training_sessions:feed'`; no insert policy
  (server-only sender).

## Shared logic (`src/lib/training-sessions/`)

- `types.ts` — derived DB types via `Tables<'training_sessions'>` etc., status
  union, event name constants.
- `status.ts` — `getSessionStatus(session, now)`.
- `slots.ts` — `getUpcomingTeamSlots({ schedules, breaks, existingSessions,
  now, limit })`: walks the team's active `recurring_schedules`
  (`schedule_type = 'training_session'`) week by week, skips
  `schedule_breaks` dates and dates where a non-removed TS already starts,
  converts via `pragueLocalToUtcISO`, returns up to `limit` (default 6)
  `{ startsAt, endsAt, roomId }`.
- `conflicts.ts` — `findConflicts(candidate, commitments)`: overlap is
  `a.start < b.end && a.end > b.start`; returns overlapping commitments with
  the overlapping interval. Commitments = own team's non-cancelled TS + TS where
  the user is a guest.
- `queries.ts` — supabase-js query helpers (`SupabaseClient<Database>`).
- `tiptap-text.ts` — extract plain text from Tiptap JSON (reuse essay helper if
  one exists).

## API

Under `src/app/api/training-sessions/`, zod-validated, Czech error messages,
following `src/app/api/tymovy-denik/activities/` conventions.

| route | method | purpose |
|---|---|---|
| `/` | POST | create TS (+ facilitators) |
| `/[id]` | PATCH | edit basics, facilitators, capacity; cancel/restore |
| `/[id]` | DELETE | soft delete (`removed_at`) |
| `/[id]/preparation` | PUT | save draft / publish / unpublish |
| `/[id]/reflection` | PUT | save reflection |
| `/[id]/attendance` | PUT | replace attendance set |
| `/[id]/guests` | POST / DELETE | join / leave via RPCs; RPC codes → HTTP 409 + code |

## UI

Routes under `src/app/(main)/ts/`, tab bar modeled on
`src/components/cteni/cteni-tab-bar.tsx`. Components under
`src/components/training-sessions/`.

| route | content |
|---|---|
| `/ts` | redirect → `/ts/prehled` |
| `/ts/prehled` | **Přehled** — what concerns me |
| `/ts/objevovat` | **Objevovat** — all TS |
| `/ts/nova` | create (team members only) |
| `/ts/[id]` | detail |
| `/ts/[id]/upravit` | edit basics |

Navigation: new `NAV_MODULES` entry "Tréninkové sessions" with `feature`
gate for cohort B, added to `MODULE_HUB_ORDER` and spotlight.

### Přehled

- **Nejbližší TS** — prominent card: day, time, room, team, topic,
  facilitators, preparation state ("Příprava je zveřejněná" / "Příprava zatím
  chybí") with a CTA to open it.
- **Facilitace** — sessions where I facilitate and preparation is unpublished,
  nudging "Přidat přípravu".
- **Nadcházející** — rest of my commitments (own team + joined), grouped by day.
- **Chybí reflexe** — own team's past, non-cancelled TS without a reflection.
- Users without a team see only joined sessions + link to Objevovat.
- Empty states via `Empty*`.

### Objevovat

- Agenda grouped by day headings ("Úterý 6. října"), chronological.
- Filter chips: `Nadcházející` (default) · `Volná místa` · `Můj tým` ·
  `Přihlášené` · `Proběhlé`; ročník filter (1/2/3, via existing `YEAR_LABELS`
  interpretation of `teams.onboardingYear`); search box → `search_training_sessions`.
- Card: time range · team badge (`teams.color` dot + name, plus "Můj tým"
  label for own team) · topic (largest text) · room / location · facilitators
  · guest occupancy `3/5` · `Přihlásit se` / `Odhlásit se`. Cancelled cards are
  muted with a "Zrušeno" badge. Capacity 0 → no guest controls.
- Overlap: card shows "Kryje se s tvým TS · 10:00–12:00"; joining asks for
  confirmation in a responsive `AlertDialog` but never blocks.
- Live occupancy via `useTrainingSessionFeed()` (private channel, cleanup on
  unmount); on `session_updated` the affected card refetches.

### TS detail

Header: topic, team, day/time, room, facilitators, status badge, guests list.
Inner tabs: `Přehled` · `Příprava` · `Docházka` · `Reflexe` (last two shown
only to the team; Reflexe enabled once started). Team members get a ⋮ menu:
Upravit · Zrušit TS (`AlertDialog`) / Obnovit · Smazat (`AlertDialog`).

- Příprava: Tiptap editor (reuse `tiptap-editor.tsx` / `tiptap-renderer.tsx`)
  with `Uložit koncept` and `Zveřejnit` / `Zrušit zveřejnění`.
- Docházka: `attendance-selector.tsx` over team members + guests.
- Reflexe: Tiptap editor, single shared document, shows last editor + time.

### New / edit form

Top: chips with the team's next free slots ("Út 6. 10. · 8:00–12:00 · E209");
clicking fills date, time, room. Fields: topic, description, date, start/end,
room (select from `rooms` where not removed) or location note, facilitators
(multi-select of team members), guest capacity. Teams without a schedule fill
everything manually.

### Design & copy

Follow `DESIGN.md`: `PageShell`/`PageHeader`, semantic tokens only, both
themes, one sonner toast per mutation, gender-neutral Czech
(e.g. "Facilitující", "Přihlášená místa" rather than "hosté"; `:` separator
where unavoidable).

## Error handling

| situation | behavior |
|---|---|
| `capacity_full` | toast "Volná místa už jsou obsazená", card refetches occupancy |
| `already_started` | toast "TS už začalo, přihlášení je uzavřené" |
| `cancelled` | toast "TS bylo zrušeno" |
| `own_team` | button never shown; API still returns 409 |
| capacity < current guests | 409 "Obsazeno je už N míst" |
| non-team write | RLS denies → 403 |

## Testing

- **Unit** (`src/lib/training-sessions/*.test.ts`): `getUpcomingTeamSlots`
  (breaks, DST switch, existing TS, `valid_from/valid_until`), `findConflicts`,
  `getSessionStatus`, Tiptap text extraction.
- **Integration** (`tests/integration/training-sessions.int.test.ts`): RLS per
  table (draft vs published preparation, team-only reflection/attendance,
  non-team writes denied, guest table not directly writable); join RPC
  (capacity, last-seat race with two connections, started, cancelled, own
  team, idempotency); leave RPC; search respects draft visibility. Extend
  `tests/setup/bootstrap.sql` with `realtime.send` / `realtime.topic` stubs if
  missing; add factories.
- **Component**: session card states (mine, full, overlap, cancelled, closed),
  Objevovat filters, slot chips.
- **E2E** (`tests/e2e/training-sessions.spec.ts`): create TS from a slot →
  publish preparation → member of another team joins → record attendance →
  write reflection.
