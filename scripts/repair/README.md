# One-off production repair: `20260718212747_noisy_medusa.sql`

Nothing in here is a migration. These files are **not** under `supabase/migrations/`
on purpose — `scripts/check-migration-integrity.mjs` forbids editing applied
migrations, and this repair has to run *instead of* one.

## What went wrong

`supabase/migrations/20260718212747_noisy_medusa.sql` is a drizzle-kit catch-up
migration (237 statements). drizzle-kit generated it by diffing `db/schema/*.ts`
against the local stack (`drizzle.config.ts` → `127.0.0.1:54322`), where the
affected tables were empty. That is why it emits 25 bare

```sql
ALTER TABLE "x" ADD COLUMN "y" uuid NOT NULL;   -- no DEFAULT, no backfill
```

statements. On an empty table that is a no-op. On a populated table it is a hard
`23502`. Production has live reservation data, so the deploy hit:

```
ERROR: column "schedule_type" of relation "recurring_schedules" contains null values
At statement: 122
```

The Supabase CLI runs each migration file in one transaction, so that failure
rolled the whole file back — including statement 45, the
`profiles.removed_access → access_removed_at` rename. The deployed app queries
`access_removed_at` (`src/lib/komunita/queries.ts:31`, `src/lib/essays/queries.ts:142`),
hence the runtime `42703`. **One root cause, two symptoms.**

There is no way to prep the data so the migration succeeds as written:
`ADD COLUMN ... NOT NULL` with no `DEFAULT` fails on any non-empty table, and
pre-creating the columns turns the `23502` into a `42701 column already exists`.

## The files

| File | What it is |
| --- | --- |
| `noisy-medusa-preflight.sql` | **Read-only.** Run first. Reports the data the migration destroys and confirms which state production is in. |
| `noisy-medusa-repair.sql` | The repair. Applies the migration's end state safely, then records it as applied. |
| `generate-noisy-medusa-repair.mjs` | Generates the repair from the migration file, so it can't drift from it. |
| `verify-noisy-medusa-repair.sh` | Proves the repair works. Needs Docker. |

The repair is **generated, not hand-written** — every statement is carried over
from the migration verbatim except:

- the 25 unsafe `ADD COLUMN ... NOT NULL` → `ADD COLUMN` nullable, backfill,
  `SET NOT NULL`
- drops/creates made idempotent, so a re-run or an out-of-band-drifted schema
  doesn't abort the run
- one extra backfill of `schedule_breaks.created_by_profile_id`, which
  `20260719161010_fix_rename_casts.sql:87` promotes to `NOT NULL` and which
  noisy_medusa renames from a nullable column without ever filling in

Regenerate after editing the generator:

```sh
node scripts/repair/generate-noisy-medusa-repair.mjs
```

## Backfill decisions

| Column | Source |
| --- | --- |
| `recurring_schedules.schedule_type` | `'training_session'` for every row — consistent with the `recurring_schedules_team_for_ts` CHECK, since every existing row has a non-null `team_id` |
| `recurring_schedules.created_by/updated_by_profile_id` | old `created_by`, else fallback actor |
| `reservations.created_by/updated_by_profile_id` | `owner_profile_id`, else fallback actor (HC/system rows have a NULL owner) |
| `rooms.created_by/updated_by_profile_id` | fallback actor — `rooms` never had a creator column |
| `schedule_breaks.updated_by_profile_id` | `created_by_profile_id`, else fallback actor |
| `essays`, `books`, `feedback`, `essay_*`, `book_comments`, `dashboard_layouts` | their existing author/owner column, else fallback actor |

The **fallback actor** is the oldest `admin` profile (oldest profile of any role
if there is no admin). The script aborts if `profiles` is empty.

## Data this destroys

The migration is destructive independently of the bug. `noisy-medusa-preflight.sql`
section 3 counts every affected row. The sharpest edge: it creates
`essay_revisions` **empty** and then drops `essays.title` / `content_json` /
`content_text` without copying anything across. It also drops
`team_reading_lists`, `team_reading_list_books`, `cowork_participants` and
`room_issues`, plus `users.google_profile_picture` / `google_full_name`,
`reservations.team_id` / `recurring_schedule_id` / `reservation_type` /
`is_cowork_open`, `schedule_breaks.break_type` and `feedback.admin_response*`.

The repair script has a guard block that **aborts** if `essays` or any of the four
dropped tables hold rows. Remove the block only once you've decided the loss is
acceptable.

## Running it

```sh
# 1. Read-only. Read every section of the output before continuing.
psql "$PRODUCTION_DB_URL" -f scripts/repair/noisy-medusa-preflight.sql

# 2. Back up first. This is destructive and not reversible.
supabase db dump --db-url "$PRODUCTION_DB_URL" -f backup-before-repair.sql

# 3. The repair. One transaction: it either fully applies or fully rolls back.
psql "$PRODUCTION_DB_URL" -v ON_ERROR_STOP=1 -f scripts/repair/noisy-medusa-repair.sql

# 4. The CLI now skips noisy_medusa and applies the 6 migrations after it.
pnpm supabase migration up --db-url "$PRODUCTION_DB_URL"
```

Step 3 already records `20260718212747` in
`supabase_migrations.schema_migrations`, which is what
`supabase migration repair --status applied 20260718212747` would have done.

## Verification

```sh
./scripts/repair/verify-noisy-medusa-repair.sh   # requires Docker
```

It boots `postgres:16`, applies the 45 migrations that production already has via
`tests/setup/bootstrap.sql`, seeds rows into the tables that made the migration
fail, and then checks:

- **Control** — the real migration still fails with the exact production error,
  proving the seed reproduces production
- **State A** — transactional runner (the CLI): whole file rolls back, so
  `profiles.removed_access` survives. This is the `42703`. Repair recovers it.
- **State B** — autocommit runner: statements 1–122 commit. Repair recovers that
  too, and runs cleanly a second time.
- **Convergence** — A and B end on an identical schema
- **Equivalence** — the repaired schema is byte-identical to a clean install of
  all 52 migrations, i.e. exactly what local and preview have

## The actual fix

This repair unblocks the deploy. It does not fix the cause: drizzle-kit generates
unsafe DDL because it diffs against an empty local database, and neither CI nor
preview has data, so nothing catches it before production. Worth considering a
`db:generate` post-check that rejects `ADD COLUMN ... NOT NULL` without a
`DEFAULT`, or seeding the integration-test DB before applying migrations in CI.
