# Birth Giving Three-Table Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the empty eleven-table Birth Giving schema with a secure three-table model and update every application surface to use atomic, authorized RPC mutations.

**Architecture:** Drizzle generates staged table/enum DDL, while custom migrations guard the empty-data assumption and define functions, triggers, and grants. Tables expose RLS-protected reads only; narrow `SECURITY DEFINER` functions own every mutation and assignment visibility. API routes validate HTTP/file input, call the functions with the caller-scoped Supabase client, and perform private-storage side effects only after database authorization.

**Tech Stack:** PostgreSQL 16, Drizzle Kit 0.31, Supabase CLI/PostgREST, `@supabase/supabase-js`, Next.js 16 route handlers, TypeScript 5.9, Zod 4, Vitest/Testcontainers.

---

## Preconditions

- Do not apply or restore `20260824121513_bent_steve_rogers.sql`.
- Confirm migration version `20260824121513` is absent from every target migration history before deployment.
- The destructive migration is allowed only because all eleven legacy Birth Giving tables are empty. The first migration enforces this at runtime.
- Never hand-write structural DDL. Generate table, column, enum, index, constraint, and RLS changes from `db/schema/birth-giving.ts`.
- Do not run `pnpm db:up` or `pnpm db:migrate` in this implementation session. Stop at the schema-application checkpoint and ask the user to run `pnpm db:migrate` and inspect all generated drops.

### Task 1: Lock The Empty-Legacy Migration Contract

**Files:**
- Modify: `tests/integration/birth-giving-schema.int.test.ts`
- Modify: `tests/setup/testdb.ts`
- Delete: `tests/setup/fixtures/birth-giving-simplification.sql`
- Generate: `supabase/migrations/<timestamp>_drop_legacy_birth_giving_tables.sql` (leading custom-SQL emptiness guard merges the former standalone guard migration into this file)
- Generate: `supabase/migrations/<timestamp>_retire_legacy_birth_giving_routines.sql`
- Generate: `supabase/migrations/<timestamp>_drop_obsolete_birth_giving_enums.sql`
- Generate: matching `supabase/migrations/meta/*_snapshot.json` and `_journal.json` entries

**Step 1: Remove the synthetic preservation fixture**

Delete the fixture hook from `tests/setup/testdb.ts`, delete the fixture SQL file, and remove preservation assertions/constants from `birth-giving-schema.int.test.ts`. Keep final-shape and invariant tests.

**Step 2: Write the failing migration-guard test**

In a `withRollback` test, clear any present legacy table, create eleven same-named one-column stubs, insert one row into one stub, read the *drop* migration (which carries the emptiness guard at its top), and assert execution rejects:

```ts
const LEGACY_TABLES = [
  "birth_giving_assignments",
  "birth_giving_email_deliveries",
  "birth_giving_event_organizers",
  "birth_giving_events",
  "birth_giving_looking_for_team",
  "birth_giving_reflections",
  "birth_giving_storage_cleanup_claims",
  "birth_giving_team_members",
  "birth_giving_team_proposals",
  "birth_giving_team_result_files",
  "birth_giving_teams",
] as const;

await expect(client.query(guardSql)).rejects.toThrow(
  /requires empty legacy tables/i,
);
```

Locate the migration by its stable suffix (`_drop_legacy_birth_giving_tables.sql`), not a hardcoded timestamp.

**Step 3: Run the integration layer to verify RED**

Run: `pnpm test:integration`

Expected: FAIL during migration setup or because the drop migration carries no guard yet.

**Step 4: Prepending the atomic emptiness guard to the drop migration**

Generate the drop migration (Step 5 below) and prepend a leading custom-SQL `DO $$` block so the emptiness check and the destructive drops run in the same file and the same transaction. The block must:

- iterate the eleven legacy table names in a fixed, deterministic order;
- for each table still present, `LOCK` it in `ACCESS EXCLUSIVE` mode to block concurrent writers; skip absent tables so the block stays idempotent;
- then check each present table is empty and raise if any row exists.

Use this leading block:

```sql
DO $$
DECLARE
  legacy_table text;
  has_rows boolean;
BEGIN
  FOREACH legacy_table IN ARRAY ARRAY[
    'birth_giving_assignments',
    'birth_giving_email_deliveries',
    'birth_giving_event_organizers',
    'birth_giving_events',
    'birth_giving_looking_for_team',
    'birth_giving_reflections',
    'birth_giving_storage_cleanup_claims',
    'birth_giving_team_members',
    'birth_giving_team_proposals',
    'birth_giving_team_result_files',
    'birth_giving_teams'
  ]
  LOOP
    -- Idempotent: skip tables that no longer exist.
    IF EXISTS (
      SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = legacy_table
         AND c.relkind IN ('r', 'p')
    ) THEN
      -- Block concurrent writers before the emptiness check; held for the
      -- whole transaction so no row can slip in before the drops below.
      EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE', legacy_table);

      EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM public.%I LIMIT 1)',
        legacy_table
      ) INTO has_rows;

      IF has_rows THEN
        RAISE EXCEPTION
          'Birth Giving simplification requires empty legacy tables; %.% contains data',
          'public',
          legacy_table;
      END IF;
    END IF;
  END LOOP;
END
$$;
```

**Step 5: Generate table drops while preserving enums**

Temporarily replace the staging worktree's `db/schema/birth-giving.ts` with declarations for all nine legacy enums and no tables. Add `none` to `birth_giving_assignment_state`. Run:

```bash
pnpm db:generate --name drop_legacy_birth_giving_tables
```

Review the generated SQL. It must drop only eleven Birth Giving tables and their RLS policies and add the `none` enum value. It must not alter unrelated objects or drop enum types.

**Step 6: Generate routine retirement after table drops**

Run `pnpm db:generate:custom --name retire_legacy_birth_giving_routines` and use:

```sql
DO $$
DECLARE
  routine_ids text[];
  routine_id text;
BEGIN
  -- Materialize the full list as canonical text first so a CASCADE from an
  -- earlier DROP cannot leave a stale regprocedure OID behind.
  SELECT array_agg(p.oid::regprocedure::text)
    INTO routine_ids
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prokind = 'f'
     AND (
       substring(p.proname for 12) = 'birth_giving'
       OR p.proname = 'can_view_birth_giving_event_organizers'
     );

  FOREACH routine_id IN ARRAY routine_ids
  LOOP
    EXECUTE format(
      'DROP FUNCTION IF EXISTS %s CASCADE',
      routine_id
    );
  END LOOP;
END
$$;
```

Constrain with `prokind = 'f'` and match the `birth_giving` prefix with an exact, wildcard-safe predicate (`substring(proname for 12)`) rather than a `LIKE` whose `_` would act as a single-char wildcard. This migration must run after table/policy drops so `CASCADE` cannot remove policies expected by generated SQL.

**Step 7: Generate obsolete enum drops**

Temporarily reduce the staging schema to these four declarations only:

```ts
export const birthGivingDuration = pgEnum("birth_giving_duration", ["8h", "24h"]);
export const birthGivingEventStatus = pgEnum("birth_giving_event_status", ["draft", "published"]);
export const birthGivingAssignmentState = pgEnum("birth_giving_assignment_state", ["present", "missing", "none"]);
export const birthGivingTeamResultState = pgEnum("birth_giving_team_result_state", ["pending", "present", "missing"]);
```

Run `pnpm db:generate --name drop_obsolete_birth_giving_enums`.

Expected generated drops: delivery status, email message type, proposal direction, proposal state, and team status only.

**Step 8: Replace the failed local migration history**

Delete the untracked failed migration attempts and their snapshots. Copy the three staged generated migrations, snapshots, and journal into the main worktree. The drop migration already carries the leading emptiness guard (Step 4) and is the only guard-bearing migration; do not keep a separate guard migration or snapshot. Do not modify generated SQL or snapshots by hand.

**Step 9: Run migration setup again**

Run: `pnpm test:integration`

Expected: setup advances past routine retirement and obsolete enum drops; tests may still fail because the final tables are not yet recreated.

**Step 10: Commit the migration foundation**

```bash
git add tests/setup/testdb.ts tests/integration/birth-giving-schema.int.test.ts \
  tests/setup/fixtures supabase/migrations supabase/migrations/meta
git commit -m "fix(db): stage safe Birth Giving schema retirement"
```

### Task 2: Define The Read-Only Three-Table Schema

**Files:**
- Modify: `db/schema/birth-giving.ts`
- Modify: `tests/integration/birth-giving-schema.int.test.ts`
- Create: `tests/integration/birth-giving-authorization.int.test.ts`
- Generate: `supabase/migrations/<timestamp>_create_simplified_birth_giving_schema.sql`

**Step 1: Write final-shape and direct-write tests**

Add integration assertions for:

- Exactly three `birth_giving_%` tables, all with RLS enabled.
- Exactly four retained enums with `none` in assignment state.
- `birth_giving_teams_event_id_id_key` and `birth_giving_team_members_event_team_fkey` exist.
- At most one active winner per event.
- Assignment, result, cancellation, and reflection checks reject inconsistent rows.
- An authenticated active profile can read an accessible event but cannot directly insert/update/delete any Birth Giving row.

Use `asClaims` for RLS tests and reset role before privileged fixture setup.

**Step 2: Verify RED**

Run: `pnpm test:integration`

Expected: FAIL because final tables/policies do not exist after the staged drops.

**Step 3: Finish `db/schema/birth-giving.ts`**

Keep the approved three-table columns, four enum declarations, checks, indexes, and foreign keys. Keep only one SELECT policy per table:

- Events: active verified beta caller and either published event or organizer-owned draft.
- Teams: active verified beta caller and accessible parent event.
- Members: active verified beta caller and accessible parent event.

Do not define INSERT, UPDATE, DELETE, or `FOR ALL` policies. Do not expose authorization through `created_by_profile_id` alone; organizer membership is authoritative after creation.

**Step 4: Generate the final structural migration**

Run:

```bash
pnpm db:generate --name create_simplified_birth_giving_schema
```

Review every drop. This migration must create only the three Birth Giving tables, their constraints/indexes, RLS enablement, and read policies. The four enum types already exist and must not be recreated or converted to text.

**Step 5: Verify structural behavior**

Run: `pnpm test:integration`

Expected: shape and relational invariant tests PASS; authorization tests for RPCs/grants remain RED.

**Step 6: Commit**

```bash
git add db/schema/birth-giving.ts tests/integration \
  supabase/migrations supabase/migrations/meta
git commit -m "feat(db): create simplified Birth Giving tables"
```

### Task 3: Add Event Authorization And Mutation Functions

**Files:**
- Modify: `tests/integration/birth-giving-authorization.int.test.ts`
- Generate: `supabase/migrations/<timestamp>_secure_simplified_birth_giving_operations.sql`

**Step 1: Write failing event RPC tests**

Cover:

- Missing, revoked, non-beta, and unverified callers receive `42501`.
- `birth_giving_save_event` creates a draft and always includes the caller in organizer IDs.
- Only an organizer can update; status, assignment, removal, creator, and audit ownership cannot be spoofed through parameters.
- Normalized duplicate identity returns `23505`.
- `birth_giving_publish_event` rejects incomplete past retrospectives with `23514`.
- Publishing a valid future draft succeeds without retrospective requirements.
- `birth_giving_remove_event` is organizer-only and sets both removal fields atomically.

**Step 2: Verify RED**

Run: `pnpm test:integration`

Expected: FAIL with missing functions.

**Step 3: Generate the custom operations migration**

Run:

```bash
pnpm db:generate:custom --name secure_simplified_birth_giving_operations
```

Start it with a private helper:

```sql
CREATE FUNCTION public.birth_giving_active_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT profile.id
    FROM public.profiles profile
    JOIN public.users app_user ON app_user.id = profile.user_id
   WHERE app_user.auth_user_id = (SELECT auth.uid())
     AND app_user.verified_work_email IS NOT NULL
     AND profile.access_removed_at IS NULL
     AND profile.beta_access_granted_at IS NOT NULL
$$;
```

Create these event signatures with `SECURITY DEFINER SET search_path = ''`:

```sql
birth_giving_save_event(
  p_event_id uuid,
  p_name text,
  p_customer text,
  p_starts_at timestamptz,
  p_duration birth_giving_duration,
  p_organizer_profile_ids uuid[]
) RETURNS uuid

birth_giving_publish_event(p_event_id uuid) RETURNS void
birth_giving_remove_event(p_event_id uuid) RETURNS void
```

Every mutation must lock an existing event with `FOR UPDATE`, validate `v_profile_id = ANY(event.organizer_profile_ids)`, set audit fields from `v_profile_id`, and raise the approved SQLSTATEs.

**Step 4: Run event RPC tests GREEN**

Run: `pnpm test:integration`

Expected: all event authorization tests PASS; later function tests remain RED.

**Step 5: Commit**

```bash
git add tests/integration/birth-giving-authorization.int.test.ts \
  supabase/migrations supabase/migrations/meta
git commit -m "feat(db): secure Birth Giving event mutations"
```

### Task 4: Add Atomic Team Mutations

**Files:**
- Modify: `tests/integration/birth-giving-authorization.int.test.ts`
- Modify: the new custom operations migration before it is applied anywhere

**Step 1: Write failing team RPC tests**

Cover:

- Published-event creation atomically creates the team and memberships and includes the caller.
- Draft retrospective creation is organizer-only and uses the exact supplied member set.
- One profile cannot belong to two teams in one event.
- Only organizers can rename, synchronize members, select a winner, or delete a team.
- Winner replacement clears the old winner and sets the new winner in one call.
- A failed membership synchronization rolls back the team update.

**Step 2: Verify RED**

Run: `pnpm test:integration`

Expected: FAIL with missing team functions.

**Step 3: Add exact team signatures**

```sql
birth_giving_create_team(
  p_event_id uuid,
  p_name text,
  p_member_profile_ids uuid[]
) RETURNS uuid

birth_giving_update_team(
  p_event_id uuid,
  p_team_id uuid,
  p_name text,
  p_member_profile_ids uuid[],
  p_is_winner boolean
) RETURNS void

birth_giving_delete_team(
  p_event_id uuid,
  p_team_id uuid
) RETURNS void
```

Deduplicate member arrays in SQL, verify every profile exists and is active, lock the event before winner changes, and replace memberships with one delete plus one set-based insert. Never loop application-side.

**Step 4: Verify GREEN**

Run: `pnpm test:integration`

Expected: team mutation tests PASS.

**Step 5: Commit**

```bash
git add tests/integration/birth-giving-authorization.int.test.ts supabase/migrations
git commit -m "feat(db): add atomic Birth Giving team mutations"
```

### Task 5: Add Assignment, Result, Reflection, Trigger, And Grant Security

**Files:**
- Modify: `tests/integration/birth-giving-authorization.int.test.ts`
- Modify: `tests/integration/birth-giving-schema.int.test.ts`
- Modify: the new custom operations migration before it is applied anywhere

**Step 1: Write failing sensitive-operation tests**

Cover:

- Assignment changes are organizer-only.
- Assignment paths must start with `birth-giving/assignments/<event-id>/`.
- Assignment metadata is redacted one millisecond before `starts_at` and visible exactly at `starts_at`.
- Result changes require organizer or matching-team membership.
- Result paths must start with `birth-giving/results/<event-id>/<team-id>/`.
- Two concurrent result appends preserve both JSON entries.
- Removing the final result moves state to `pending`; marking missing clears files and returns all paths.
- Reflection updates affect only the caller's membership.
- Direct assignment-column SELECT and all direct writes fail for `authenticated`.
- Safe event columns, teams, and members remain readable through RLS.
- All three tables have `handle_updated_at()` triggers.

**Step 2: Verify RED**

Run: `pnpm test:integration`

Expected: FAIL on missing functions/grants/triggers.

**Step 3: Add function signatures and locking**

```sql
birth_giving_set_assignment(
  p_event_id uuid,
  p_state birth_giving_assignment_state,
  p_storage_path text,
  p_original_file_name text,
  p_mime_type text,
  p_file_size bigint
) RETURNS text

birth_giving_get_visible_assignment(p_event_id uuid)
RETURNS TABLE(
  assignment_state birth_giving_assignment_state,
  assignment_storage_path text,
  assignment_file_name text,
  assignment_mime_type text,
  assignment_file_size bigint,
  assignment_uploaded_at timestamptz,
  assignment_uploaded_by_profile_id uuid
)

birth_giving_add_result_file(
  p_event_id uuid,
  p_team_id uuid,
  p_storage_path text,
  p_original_file_name text,
  p_mime_type text,
  p_file_size bigint
) RETURNS uuid

birth_giving_remove_result_file(p_result_file_id uuid) RETURNS text

birth_giving_mark_result_missing(
  p_event_id uuid,
  p_team_id uuid
) RETURNS text[]

birth_giving_upsert_reflection(
  p_event_id uuid,
  p_contribution text,
  p_learning text
) RETURNS void
```

Use `FOR UPDATE` on the event/team row before reading or replacing embedded metadata. Build JSON with `jsonb_build_object`; never accept caller-supplied IDs, uploader IDs, or timestamps.

**Step 4: Add triggers and grants**

Create one `BEFORE UPDATE` trigger per table invoking `public.handle_updated_at()`.

Revoke all table privileges from `anon` and `authenticated`. Grant `authenticated` SELECT on all team/member columns. Grant event SELECT only on safe non-assignment columns. Grant execute only on public RPCs, not the private active-profile helper. Revoke all function execute privileges from `PUBLIC` and `anon`.

**Step 5: Verify GREEN**

Run: `pnpm test:integration`

Expected: all schema and authorization integration tests PASS.

**Step 6: Record custom migration metadata**

Run: `pnpm db:generate`

Expected: `No schema changes, nothing to migrate` and the custom migration remains journaled.

**Step 7: Commit**

```bash
git add tests/integration supabase/migrations supabase/migrations/meta
git commit -m "feat(db): secure Birth Giving assignments and results"
```

### Task 6: Restore Typed API Errors And Route RPC Calls

**Files:**
- Modify: `src/lib/birth-giving/api.ts`
- Modify: `src/lib/birth-giving/api.test.ts`
- Modify: `src/app/api/birth-giving/_shared.ts`
- Modify: `src/app/api/birth-giving/events/route.ts`
- Modify: `src/app/api/birth-giving/events/[eventId]/route.ts`
- Modify: `src/app/api/birth-giving/events/[eventId]/publish/route.ts`
- Modify: `src/app/api/birth-giving/events/[eventId]/teams/route.ts`
- Modify: `src/app/api/birth-giving/events/[eventId]/teams/[teamId]/route.ts`
- Modify: `src/app/api/birth-giving/events/[eventId]/reflection/route.ts`
- Modify: `tests/unit/birth-giving-dynamic-routes.test.ts`
- Modify: route/component tests adjacent to changed behavior

**Step 1: Write failing validator and route tests**

Assert:

- Solo-team payloads accept `memberProfileIds: []`.
- Event payloads cannot submit status or assignment metadata.
- Each route calls the expected RPC with snake-case parameters.
- Missing RPC data is not treated as success.
- SQLSTATE mapping produces stable `403`, `404`, and `409` responses.

**Step 2: Verify RED**

Run:

```bash
pnpm test:unit -- src/lib/birth-giving/api.test.ts tests/unit/birth-giving-dynamic-routes.test.ts
```

Expected: FAIL on stale validators/imports/direct table writes.

**Step 3: Restore API error types**

Define an interface containing `code`, `message`, `details`, and `hint`; add named error-code constants and a pure mapper. Keep Czech copy gender-neutral and use present-tense neutral phrasing.

Remove `birth_giving_find_event_conflict`; duplicate details now come from the save-event RPC/unique violation.

**Step 4: Replace direct writes with RPC calls**

Each handler validates JSON/UUIDs, calls exactly one mutation RPC, passes errors to `birthGivingMutationErrorResponse`, and refreshes the event only after confirmed success.

Do not pass `profileId`, audit columns, timestamps, result JSON, assignment uploader data, or status from route payloads.

**Step 5: Verify GREEN**

Run the focused unit tests, then `pnpm test:unit`.

Expected: PASS.

**Step 6: Commit**

```bash
git add src/lib/birth-giving src/app/api/birth-giving tests/unit
git commit -m "refactor(api): route Birth Giving writes through RPCs"
```

### Task 7: Secure File Confirmation, Download, And Cleanup

**Files:**
- Modify: `src/app/api/birth-giving/events/[eventId]/assignment/confirm/route.ts`
- Modify: `src/app/api/birth-giving/events/[eventId]/assignment/missing/route.ts`
- Modify: `src/app/api/birth-giving/events/[eventId]/assignment/download/route.ts`
- Modify: `src/app/api/birth-giving/events/[eventId]/teams/[teamId]/results/confirm/route.ts`
- Modify: `src/app/api/birth-giving/events/[eventId]/teams/[teamId]/results/missing/route.ts`
- Modify: `src/app/api/birth-giving/result-files/[fileId]/route.ts`
- Modify: `src/app/api/birth-giving/result-files/[fileId]/download/route.ts`
- Modify: `tests/unit/birth-giving-confirm-routes.test.ts`
- Modify: `tests/unit/birth-giving-dynamic-routes.test.ts`

**Step 1: Write failing storage-boundary tests**

Assert confirmation rejects:

- A path outside the event/team prefix.
- A missing object.
- Actual object size or MIME type that differs from submitted metadata.
- RPC failure, with best-effort deletion of the newly uploaded object.

Assert missing/removal deletes every displaced path returned by the RPC. Assert assignment download receives redacted data before start and never signs a URL. Assert result download only uses a path found through RLS-visible teams.

**Step 2: Verify RED**

Run: `pnpm test:unit -- tests/unit/birth-giving-confirm-routes.test.ts tests/unit/birth-giving-dynamic-routes.test.ts`

Expected: FAIL because routes trust payload metadata and write directly.

**Step 3: Implement object verification**

Before registration, check the exact prefix and call `inspectStorageObject("documents", storagePath)`. Compare normalized content type and integer size. Then call the RPC.

On registration failure, call `deleteFile` best-effort. On replacement/removal/missing success, delete returned paths and return a server error if cleanup fails.

**Step 4: Enforce assignment embargo in downloads**

Use `birth_giving_get_visible_assignment` in the assignment download route. Sign only a returned `present` path. Keep result download scoped to RLS-visible team rows and validated embedded metadata.

**Step 5: Verify GREEN**

Run focused tests, then `pnpm test:unit`.

Expected: PASS.

**Step 6: Commit**

```bash
git add src/app/api/birth-giving tests/unit
git commit -m "fix(storage): validate Birth Giving file ownership"
```

### Task 8: Redact Assignment Metadata In Read Queries

**Files:**
- Modify: `src/lib/birth-giving/queries.ts`
- Modify: `src/lib/birth-giving/queries.test.ts`
- Modify: `src/lib/birth-giving/types.ts`
- Modify: consumers/tests under `src/components/birth-giving/`

**Step 1: Write failing query tests**

Assert every event query uses an explicit safe column list rather than `*`. Assert event detail performs one visible-assignment RPC and merges its response. Before release, merged assignment fields are `none`/null; organizers and released events receive metadata.

**Step 2: Verify RED**

Run: `pnpm test:unit -- src/lib/birth-giving/queries.test.ts`

Expected: FAIL because current queries select `*` and never call the visibility RPC.

**Step 3: Add a shared safe select constant**

List all event columns except the seven assignment columns. Use it in index, detail, and profile-history queries. Populate redacted assignment defaults for list/history records and merge `birth_giving_get_visible_assignment` for event detail.

Do not weaken types with `any`; parse JSON result files through the existing `BirthGivingResultFile` interface or a narrow runtime schema.

**Step 4: Verify GREEN**

Run focused query tests and affected component tests.

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/birth-giving src/components/birth-giving
git commit -m "fix(auth): redact embargoed Birth Giving assignments"
```

### Task 9: Remove Retired Surfaces And Repair Notifications

**Files:**
- Delete: `src/app/api/birth-giving/proposals/[proposalId]/[action]/route.ts`
- Delete: `src/lib/birth-giving/storage-cleanup.ts`
- Delete: `src/lib/birth-giving/storage-cleanup.test.ts`
- Delete: `src/app/api/system/birth-giving/cleanup-storage/route.ts`
- Modify: `vercel.json`
- Modify: `src/lib/notifications/birth-giving-notifications.ts`
- Modify: `src/lib/notifications/birth-giving-notifications.test.ts`
- Modify: `src/app/api/system/birth-giving/process/route.ts` only if its response contract changes
- Modify/delete stale route tests

**Step 1: Write failing notification tests**

Assert:

- Draft or future events send nothing.
- Published due events with a present assignment notify current members.
- Idempotency key contains event ID, assignment upload timestamp, and recipient email.
- A replacement timestamp produces a different key.
- Recipient failures do not prevent attempts for remaining recipients.

**Step 2: Verify RED**

Run: `pnpm test:unit -- src/lib/notifications/birth-giving-notifications.test.ts`

Expected: FAIL because `processBirthGiving` is a no-op and current idempotency ignores replacements.

**Step 3: Remove obsolete code and cron**

Remove proposal and cleanup code that references deleted tables/RPCs. Remove only the cleanup cron entry from `vercel.json`; retain `/api/system/birth-giving/process`.

**Step 4: Implement due-assignment processing**

Query published, non-removed events with `starts_at <= now()` and a present assignment using the admin client. Notify current members with the upload-timestamp idempotency key. The confirm route may invoke the same helper immediately when an assignment is replaced after start; await it.

**Step 5: Verify GREEN**

Run focused notification tests and `pnpm test:unit`.

Expected: PASS.

**Step 6: Commit**

```bash
git add src/app/api src/lib/birth-giving src/lib/notifications vercel.json tests
git commit -m "refactor: retire legacy Birth Giving jobs"
```

### Task 10: Apply Locally And Regenerate Database Types

**Files:**
- Regenerate: `src/lib/supabase/database.types.ts`
- Regenerate locally only: `db/sql/functions.sql`, `db/sql/triggers.sql`, `db/sql/schema.sql`

**Step 1: Verify migration history before asking for application**

Run:

```bash
pnpm db:check-integrity
pnpm test:integration
```

Expected: PASS, including Drizzle generate no-op.

**Step 2: Stop and ask the user to apply the schema**

Ask the user to run:

```bash
pnpm db:migrate
```

Explicitly ask them to inspect generated migrations for unexpected drops. The expected drops are exactly the eleven legacy Birth Giving tables and five obsolete Birth Giving enums.

**Step 3: Inspect regenerated types after confirmation**

Verify `database.types.ts` contains only three Birth Giving tables, four enums, and the approved RPCs. Verify it contains no proposal, cleanup, email-delivery, organizer-join, assignment-table, result-file-table, or reflection-table types.

**Step 4: Update any compile errors without hand-writing DB types**

Use `Tables<'...'>` and generated `Database['public']['Enums']` types. Do not manually recreate database row types.

**Step 5: Commit**

```bash
git add src/lib/supabase/database.types.ts db/schema/birth-giving.ts \
  supabase/migrations supabase/migrations/meta
git commit -m "chore(db): regenerate simplified Birth Giving types"
```

### Task 11: Final Verification And Review

**Files:**
- Modify only files required by failing checks

**Step 1: Run formatting/lint-sensitive checks**

Run: `pnpm lint`

Expected: PASS with no new warnings.

**Step 2: Run fast tests**

Run: `pnpm test`

Expected: all unit and component projects PASS.

**Step 3: Run database tests**

Run: `pnpm test:integration`

Expected: all integration tests PASS from a fresh migration history.

**Step 4: Run schema checks**

Run:

```bash
pnpm db:check-integrity
pnpm db:local-check
```

Expected: Drizzle journal/snapshots are valid, generation is a no-op, and local schema matches.

**Step 5: Run compiler and production build**

Run:

```bash
pnpm typecheck
pnpm build
```

Expected: PASS with no references to removed routes, tables, columns, enums, or RPCs.

**Step 6: Search for stale model references**

Run searches for:

```text
birth_giving_assignments
birth_giving_email_deliveries
birth_giving_event_organizers
birth_giving_looking_for_team
birth_giving_reflections
birth_giving_storage_cleanup_claims
birth_giving_team_proposals
birth_giving_team_result_files
birth_giving_team_status
birth_giving_find_event_conflict
status: "confirmed"
```

Expected: matches only in historical migrations, the intentional retirement migration, or documentation.

**Step 7: Request code review**

Use `requesting-code-review` with emphasis on RLS bypasses, `SECURITY DEFINER` safety, assignment embargo, storage path ownership, migration ordering, and concurrent JSON updates. Fix every confirmed blocker with a failing test first.

**Step 8: Commit final fixes**

```bash
git add -A
git commit -m "feat: complete secure Birth Giving simplification"
```
