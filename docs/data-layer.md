# Data Layer — Architecture & Working Guide

How the database, types, and queries fit together in Tappka, and how to work with
them day to day. Read this before touching schema, migrations, or query code.

## TL;DR

- The database is **Supabase Postgres**. Access control is **Row-Level Security (RLS)**.
- The schema (tables, columns, indexes, RLS policies) is defined as code in
  **Drizzle** (`db/schema/*.ts`) — the source of truth.
- **drizzle-kit** turns schema edits into SQL migration files; the **Supabase CLI**
  applies them.
- The app queries the DB **only through `supabase-js`**, and every query is
  **type-checked** against generated types (`src/lib/supabase/database.types.ts`).
- **Drizzle never runs in the app.** There is no runtime ORM. Do not add one.

## The three parts

This is a deliberate split. There is no single "ORM" — three tools each own one job:

| Concern | Tool | Where | Runs |
|---|---|---|---|
| Schema definition (tables, columns, indexes, RLS policies) | **Drizzle** | `db/schema/*.ts` | dev-time only |
| Functions & triggers (Drizzle can't model these) | raw SQL reference in migrations | `supabase/migrations/*.sql` | dev-time only |
| Migration generation | **drizzle-kit** | `pnpm db:generate` | dev-time only |
| Migration application | **Supabase CLI** | `pnpm db:up` | deploy-time |
| Runtime queries | **supabase-js** | `src/lib/**`, `src/app/**` | runtime |
| TypeScript types | **generated** | `src/lib/supabase/database.types.ts` | dev-time |

## How queries work

All three client factories are typed with the generated `Database` type:

- `src/lib/supabase/server.ts` — `createClient()` for Server Components / route handlers
- `src/lib/supabase/client.ts` — `createClient()` for Client Components
- `src/lib/supabase/admin.ts` — `createAdminClient()` **service-role, bypasses RLS**;
  server-only, for system operations. Never expose to the browser.

Because the clients carry `<Database>`, every query is typed:

```ts
const { data } = await supabase.from("essays").select("*");
// data[0].vote_count -> number ; data[0].nope -> compile error
```

Query-helper functions take a typed client:

```ts
import type { Database } from "@/lib/supabase/database.types";

async function getEssays(supabase: SupabaseClient<Database>) { ... }
```

### Types: never hand-write row shapes

Row, Insert, and Update shapes come from the generated types via helpers in
`src/lib/supabase/tables.ts`:

```ts
import type { Tables, Insertable, Updatable } from "@/lib/supabase/tables";

type Essay      = Tables<"essays">;       // the Row shape
type NewEssay   = Insertable<"essays">;   // for .insert()
type EssayPatch = Updatable<"essays">;    // for .update()
```

Enums come from the generated types too:

```ts
type BookStatus = Database["public"]["Enums"]["book_status"];
```

`src/lib/*/types.ts` holds **composites** built on top of these (e.g. `EssayWithDetails`
= a row plus joined `author`/`book`). Base row types and enum unions are **derived,
never hand-declared** — otherwise they drift from the DB. (This is why derived DB
types use `type`, not `interface`.)

Casts (`as X`) are allowed only at genuine reshape boundaries (e.g. collapsing a
`count()` embed into a scalar). Never `as any` on a query result.

## Everyday workflows

### Change a table / column / index / enum / RLS policy

1. Edit `db/schema/*.ts`.
2. `pnpm db:generate` — writes a timestamped SQL file to `supabase/migrations/`.
3. **Review the generated SQL** for unintended `DROP`s.
4. `pnpm db:types` — regenerate `src/lib/supabase/database.types.ts` from the local DB.
5. `pnpm supabase migration up` — apply locally.
6. Commit the schema edit, the migration, **and** the regenerated types together.
7. Deploy: `supabase db push` against production.

> **The one habit that keeps everything honest:** run `pnpm db:types` after every
> schema change and commit the result. That is what connects schema → types → app code.

### Change a function or trigger

Drizzle can't model these — use a hand-authored custom migration:

1. Optionally dump the live definitions for reference with
   `pnpm db:export` (writes gitignored `db/sql/functions.sql` and
   `db/sql/triggers.sql` — generated only, never commit).
2. `pnpm db:generate:custom` — creates an empty timestamped migration.
3. Paste the full `CREATE OR REPLACE FUNCTION ...` (or trigger SQL) into it.
4. `pnpm db:generate` once (reports "No schema changes") so the Drizzle journal
   records the custom migration; commit the `meta/` changes too.
5. `pnpm supabase migration up`, verify, commit.

### Change an RLS policy

**Always keep full `using` / `withCheck` expressions in `db/schema/*.ts` `pgPolicy(...)`
calls**, matching the live policy bodies. Expression-less policies in the Drizzle
snapshot are what caused `DROP COLUMN` to fail when a live policy still referenced the
column (`reservation_type` / `Users can create own reservations`).

Workflow:

1. Edit the `pgPolicy(...)` in `db/schema/*.ts` (name, roles, command, and expressions).
2. `pnpm db:generate` — review the SQL. It should `DROP POLICY` / `CREATE POLICY` (or
   `ALTER POLICY`) **before** any `DROP COLUMN` those policies depend on.
3. `pnpm supabase migration up`, then `pnpm db:types`.

For a one-off body-only tweak when you prefer hand-authored SQL, you can still use
`pnpm db:generate:custom` with `DROP POLICY` + `CREATE POLICY` from live `pg_policies`,
then update the matching `pgPolicy(...)` strings so the next `db:generate` is empty.
See `supabase/migrations/20260708203841_optimize_rls_auth_initplan.sql` for that pattern.

## Hard rules

- **Apply migrations with the Supabase CLI only** (`supabase migration up` locally,
  `supabase db push` to prod). **Never** use the MCP `apply_migration` tool — it records
  history out-of-band from the CLI and is the root cause of migration-history drift.
  See `docs/runbooks/migration-history-drift.md`.
- **Never** edit or rename an already-applied migration file (except a documented repair).
- **Never** run schema commands against production casually; deploys apply migrations.
- **Never** wipe or reset the local database without explicit per-run confirmation.
- **Never** add a runtime Drizzle client. It connects as a privileged role and
  **bypasses RLS** unless every query is wrapped in an RLS transaction — a security
  footgun. Data access stays on `supabase-js`. (Rationale: see the "full ORM" note below.)
- New functions: `SECURITY INVOKER` + `SET search_path = ''` + fully-qualified names.
- New RLS policies: separate policy per command; use `(select auth.uid())`, never bare
  `auth.uid()` (per-row re-evaluation is a performance bug).

## Verifying database changes

There is no unit-test suite for the DB. Verify changes with:

- `pnpm exec tsc --noEmit` — types must be clean (0 errors).
- `pnpm build` — must compile.
- Supabase advisors (MCP `get_advisors`, types `security` and `performance`) after DDL —
  confirm no new findings; ignore INFO-level `unused_index` / `unindexed_foreign_keys`
  on local (no traffic → unreliable; judge those against production).
- For behavior changes (functions, policies): compare output/allow-deny before and after.

## Why not a "full ORM"?

It's possible to run Drizzle at runtime with RLS (via a per-request transaction that
sets `request.jwt.claims` and `set local role authenticated` from the user's token). We
deliberately **don't**, because:

- Typed queries — the main ORM benefit — are already provided by typed `supabase-js`.
- A raw `db.select()` that forgets the RLS wrapper silently bypasses RLS: a security
  footgun `supabase-js` cannot hit.
- Auth, Storage, and Realtime require `supabase-js` regardless, so a runtime ORM adds a
  second data-access model rather than replacing one.
- Direct DB connections complicate serverless/edge deployment.

If a specific query is genuinely painful in PostgREST, use a scoped Drizzle `db.rls(...)`
client for that one query — do not migrate the whole app.

## Related docs

- `docs/runbooks/migration-history-drift.md` — fixing/ preventing migration-history drift.
- `docs/db-deferred-advisor-findings.md` — advisor findings intentionally deferred.
- `docs/superpowers/specs/2026-07-08-orm-tech-debt-design.md` — design behind this setup.
