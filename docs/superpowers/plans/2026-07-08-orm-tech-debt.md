# ORM / Data-Layer Tech-Debt Paydown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Supabase data layer type-safe end-to-end and close real security/performance advisor findings, without ever requiring a production database reset.

**Architecture:** Keep the hybrid setup (Drizzle = schema/migration source of truth, supabase-js = runtime queries). Add the generated `Database` type to every client; derive hand-written row types from it. Fix the two `SECURITY DEFINER` functions' `search_path`. Optimize per-row RLS re-evaluation by wrapping `auth.uid()` in `(select auth.uid())`, authored as hand-written migrations from live policy definitions (because the Drizzle schema files have drifted from the live policies).

**Tech Stack:** Next.js 16, TypeScript 5.9, `@supabase/supabase-js` 2.91, `@supabase/ssr` 0.8, Drizzle ORM 0.45 / drizzle-kit 0.31, Supabase CLI 2.72, Postgres (local stack on port 54322), pnpm 10.

## Global Constraints

- **Production must never require a DB reset.** Every migration is forward-only and idempotent where possible; verified by full replay on a throwaway shadow database before being considered done.
- **Never `supabase db reset` the working local DB** and never wipe local data. All from-scratch replay happens on a scratch database (`shadow_verify`) created on the same local Postgres and dropped afterward.
- **Never use MCP `apply_migration`** for these changes — it is the known source of out-of-band drift. Migrations are files applied by the Supabase CLI only.
- Migrations live in `supabase/migrations/`, prefix `supabase` (timestamped), consistent with existing files.
- Package manager is **pnpm**. Node `^24.13.0`.

---

## Shadow-DB replay helper (used by Tasks 4, 5)

The reusable verification procedure referenced below as **[SHADOW REPLAY]**:

```bash
# Runs entirely against the local Postgres (port 54322); never touches the `postgres` DB.
PGURL="postgresql://postgres:postgres@127.0.0.1:54322"
psql "$PGURL/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS shadow_verify;" -c "CREATE DATABASE shadow_verify;"
for f in $(ls supabase/migrations/*.sql | sort); do
  echo ">> applying $f"
  psql "$PGURL/shadow_verify" -v ON_ERROR_STOP=1 -f "$f" || { echo "REPLAY FAILED at $f"; exit 1; }
done
echo "REPLAY OK"
```
Expected: `REPLAY OK` with zero errors. If any file fails, that is a stop-the-line drift signal — do not proceed. Drop the scratch DB when done: `psql "$PGURL/postgres" -c "DROP DATABASE shadow_verify;"`.

> Note: some early migrations may assume Supabase-managed roles/schemas (`auth`, `authenticated`). If a *pre-existing* migration fails to replay on a bare DB for that reason (not caused by our new migration), record it, and fall back to verifying the new migration by applying it forward onto a clone of the current local DB instead. Confirm which mode is needed during Task 4.

---

# PHASE 1 — Type the query layer (no DB migrations)

### Task 1: Generate `Database` types and type the three client factories

**Files:**
- Create: `lib/supabase/database.types.ts` (generated; do not hand-edit)
- Modify: `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/admin.ts`
- Modify: `package.json` (add `db:types` script)

**Interfaces:**
- Produces: `Database` type exported from `lib/supabase/database.types.ts`; `createClient()` (server & browser) and `createAdminClient()` now return `SupabaseClient<Database>`.

- [ ] **Step 1: Generate the types file**

Run (local stack must be running via `pnpm supabase start`):
```bash
pnpm supabase gen types typescript --local --schema public > lib/supabase/database.types.ts
```
Expected: file created, starts with `export type Json = ...` and `export type Database = { public: { Tables: { ... } } }`. Confirm it contains `essays`, `books`, `profiles`, `reservations` tables.

- [ ] **Step 2: Add the `db:types` script**

In `package.json` `scripts`, add:
```json
"db:types": "supabase gen types typescript --local --schema public > lib/supabase/database.types.ts"
```

- [ ] **Step 3: Type `lib/supabase/server.ts`**

Add import and generic:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
// ...
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { /* unchanged cookies block */ },
  );
```

- [ ] **Step 4: Type `lib/supabase/client.ts`**

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

- [ ] **Step 5: Type `lib/supabase/admin.ts`**

```ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
// ...
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
```

- [ ] **Step 6: Type-check (this is the test)**

Run:
```bash
pnpm exec tsc --noEmit
```
Expected: it will now surface type errors at query call sites (that is expected and desired — they are fixed in Tasks 2–3). Record the error count as the Phase 1 baseline. This task passes when the three client files and `database.types.ts` themselves have no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/supabase/database.types.ts lib/supabase/server.ts lib/supabase/client.ts lib/supabase/admin.ts package.json
git commit -m "feat(db): generate Database types and type supabase client factories"
```

---

### Task 2: Derive row types in `lib/*/types.ts` from generated types

**Files:**
- Modify: `lib/essays/types.ts`, `lib/books/types.ts`, `lib/komunita/types.ts`, `lib/reservations/types.ts`, `lib/dashboard/types.ts`, `lib/portfolio/types.ts`, `lib/storage/types.ts`, `lib/auth-helpers.ts` (the `Profile` type)

**Interfaces:**
- Consumes: `Database` from `lib/supabase/database.types.ts`.
- Produces: base row interfaces replaced by `type Essay = Database['public']['Tables']['essays']['Row']` etc. Composite types (`EssayWithDetails`, `EssayCommentWithAuthor`, `CoachReviewEssay`, …) preserved, extending the derived rows.

- [ ] **Step 1: Add a shared row helper (optional but DRY)**

Create `lib/supabase/tables.ts`:
```ts
import type { Database } from "./database.types";

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Insertable<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type Updatable<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
```

- [ ] **Step 2: Replace the base row interface in `lib/essays/types.ts`**

Replace the hand-written `interface Essay { ... }`, `interface EssayComment { ... }`, `interface EssayView { ... }`, `interface EssayCoachRead { ... }` with derivations, keeping the `...WithDetails` composites:
```ts
import type { Tables } from '@/lib/supabase/tables';
import type { Profile } from '@/lib/auth-helpers';
import type { Book } from '@/lib/books/types';

export type Essay = Tables<'essays'>;
export type EssayComment = Tables<'essay_comments'>;
export type EssayView = Tables<'essay_views'>;
export type EssayCoachRead = Tables<'essay_coach_reads'>;

export interface EssayWithDetails extends Essay {
  author: Pick<Profile, 'id' | 'name' | 'picture' | 'role'> | null;
  book: Pick<Book, 'id' | 'title' | 'author' | 'book_points' | 'status' | 'cover_path'> | null;
  comment_count: number;
}
// EssayCommentWithAuthor, EssayViewWithProfile, EssayCoachReadWithProfile, CoachReviewEssay: unchanged (still extend the derived rows)
// EssayListView, EssaySortOrder, EssayFilters, CreateEssayInput: unchanged
```
Note: `content_json` becomes `Json` (from generated types) instead of `object` — this is more accurate. Fix any consumer that assumed `object` during Task 3.

- [ ] **Step 3: Repeat derivation for the other modules**

For each of `lib/books/types.ts`, `lib/komunita/types.ts`, `lib/reservations/types.ts`, `lib/dashboard/types.ts`, `lib/portfolio/types.ts`, `lib/storage/types.ts`, and the `Profile` interface in `lib/auth-helpers.ts`: replace hand-written base row interfaces with `Tables<'...'>` derivations. Keep composites, enums, filter/input types. Do NOT change any type that is not a direct table-row mirror (e.g. API DTOs, view-model shapes).

- [ ] **Step 4: Type-check**

Run:
```bash
pnpm exec tsc --noEmit
```
Expected: error count should not increase versus the Task 1 baseline; base-row mismatches (e.g. a column the hand type had wrong) may surface here — fix by trusting the generated type. Remaining errors are query-site casts, handled in Task 3.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/tables.ts lib/**/types.ts lib/auth-helpers.ts
git commit -m "refactor(db): derive row types from generated Database types"
```

---

### Task 3: Type query-helper signatures and remove/narrow casts

**Files:**
- Modify: `lib/essays/queries.ts`, `lib/books/queries.ts`, `lib/books/team-lists.ts`, `lib/komunita/queries.ts`, `lib/auth-helpers.ts`, `lib/auth/session.ts`, `lib/storage/service.ts`, `lib/storage/validation.ts`, and any other file with a bare `SupabaseClient` parameter or an `as X`/`as any` cast on query results (find with the grep in Step 1).

**Interfaces:**
- Consumes: `SupabaseClient<Database>` from typed clients.
- Produces: helper functions now take `SupabaseClient<Database>`; query results are inferred, casts removed or narrowed.

- [ ] **Step 1: Find every bare client param and result cast**

Run:
```bash
grep -rn "SupabaseClient" lib app --include="*.ts" --include="*.tsx" | grep -v "SupabaseClient<"
grep -rn "as Essay\|as Book\|as Profile\|as CoachReviewEssay\| as any\|as unknown" lib --include="*.ts"
```
Record the list. These are the edit sites.

- [ ] **Step 2: Narrow the client type at every helper signature**

Change parameter types from `supabase: SupabaseClient` to `supabase: SupabaseClient<Database>`, adding `import type { Database } from '@/lib/supabase/database.types'` where needed. Example (`lib/essays/queries.ts`):
```ts
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

async function getTeamStudentIds(
  supabase: SupabaseClient<Database>,
  teamId: string,
  excludeProfileId: string,
): Promise<string[]> { /* ... */ }
```

- [ ] **Step 3: Remove casts the typed client makes redundant; narrow the rest**

For simple selects, delete the trailing `as X[]` and let inference work. For selects with embedded resources reshaped in code (e.g. `essay_comments(count)` → `comment_count` in `mapEssayCommentCount`), keep a single typed assertion at the reshape boundary, not blanket `as any`. Example:
```ts
// before: return rows.map(...) as EssayWithDetails[];
// after:  the map already produces EssayWithDetails[]; drop the cast, or
//         type the raw query row explicitly:
type EssayDetailRow = Essay & {
  essay_comments?: { count: number }[];
  author: EssayWithDetails['author'];
  book: EssayWithDetails['book'];
};
```
Do this file by file, running `tsc` after each to converge.

- [ ] **Step 4: Type-check to zero errors**

Run:
```bash
pnpm exec tsc --noEmit
```
Expected: **PASS, 0 errors.** No `as any` remaining in the query files from Step 1's grep (blanket table-row casts gone; only justified narrowings at reshape boundaries remain).

- [ ] **Step 5: Lint**

Run:
```bash
pnpm lint
```
Expected: no new errors.

- [ ] **Step 6: Runtime smoke check**

Run the app (`pnpm dev`) and load one page per touched module (essay list, book list, komunita/teams, a reservation view). Confirm data renders — the typed refactor must not change runtime behavior.

- [ ] **Step 7: Commit**

```bash
git add lib app
git commit -m "refactor(db): type query helpers with SupabaseClient<Database>, drop redundant casts"
```

---

# PHASE 2 — Function `search_path`

### Task 4: Add `SET search_path = ''` to the two flagged functions

**Files:**
- Modify: `db/sql/functions.sql` (reference copy)
- Create: `supabase/migrations/<timestamp>_fix_function_search_path.sql` (via `pnpm db:generate:custom`)

**Interfaces:** none (DB-only). Both functions already fully schema-qualify all references (`public.essays`, `public.books`, `public.teams`, `public.profiles`, `public.books_with_essay_count`), so an empty `search_path` is safe.

- [ ] **Step 1: Update the reference copy**

In `db/sql/functions.sql`, in both `get_best_books_per_category` and `get_teams_with_member_stats`, add ` SET search_path = ''` to the function attribute list, immediately after `STABLE SECURITY DEFINER`:
```sql
CREATE OR REPLACE FUNCTION public.get_best_books_per_category(top_n integer DEFAULT 3)
 RETURNS TABLE(...)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  -- body unchanged (already public.-qualified)
$function$;
```
Do the same for `get_teams_with_member_stats`.

- [ ] **Step 2: Create the migration file**

Run:
```bash
pnpm db:generate:custom
```
This creates an empty timestamped file in `supabase/migrations/`. Rename/note it as `..._fix_function_search_path`. Paste both full `CREATE OR REPLACE FUNCTION ... SET search_path = '' ... $function$;` statements into it (copy verbatim from `db/sql/functions.sql`). `CREATE OR REPLACE` is idempotent and forward-only.

- [ ] **Step 3: Apply forward to local and confirm**

Run:
```bash
pnpm supabase migration up
```
Expected: applies cleanly. Then confirm the functions still return correct data:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select count(*) from public.get_teams_with_member_stats();" -c "select count(*) from public.get_best_books_per_category(3);"
```
Expected: same row counts as before the change (compare against a pre-change run).

- [ ] **Step 4: [SHADOW REPLAY]**

Run the shadow-replay helper. Expected: `REPLAY OK`. (If pre-existing migrations can't replay on a bare DB due to Supabase-managed roles, use the forward-onto-clone fallback noted in the helper and record which mode applies for reuse in Task 5.)

- [ ] **Step 5: Re-run the security advisor**

Use MCP `get_advisors` (type `security`). Expected: `function_search_path_mutable` findings for both functions are **gone**; no new findings.

- [ ] **Step 6: Commit**

```bash
git add db/sql/functions.sql supabase/migrations/
git commit -m "fix(db): set search_path on SECURITY DEFINER functions (security advisor 0011)"
```

---

# PHASE 3 — RLS policy optimization (drift-safe)

### Task 5: Wrap `auth.uid()` in `(select auth.uid())` for the six flagged policies

**Files:**
- Create: `supabase/migrations/<timestamp>_optimize_rls_auth_initplan.sql` (via `pnpm db:generate:custom`)

**Interfaces:** none (DB-only). Migration authored from **live** `pg_policies` definitions (below), applying only the `auth.uid()` → `(select auth.uid())` transform. All other logic byte-identical.

The six flagged policies and their exact live expressions (verified from `pg_policies`):

| table | policy | cmd | expression location |
|---|---|---|---|
| reservations | Users can create own reservations | INSERT | with_check |
| reservations | Users can update own reservations | UPDATE | qual + with_check |
| cowork_participants | Users can leave cowork | DELETE | qual |
| room_issues | Users can report issues | INSERT | with_check |
| room_issues | Users can update own issues | UPDATE | qual + with_check |
| profiles | Users can update their own profile picture | UPDATE | qual + with_check |

- [ ] **Step 1: Create the migration file**

Run `pnpm db:generate:custom`; note it as `..._optimize_rls_auth_initplan`. Populate it with `DROP POLICY` + `CREATE POLICY` pairs. Each expression is copied verbatim from the live definition with **only** `uid()` (i.e. `auth.uid()`) replaced by `(select auth.uid())`. Full content:

```sql
-- reservations: Users can create own reservations (INSERT)
DROP POLICY "Users can create own reservations" ON public.reservations;
CREATE POLICY "Users can create own reservations" ON public.reservations
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id IN ( SELECT profiles.id FROM profiles
      WHERE (profiles.user_id IN ( SELECT users.id FROM users
        WHERE (users.auth_user_id = (select auth.uid()))))))
    AND (reservation_type = 'personal'::reservation_type)
  );

-- reservations: Users can update own reservations (UPDATE)
DROP POLICY "Users can update own reservations" ON public.reservations;
CREATE POLICY "Users can update own reservations" ON public.reservations
  FOR UPDATE TO authenticated
  USING (
    user_id IN ( SELECT profiles.id FROM profiles
      WHERE (profiles.user_id IN ( SELECT users.id FROM users
        WHERE (users.auth_user_id = (select auth.uid())))))
  )
  WITH CHECK (
    user_id IN ( SELECT profiles.id FROM profiles
      WHERE (profiles.user_id IN ( SELECT users.id FROM users
        WHERE (users.auth_user_id = (select auth.uid())))))
  );

-- cowork_participants: Users can leave cowork (DELETE)
DROP POLICY "Users can leave cowork" ON public.cowork_participants;
CREATE POLICY "Users can leave cowork" ON public.cowork_participants
  FOR DELETE TO authenticated
  USING (
    user_id IN ( SELECT profiles.id FROM profiles
      WHERE (profiles.user_id IN ( SELECT users.id FROM users
        WHERE (users.auth_user_id = (select auth.uid())))))
  );

-- room_issues: Users can report issues (INSERT)
DROP POLICY "Users can report issues" ON public.room_issues;
CREATE POLICY "Users can report issues" ON public.room_issues
  FOR INSERT TO authenticated
  WITH CHECK (
    reported_by IN ( SELECT profiles.id FROM profiles
      WHERE (profiles.user_id IN ( SELECT users.id FROM users
        WHERE (users.auth_user_id = (select auth.uid())))))
  );

-- room_issues: Users can update own issues (UPDATE)
DROP POLICY "Users can update own issues" ON public.room_issues;
CREATE POLICY "Users can update own issues" ON public.room_issues
  FOR UPDATE TO authenticated
  USING (
    (reported_by IN ( SELECT profiles.id FROM profiles
      WHERE (profiles.user_id IN ( SELECT users.id FROM users
        WHERE (users.auth_user_id = (select auth.uid()))))))
    AND (status = 'open'::issue_status)
  )
  WITH CHECK (
    reported_by IN ( SELECT profiles.id FROM profiles
      WHERE (profiles.user_id IN ( SELECT users.id FROM users
        WHERE (users.auth_user_id = (select auth.uid())))))
  );

-- profiles: Users can update their own profile picture (UPDATE)
DROP POLICY "Users can update their own profile picture" ON public.profiles;
CREATE POLICY "Users can update their own profile picture" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    user_id IN ( SELECT users.id FROM users
      WHERE (users.auth_user_id = (select auth.uid())))
  )
  WITH CHECK (
    user_id IN ( SELECT users.id FROM users
      WHERE (users.auth_user_id = (select auth.uid())))
  );
```

- [ ] **Step 2: Capture a pre-change RLS behavior baseline**

Before applying, record current behavior for a spot check. Using the MCP or psql, note for a known user: they can update their own reservation and cannot update another user's. (Record expected allow/deny for reservations UPDATE and profiles UPDATE.)

- [ ] **Step 3: Apply forward to local**

Run:
```bash
pnpm supabase migration up
```
Expected: applies cleanly, all six policies recreated.

- [ ] **Step 4: Behavior equivalence test (this is the test)**

For each changed policy, confirm behavior is byte-for-byte equivalent — only faster. Run RLS checks as an authenticated role (set `request.jwt.claims` / use a test session) and assert:
- Authorized row: still permitted (e.g. user updates own reservation → success).
- Unauthorized row: still denied (e.g. user updates another user's reservation → 0 rows / RLS error).
Do this for reservations (INSERT+UPDATE), room_issues (INSERT+UPDATE), cowork_participants (DELETE), profiles (UPDATE).
Expected: identical allow/deny outcomes to the Step 2 baseline.

- [ ] **Step 5: [SHADOW REPLAY]**

Run the shadow-replay helper (or the fallback mode determined in Task 4). Expected: `REPLAY OK`.

- [ ] **Step 6: Re-run the performance advisor**

Use MCP `get_advisors` (type `performance`). Expected: the six `auth_rls_initplan` findings are **gone**; no new findings introduced.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/
git commit -m "perf(db): wrap auth.uid() in (select ...) for flagged RLS policies (advisor 0003)"
```

---

### Task 6: Reconcile Drizzle schema files with the corrected policies

**Files:**
- Modify: `db/schema/reservations.ts` (and any other schema file whose `pgPolicy` for a changed table lacks the real expression)
- Modify: `supabase/migrations/meta/` snapshot (via a snapshot-only regeneration)

**Interfaces:** none. This closes the drift so future `drizzle-kit generate` runs diff against reality. **Code/metadata only — must NOT emit a new migration.**

- [ ] **Step 1: Backfill the true expressions into `pgPolicy(...)` calls**

For each of the six policies, set the `using`/`withCheck` in the corresponding `pgPolicy(...)` in `db/schema/*.ts` to the corrected `(select auth.uid())` expression (matching what Task 5 applied). Example (`db/schema/reservations.ts`):
```ts
pgPolicy("Users can update own reservations", {
  as: "permissive", for: "update", to: ["authenticated"],
  using: sql`(user_id IN ( SELECT profiles.id FROM profiles WHERE (profiles.user_id IN ( SELECT users.id FROM users WHERE (users.auth_user_id = ( SELECT auth.uid()))))))`,
  withCheck: sql`(user_id IN ( SELECT profiles.id FROM profiles WHERE (profiles.user_id IN ( SELECT users.id FROM users WHERE (users.auth_user_id = ( SELECT auth.uid()))))))`,
}),
```
Handle the other five likewise (profiles, room_issues×2, cowork_participants, reservations INSERT). Note: `profiles`, `room_issues`, `cowork_participants` schema files must be located first — confirm which `db/schema/*.ts` defines each.

- [ ] **Step 2: Verify the schema now matches the DB (empty diff)**

Run:
```bash
pnpm exec drizzle-kit generate --name drift_check
```
Expected: drizzle reports **no schema changes** (or produces an empty migration). If it produces SQL, the backfilled expressions don't exactly match the DB — adjust the schema strings until the diff is empty. **Delete any empty/`drift_check` migration file it created** — this task must not add a migration.

- [ ] **Step 3: Confirm no stray migration remains**

Run:
```bash
git status supabase/migrations/
```
Expected: no new `.sql` file staged/untracked from this task (only the `meta/` snapshot may legitimately update).

- [ ] **Step 4: Commit**

```bash
git add db/schema/ supabase/migrations/meta/
git commit -m "chore(db): reconcile Drizzle schema with live RLS policies (close drift)"
```

---

### Task 7: Assess `multiple_permissive_policies` (decision task — likely defer)

**Files:** none unless a safe consolidation is found.

**Interfaces:** none.

- [ ] **Step 1: Review each flagged pair**

For each `multiple_permissive_policies` finding (reservations SELECT/INSERT/UPDATE/DELETE, rooms SELECT, room_issues UPDATE, schedule_breaks SELECT, recurring_schedules SELECT), dump both policies from `pg_policies` and decide: are they consolidatable into one policy with an `OR`ed expression **without changing access semantics**?

- [ ] **Step 2: Decide and record**

- If a pair is provably equivalent when merged → author a drift-safe migration exactly like Task 5 (DROP both, CREATE one), behavior-test, [SHADOW REPLAY], advisor re-check, reconcile schema (Task 6 pattern).
- If not provably equivalent → **defer** and document in the spec's "deferred" list. Do not merge policies whose combined semantics you cannot prove identical; a wrong merge is a security regression.

- [ ] **Step 3: Commit (only if a safe consolidation was made)**

```bash
git add supabase/migrations/ db/schema/
git commit -m "perf(db): consolidate equivalent permissive RLS policies (advisor 0006)"
```

---

## Final verification

- [ ] `pnpm exec tsc --noEmit` → 0 errors.
- [ ] `pnpm lint` → clean.
- [ ] `pnpm build` → succeeds.
- [ ] [SHADOW REPLAY] → `REPLAY OK` on a fresh scratch DB.
- [ ] Security advisor: no `function_search_path_mutable` for the two functions.
- [ ] Performance advisor: no `auth_rls_initplan` for the six policies.
- [ ] `drizzle-kit generate` → empty diff (schema matches DB; drift closed).
- [ ] Working local DB never reset; `shadow_verify` dropped.
