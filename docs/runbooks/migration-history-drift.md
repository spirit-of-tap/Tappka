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

## Deploying `esejbanka` to production — the out-of-order `--include-all` requirement

Background (verified 2026-07-08): production's history ends
`… 20260303000000_update_profile_role_enum… → 20260621202500_add_rektorat_domain_to_auth_triggers`.
The books/essays/reading-hub feature (15 migrations from `20260419000000` through
`20260708203841`) has **never been deployed to prod** — deploying `esejbanka` is that
feature's first prod wave.

**Resolved:** `origin/production` was merged into `esejbanka` (2026-07-08), which brought
`20260621202500_add_rektorat_domain_to_auth_triggers.sql` into the branch. The branch
history is now a superset of prod's — so there is NO remote-only migration to trip
`db push`. (Earlier drafts of this runbook said to copy the hotfix from the dashboard;
the merge did it instead.)

**The real remaining gotcha — out-of-order timestamps:** most feature migrations
(`20260419…`–`20260612…`) are timestamped *earlier* than production's already-applied
`20260621202500`. So `supabase db push` will report:

```
Found local migration files to be inserted before the last migration on remote database.
Rerun the command with --include-all flag to apply these migrations
```

This is a **one-time** requirement for this deploy (once the backlog is applied, future
migrations are newer and this won't recur). Two ways to handle it:

- **Recommended — one-time manual push, outside CI:**
  ```bash
  supabase link --project-ref <PRODUCTION_PROJECT_ID>
  supabase migration list          # confirm local ⊇ remote
  supabase db push --include-all    # applies the earlier-timestamped backlog
  ```
  Do the same against the preview project first if you want a dry run.

- **Or temporarily** add `--include-all` to the `db push` step in
  `.github/workflows/deploy-supabase.yml`, deploy, then revert it. (The default workflow
  runs plain `supabase db push`, which will **fail** on this deploy without the flag.)

Verify on preview before production. The rektorat auth-trigger change and the feature
migrations touch different subsystems, so out-of-order apply is safe — but confirm on
preview first. Re-check `supabase migration list` against the live project at deploy time.

> Correction history: this section previously (a) claimed prod needed a `20260419` repair
> (false — that was local-only) and (b) claimed the rektorat file must be copied from the
> dashboard (superseded — the `origin/production` merge brought it). The accurate remaining
> action is the one-time `--include-all` push above.

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

2. **RLS policy bodies belong in the Drizzle schema.** Keep full `using` /
   `withCheck` on every `pgPolicy(...)` so `db:generate` can order `DROP POLICY`
   before `DROP COLUMN` when a policy depends on that column. Expression-less
   snapshot policies are a known cause of apply failures. After any hand-authored
   policy SQL migration, update the matching `pgPolicy(...)` strings so the next
   generate is empty.
