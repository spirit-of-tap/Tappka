# Runbook: Migration-history drift (malformed version `20260419`)

**Status:** Local fixed 2026-07-08. The malformed `20260419` was a **local-only** problem —
**production never had it**, so production needs NO `20260419` repair. A *separate*
production divergence does need attention before deploying `esejbanka` — see
"Production reality (verified 2026-07-08)" below.

## Symptom

`supabase migration up` or `supabase db push` fails with:

```
Remote migration versions not found in local migrations directory.
Make sure your local git repo is up-to-date. If the error persists, try repairing the migration history table:
supabase migration repair --status reverted 20260419
```

This blocks **all** new migrations from being applied through the CLI — not just the one you were trying to add.

## Root cause

Every migration is versioned with a **14-digit** timestamp (`YYYYMMDDHHMMSS`, e.g. `20260612193007`) **except one**:

| | Version | File |
|---|---|---|
| Malformed | `20260419` (8 digits) | `20260419_essays_title_trgm_idx.sql` |
| Correct | `20260419000000` (14 digits) | `20260419000000_essays_title_trgm_idx.sql` |

The Supabase CLI only recognizes 14-digit versions. It sees version `20260419` recorded in the database's `supabase_migrations.schema_migrations` table but **cannot match it to any file it recognizes**, so it treats it as a remote-only migration and refuses to proceed.

This is a form of **out-of-band drift**: the row was written to `schema_migrations` with a non-standard version (likely applied by hand or via a tool other than the CLI), and the filename matched that non-standard version.

## The fix (forward-only, no reset, no data touched)

Normalize the version to 14 digits in lockstep across **three** places:

1. **The migration file name** — rename so its version prefix is 14 digits.
2. **The local** `schema_migrations` **table** (dev DB on port 54322).
3. **The production** `schema_migrations` **table** (linked project).

The file content is unchanged; only the version string moves from `20260419` to `20260419000000`. Nothing in the actual schema changes — this is pure migration-bookkeeping.

### Fix locally (already done 2026-07-08)

```bash
# 1. Rename the file (committed to git)
git mv supabase/migrations/20260419_essays_title_trgm_idx.sql \
       supabase/migrations/20260419000000_essays_title_trgm_idx.sql

# 2. Correct the local history table (local DB only, port 54322)
docker exec supabase_db_Tappka psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "update supabase_migrations.schema_migrations set version='20260419000000' where version='20260419';"

# 3. Verify the CLI is unblocked
supabase migration up   # should now apply pending migrations cleanly
```

### If a `20260419` (8-digit) version ever appears in a remote history

Production's history (verified 2026-07-08 via dashboard) does **not** contain `20260419`,
so no repair is needed there. Only if `supabase migration list` against some environment
shows a bare 8-digit `20260419` do you repair it:

```bash
supabase link --project-ref <PROJECT_ID>
supabase migration repair --status reverted 20260419
supabase migration repair --status applied 20260419000000
supabase migration list   # local and remote columns should line up
```

The CI workflow `.github/workflows/deploy-supabase.yml` needs **no change** — it already
uses `supabase db push` and documents `migration repair` as the drift remedy. Never add
auto-repair to CI (it would rewrite history unconditionally every run).

## Production reality (verified 2026-07-08) — reconcile before deploying `esejbanka`

The production `schema_migrations` list currently ends:
`… 20260303000000_update_profile_role_enum… → 20260621202500_add_rektorat_domain_to_auth_triggers`.

Two facts follow:

1. **The books/essays/reading-hub feature is not on production yet.** The repo has 15
   migrations after `20260303000000` (from `20260419000000_essays_title_trgm_idx` through
   `20260708203841_optimize_rls_auth_initplan`); production has none of them. Deploying
   `esejbanka` is that feature's first prod migration wave. The local `20260419` rename is
   irrelevant to prod — that file applies fresh under its normalized name.

2. **Production has a hotfix the repo does not:**
   `20260621202500_add_rektorat_domain_to_auth_triggers.sql`. It was applied directly to
   prod and never committed. On the next `supabase db push`, the CLI will see a remote
   migration missing from local files and **fail** (the "Remote migration versions not
   found in local migrations directory" error — same class as the local `20260419` issue,
   different cause).

**Fix before deploying:** commit the prod hotfix into the repo so the branch's history is
a superset of prod's.

```bash
# Copy the hotfix SQL from the prod dashboard (Database → Migrations → 20260621202500)
# into a file of the SAME name, then commit it:
supabase/migrations/20260621202500_add_rektorat_domain_to_auth_triggers.sql
```

Then verify with `supabase migration list` (linked to prod) that local ⊇ remote before
`db push`. Because the pending feature migrations (`20260419…`–`20260708…`) are timestamped
*earlier* than the already-applied `20260621202500`, expect out-of-order-apply warnings;
confirm the rektorat auth-trigger change doesn't depend on anything the feature migrations
also touch (it shouldn't — different subsystems — but verify on preview first).

> Verified only from the dashboard list pasted 2026-07-08; re-check `supabase migration list`
> against the live prod project at deploy time before acting.

> **Verification note:** the `20260419000000_essays_title_trgm_idx.sql` migration itself
> is NOT re-run by this — it is already recorded as applied on prod (under the old version)
> and remains recorded (under the new version) after the repair. The repair only relabels it.

## Prevention

- **Always create migrations via the CLI / drizzle-kit** (`pnpm db:generate` or
  `pnpm db:generate:custom`), never by hand-naming files. Both emit 14-digit versions.
- **Never write to `supabase_migrations.schema_migrations` directly** on any environment
  except as a deliberate, documented repair like this one.
- **Never apply migrations via the MCP `apply_migration` tool** — it records history
  out-of-band from the CLI and is the original source of this class of drift.
- If `supabase migration list` ever shows a version whose length is not 14 digits,
  fix it immediately with the repair procedure above before it blocks a deploy.

## Related: Drizzle journal & where RLS policies actually live

Two facts about this repo that are easy to get wrong:

1. **`pnpm db:generate:custom` does not always update `supabase/migrations/meta/`.**
   After creating a custom migration, run `pnpm exec drizzle-kit generate` once
   (it will report "No schema changes") so the `_journal.json` and snapshot files
   pick up the new migration. Commit those meta changes alongside the migration.
   If the journal falls behind the migration files, a later `drizzle-kit generate`
   will do it for you — but keep them in sync deliberately.

2. **RLS policy *bodies* are managed by SQL migrations, not the Drizzle schema.**
   The `pgPolicy(...)` entries in `db/schema/*.ts` were introspected without their
   `using`/`with_check` expressions, and Drizzle's snapshot matches that
   (expression-less) state — so `drizzle-kit generate` is clean. Do **not** backfill
   real policy expressions into `db/schema/*.ts`: doing so creates a diff against the
   snapshot and makes `generate` emit a DROP/CREATE POLICY migration that conflicts
   with the hand-authored SQL migration that already applied the change. To change a
   policy, write a SQL migration (see `20260708203841_optimize_rls_auth_initplan.sql`
   for the DROP + CREATE pattern, authored from the live `pg_policies` definition).
