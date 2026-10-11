# Timetracking (Čas) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the core of the Čas module: T/R/P time entries with a live timer, manual entries, personal tags, weekly 40 h progress, a team overview, and automatic `training` entries from Training Session attendance. Beta cohort B.

**Architecture:** Two new tables (`time_tags`, `time_entries`) in `db/schema/time-tracking.ts` with DB-enforced invariants (one running timer, no overlaps via `btree_gist` exclusion). Pure logic in `src/lib/time-tracking/*` (TDD). Route Handlers under `src/app/api/time-entries` and `src/app/api/time-tags`. A `TimerProvider` context hydrated in `(main)/layout.tsx` drives the desktop sidebar widget and the mobile bottom-bar Play button. Two server pages `/cas` and `/cas/tym`. A `SECURITY DEFINER` trigger syncs attendance → entries.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Drizzle Kit migrations, Supabase (RLS, `supabase-js`), shadcn/ui + `vaul`, `react-hook-form` + zod, `date-fns` (`cs`), vitest (unit/component/integration), Playwright.

**Design doc:** `docs/plans/2026-09-24-timetracking-design.md`

**Order of work:** Tasks 1–5 are the backend and can be verified without UI. Tasks 6–9 are UI. Task 10 is docs + E2E. Each task ends with `pnpm typecheck && pnpm lint && pnpm test` green.

---

## Task 1: Schema — enums, `time_tags`, `time_entries`, RLS

**Files:**
- Create: `db/schema/time-tracking.ts` (drizzle-kit reads the whole `db/schema` directory, no index to update)
- Generated: `supabase/migrations/*_time_tracking.sql`, `src/lib/supabase/database.types.ts`

**Step 1: Write the schema**

Follow `db/schema/team-activities.ts` style (tabs, `pgPolicy` with full `using`/`withCheck`, `.enableRLS()`). Include:

- `timeDirection = pgEnum("time_direction", ["training", "reading", "practise"])`
- `timeEntrySource = pgEnum("time_entry_source", ["timer", "manual", "attendance"])`
- `timeTags` with unique index on `(profile_id, lower(btrim(name)))` (use `sql` expression index) and name length check.
- `timeEntries` with columns from the design doc, FK `attendance_id → team_activity_attendees.id on delete cascade` (unique), checks `end_after_start`, `duration_matches` (no minimum length), indexes `(profile_id, started_at desc)` and partial `(tag_id) where tag_id is not null`, partial unique `(profile_id) where ended_at is null`.
- Four policies per table exactly as in design §3. Team visibility subquery:

```sql
profile_id in (
  select p.id from profiles p
  where p.team_id is not null
    and p.access_removed_at is null
    and p.team_id = (select team_id from profiles where id = current_profile_id())
)
```

**Step 2: Generate and review**

Run: `pnpm db:generate`
Expected: one new migration with `CREATE TYPE ×2`, `CREATE TABLE ×2`, indexes, policies. **No `DROP`.** Ask the user to confirm the migration has no drops.

**Step 3: Custom migration for what Drizzle cannot express**

Run: `pnpm db:generate:custom` → name it `time_entries_exclusion`. Write idempotent SQL:

```sql
create extension if not exists btree_gist;
alter table public.time_entries
  drop constraint if exists time_entries_no_overlap;
alter table public.time_entries
  add constraint time_entries_no_overlap
  exclude using gist (
    profile_id with =,
    tstzrange(started_at, coalesce(ended_at, 'infinity'::timestamptz), '[)') with &&
  );
```

**Step 4: Apply and regenerate**

Prompt the user to run `pnpm db:migrate`. Then `pnpm db:generate` once more (expect "No schema changes") so the Drizzle journal records the custom migration. Verify `database.types.ts` contains `time_entries`, `time_tags`, `time_direction`.

**Step 5: Integration tests for invariants and RLS**

Create `tests/integration/time-tracking.int.test.ts` using `withRollback`, `asClaims`, factories:

- owner can insert/select/update/delete own entry; teammate can select but not update/delete; other-team student sees nothing; coach and admin select all.
- second running timer for the same profile → unique violation `23505`.
- overlapping closed entries → exclusion violation `23P01`.
- `ended_at <= started_at` → check violation.
- `insert` with `source = 'attendance'` by a regular user is rejected by RLS.

If bootstrap lacks `btree_gist`, add `create extension if not exists btree_gist;` to `tests/setup/bootstrap.sql`.

Run: `pnpm test:integration -- time-tracking`
Expected: PASS.

**Step 6: Commit**

```bash
git add db/schema/time-tracking.ts supabase/migrations/*time_tracking* supabase/migrations/*time_entries_exclusion* supabase/migrations/meta src/lib/supabase/database.types.ts tests/integration/time-tracking.int.test.ts
git commit -m "feat(cas): add time_tags and time_entries schema with RLS and overlap exclusion"
```

---

## Task 2: Attendance → training entry trigger

**Files:**
- Create: `supabase/migrations/*_sync_training_session_time_entry.sql` (via `pnpm db:generate:custom`)
- Test: `tests/integration/time-tracking-attendance.int.test.ts`

**Step 1: Write failing integration tests**

Scenarios (team with a `recurring_schedules` row `training_session`, Monday 08:00–12:00, valid range covering the activity date; `team_activities` row with `activity_type = 'training_session'` on a Monday):

1. insert attendee `present` → one `time_entries` row: `direction = 'training'`, `source = 'attendance'`, `title = 'Training Session'`, `attendance_id` set, window 08:00–12:00 Europe/Prague converted to UTC.
2. attendee already has an overlapping manual entry → no auto row (count unchanged).
3. update status `present → absent` → auto row deleted.
4. auto row edited by the user (`updated_by_profile_id <> created_by_profile_id`) then status → absent → row kept.
5. team has no schedule for that weekday → no row.
6. inserting `present` twice / re-updating to `present` → still exactly one row (idempotent).

Run: `pnpm test:integration -- time-tracking-attendance` → FAIL.

**Step 2: Write the function + trigger**

```sql
create or replace function public.sync_training_session_time_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activity public.team_activities%rowtype;
  v_schedule public.recurring_schedules%rowtype;
  v_start timestamptz;
  v_end timestamptz;
begin
  select * into v_activity from public.team_activities where id = new.activity_id;
  if v_activity.activity_type <> 'training_session' or v_activity.removed_at is not null then
    return new;
  end if;

  if new.status <> 'present' then
    delete from public.time_entries
      where attendance_id = new.id
        and source = 'attendance'
        and updated_by_profile_id = created_by_profile_id;
    return new;
  end if;

  if exists (select 1 from public.time_entries where attendance_id = new.id) then
    return new;
  end if;

  select * into v_schedule
    from public.recurring_schedules
    where team_id = v_activity.team_id
      and schedule_type = 'training_session'
      and removed_at is null
      and day_of_week = extract(dow from v_activity.occurred_at)  -- 0 = neděle, shodné s JS getDay()
      and valid_from <= v_activity.occurred_at
      and (valid_until is null or valid_until >= v_activity.occurred_at)
    order by start_time
    limit 1;
  if not found then
    return new;
  end if;

  v_start := (v_activity.occurred_at + v_schedule.start_time) at time zone 'Europe/Prague';
  -- TODO(TS module #60): once team_activity_attendees.hours exists, use start_time + hours.
  v_end := (v_activity.occurred_at + v_schedule.end_time) at time zone 'Europe/Prague';

  begin
    insert into public.time_entries (
      profile_id, direction, title, started_at, ended_at, duration_ms, source, attendance_id,
      created_by_profile_id, updated_by_profile_id
    ) values (
      new.profile_id, 'training', 'Training Session', v_start, v_end,
      (extract(epoch from v_end - v_start) * 1000)::bigint, 'attendance', new.id,
      new.profile_id, new.profile_id
    );
  exception when exclusion_violation then
    -- Rule 1: a tracked entry in the TS window wins.
    null;
  end;
  return new;
end;
$$;

drop trigger if exists team_activity_attendees_sync_time_entry on public.team_activity_attendees;
create trigger team_activity_attendees_sync_time_entry
  after insert or update of status on public.team_activity_attendees
  for each row execute function public.sync_training_session_time_entry();
```

Note: `recurring_schedules.day_of_week` uses JS `getDay()` semantics (0 = Sunday … 6 = Saturday), see `src/app/api/recurring-schedules/route.ts:145`. Postgres `extract(dow …)` matches exactly; do **not** use `isodow`.

**Step 3: Apply, journal, export**

`pnpm db:up` → `pnpm db:generate` (expect no changes) → `pnpm db:types && pnpm db:export`. Run the tests → PASS. Commit with the `meta/` changes.

---

## Task 3: Pure logic in `src/lib/time-tracking`

**Files:**
- Create: `constants.ts`, `types.ts`, `duration.ts` + `.test.ts`, `week.ts` + `.test.ts`, `validation.ts` + `.test.ts`

**Step 1: Tests first** (vitest unit project). Cover:

- `formatDurationHms(5400000) === "01:30:00"`, `formatDurationShort(5400000) === "1 h 30 min"`, `formatDurationShort(60000) === "1 min"`.
- `parseDurationInput("1h 30m") === 5400000`, `"90" → 5400000`, `"0"` → null, garbage → null.
- `getWeekRange(new Date(2026, 8, 24))` → Mon 2026-09-21 00:00 to Mon 2026-09-28 00:00 (exclusive end), Prague local.
- `groupEntriesByDay` newest day first, entries within a day newest first, running timer first.
- `splitEntryAcrossDays` for 23:00–01:00 → two display segments; single-day entry unchanged.
- `summarize` returns `{ totalMs, byDirection: {training, reading, practise}, byTag: Map }` and ignores running timers unless `includeRunning` with `now`.
- `createEntrySchema` rejects end ≤ start, unknown direction, title > 120; accepts null tag.

**Step 2: Implement** with named constants (`WEEKLY_TARGET_HOURS`, `TITLE_PLACEHOLDER`, `LONG_TIMER_WARN_MS`, `LONG_TIMER_ALERT_MS`, `TIME_DIRECTIONS` as `{ value, label, dotClass }[]` using semantic tokens only).

Run: `pnpm test:unit` → PASS. Commit.

---

## Task 4: Queries

**Files:**
- Create: `src/lib/time-tracking/queries.ts`

Functions (all take `SupabaseClient<Database>`, throw on error, return derived types):

- `getActiveTimer(supabase, profileId)` → `TimeEntryWithTag | null` (`ended_at is null`, `maybeSingle`).
- `listEntries(supabase, { profileIds, from, to, direction?, tagId? })` → entries whose `started_at < to and (ended_at is null or ended_at > from)`, ordered `started_at desc`, `select("*, tag:time_tags(id, name)")`.
- `listTeamMembers(supabase, teamId)` → `profiles` `id, name, picture` with `access_removed_at is null`.
- `listTags(supabase, profileId)` ordered by name.
- `hasAttendanceWithoutSchedule(supabase, teamId, week)` → boolean for the `/cas/tym` warning (optional, can be deferred).

Covered by E2E and page usage; no unit tests (DB access).

---

## Task 5: Route Handlers

**Files:**
- Create: `src/app/api/time-entries/route.ts` (GET, POST)
- Create: `src/app/api/time-entries/[id]/route.ts` (PATCH, DELETE)
- Create: `src/app/api/time-entries/timer/route.ts` (GET, POST)
- Create: `src/app/api/time-tags/route.ts` (GET, POST), `src/app/api/time-tags/[id]/route.ts` (PATCH, DELETE)
- Create: `src/lib/time-tracking/api-errors.ts` + `.test.ts` (`mapDbError(error) → { status, message }`)

Pattern: copy the auth prelude from `src/app/api/personality-tests/route.ts` (`getClaims` → `getCurrentUserProfile` → 401/403). Every handler checks `canAccessFeature(profile, "timeTracking")` → 403 `Modul není dostupný`.

Behaviour:

- `POST /api/time-entries`: validate with `createEntrySchema`; `profile_id` always `profile.id`; `source = 'manual'`; compute `duration_ms` server-side; map `23P01`/`23505`/`23514` via `mapDbError`.
- `PATCH /api/time-entries/[id]`: partial update; recompute `duration_ms` whenever start or end changes; RLS enforces ownership (404 when zero rows).
- `DELETE`: RLS enforces ownership.
- `POST /api/time-entries/timer` `{ action: "start", direction, tagId?, title? }`: 1) stop active timer if any (same logic as stop), 2) insert `{ started_at: now, ended_at: null, source: 'timer' }`. Return the new row.
- `POST /api/time-entries/timer` `{ action: "stop" }`: fetch active; `duration = now - started_at`; update `ended_at` + `duration_ms` (no minimum length, always saved).
- `GET /api/time-entries/timer` → active or `null`.
- Tags: name trimmed, 1–40 chars, unique per profile (`23505` → 409 „Tag s tímto názvem už máš").

Test `api-errors.test.ts` (unit). Manual smoke with `curl` against the dev server. Commit.

---

## Task 6: Feature flag, navigation, metric, Spotlight

**Files:**
- Modify: `src/lib/feature-access.ts` (`timeTracking: ["B"]`), `src/lib/feature-access.test.ts`
- Modify: `src/lib/navigation.ts` (+ `Timer` icon, hub order after `/tymovy-denik`), `src/lib/navigation.test.ts`
- Modify: `src/lib/metrics/config.ts` (`MetricPeriod` + `"week"`, `unit` + `"hours"`, new `"time-weekly"`), `src/lib/metrics/periods.ts` (`getCurrentWeekRange` reusing `week.ts`), tests
- Modify: `src/components/spotlight/spotlight-items.ts` (Start/Stop časomíra actions, gated)

Check `MetricProgress` consumers handle `unit: "hours"` (formatting `12,5 h / 40 h`). Update tests. Commit.

---

## Task 7: TimerProvider, desktop widget, mobile Play, StartTimerSheet

**Files:**
- Create: `src/components/time-tracking/timer-provider.tsx`
- Create: `src/components/time-tracking/start-timer-sheet.tsx` + `.test.tsx`
- Create: `src/components/time-tracking/stop-timer-sheet.tsx`
- Create: `src/components/time-tracking/timer-widget.tsx` + `.test.tsx` (desktop)
- Create: `src/components/time-tracking/tag-combobox.tsx`
- Create: `src/components/time-tracking/long-timer-alert.tsx`
- Modify: `src/app/(main)/layout.tsx` (fetch active timer + `canAccess` server-side, wrap in `TimerProvider`)
- Modify: `src/components/app-sidebar.tsx` (mount `TimerWidget` when `canAccess`)
- Modify: `src/components/navigation/mobile-bottom-nav.tsx` + test (center Play/Stop control when `canAccess`; 4 tabs otherwise)

Details:

- `TimerProvider` props `{ initialActive, canAccess }`; state `active`, `elapsedMs` (1 s interval, `Date.now() - Date.parse(started_at)`), actions `start(payload)`, `stop()`, `refresh()` calling the timer API; `sonner` toasts on error. Exposes `useTimer()`; throws if used outside.
- `StartTimerSheet`: use the existing `src/components/ui/responsive-dialog.tsx` (Drawer on mobile, Dialog on desktop); confirmations use `responsive-alert-dialog.tsx`. Direction segmented control (required), `TagCombobox` (cmdk `Command` + create inline via `POST /api/time-tags`), title input with `TITLE_PLACEHOLDER`, submit on `Cmd/Ctrl+Enter`.
- `MobileBottomNav`: tabs become `[Domů, Moduly, <TimerTab/>, Komunita, Profil]`; `TimerTab` is a `button` (not `Link`), `aria-label` „Spustit časomíru" / „Zastavit časomíru", shows `HH:MM:SS` while running. Keep existing active-tab logic untouched; update `mobile-bottom-nav.test.tsx` for both variants.
- `TimerWidget` (sidebar): card under logo; collapsed sidebar → icon button with tooltip. Link „Otevřít Čas" → `/cas`.
- `LongTimerAlert`: toast at 6 h, `AlertDialog` at 12 h, ack in `sessionStorage` keyed by entry id.

Component tests: required direction blocks submit; placeholder text present; mobile Play hidden without access; widget shows elapsed. Verify light + dark. Commit.

---

## Task 8: `/cas` page

**Files:**
- Create: `src/app/(main)/cas/page.tsx` (server: auth, feature gate → `FeatureComingSoon`, week from `?w=YYYY-MM-DD`, fetch entries + tags, render)
- Create: `src/components/time-tracking/time-page-view.tsx` (client owner: header CTA + FAB, week nav, `MetricProgress`, direction summary, filters, list, dialogs)
- Create: `src/components/time-tracking/week-nav.tsx`, `direction-summary.tsx`, `time-entry-row.tsx` + `.test.tsx`, `day-section.tsx`, `entry-form-dialog.tsx` + `.test.tsx`

Behaviour:

- Week navigation updates `?w=` via `router.replace` and refetches server data (`router.refresh()`).
- List: running timer pinned on top (reads `useTimer()`), then `groupEntriesByDay`. Row per design §5; overflow menu Upravit / Smazat (`AlertDialog`).
- `EntryFormDialog` shared for create and edit: `react-hook-form` + zod from `validation.ts`, date + time inputs for start and end, live duration preview, API error mapped to the `ended_at` field. Optimistic update on success, `router.refresh()` afterwards.
- Filters `?direction=&tag=` via `useSearchParams`, applied client-side.
- Copy: gender-neutral Czech, tykání. Empty state via `Empty*` primitives („Zatím žádný záznam. Spusť časomíru nebo zapiš čas ručně.").

Commit.

---

## Task 9: `/cas/tym` page

**Files:**
- Create: `src/app/(main)/cas/tym/page.tsx` (server; students → own team or empty state „Nejsi v žádném týmu"; coach/admin → team select via `?team=`)
- Create: `src/components/time-tracking/team-time-table.tsx` + `.test.tsx`, `team-select.tsx`
- Modify: `src/app/(main)/cas/layout.tsx` (new; tab bar „Moje" / „Tým" like `cteni/layout.tsx`)

Behaviour: one query for all members' entries in the week; `summarize` per member; table columns per design; row expands to read-only day list; footer totals; warning banner when attendance exists without a TS schedule (optional). Commit.

---

## Task 10: Docs, E2E, PR

**Files:**
- Create: `docs/modules/cas.md` (structure like `docs/modules/koucovani.md`; link from `docs/modules/overview.md` table as Beta (B))
- Create: `tests/e2e/time-tracking.spec.ts`
- Modify: `docs/wiki.md` if modules are indexed there (`pnpm wiki:doctor` must pass)

E2E flows: start → stop → row appears; manual entry across midnight; overlapping edit shows error; teammate sees the entry in `/cas/tym` and has no edit menu.

Run the full gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:integration && pnpm db:doctor`. Open a PR to `preview` with the design doc linked. Do **not** push without the user's go-ahead.
