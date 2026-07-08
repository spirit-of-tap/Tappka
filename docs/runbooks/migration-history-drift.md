# Runbook: Migration-history drift (malformed version `20260419`)

**Status:** Local fixed 2026-07-08. **Production fix still pending** — see "Fix on production" below.

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

### Fix on production (PENDING — run when next deploying)

Do this **before** the first `supabase db push` after this change. It only rewrites a
version string in `schema_migrations`; it does not run DDL, touch data, or reset anything.

```bash
# Target the linked production project (ensure `supabase link` points at prod).
# Mark the malformed version as reverted (removes the 20260419 marker) ...
supabase migration repair --status reverted 20260419

# ... and mark the normalized version as applied (adds 20260419000000).
supabase migration repair --status applied 20260419000000

# Confirm the CLI now sees a clean history:
supabase migration list         # local and remote columns should line up
```

After the repair, `supabase db push` will apply any pending migrations (function
`search_path` fix, RLS optimization, and anything future) normally.

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
