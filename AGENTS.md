## Code Style

- **TypeScript strict mode** - no `any`, use `interface` over `type` (except derived DB types, which must be `type`), prefer `??` over `||`
- **Naming**: PascalCase components/types, camelCase vars/functions, UPPER_SNAKE_CASE constants, kebab-case files
- **Imports**: external → `@/` internal → styles. One blank line between groups.
- **React**: default to Server Components; use `"use client"` only for interactivity, browser APIs, or third-party init
- **Constants**: never hardcode magic values - extract to named constants or `as const` objects

## Database Migrations

**CRITICAL**: Whenever a user asks you to edit the schema prompt the user to run `pnpm db:migrate` to apply the changes to the database and then make sure to ask the user to check the migrations for any drops.

IF the user insists on you running the migrations manually, run the migrations with the **Supabase CLI through pnpm only** — `pnpm db:up`. Do not tell the user to run `pnpm db:up` recommend running `pnpm db:migrate` instead.

## Database schema changes

The schema source of truth is `db/schema/*.ts` (Drizzle). Do NOT hand-write
migrations for tables/columns/enums/indexes/RLS policies.

- **Always enable RLS on new tables**
- **Tables, columns, enums, indexes, views:** edit `db/schema/*.ts`, then prompt the user for
  `pnpm db:migrate`. Prompt the user to either let you check the changes or make sure to ask the user to check the migrations for any drops. Commit the schema edit and migration together.
- **Functions & triggers:** Drizzle can't model these. run `pnpm db:generate:custom` to create an empty migration, create the `CREATE OR REPLACE` statement in the migration, upload to supabase via `pnpm db:up` along with `pnpm db:export` then run `pnpm db:generate` once (reports "No schema changes") so the Drizzle journal records it; commit the `meta/` changes.
- **RLS policies:** keep full `using` / `withCheck` on every `pgPolicy(...)` in
  `db/schema/*.ts` so `db:generate` can `DROP POLICY` before `DROP COLUMN`. Prefer
  schema edits + generate; custom SQL (DROP + CREATE from live `pg_policies`) is OK
  if you then update the matching `pgPolicy(...)` so the next generate is empty.
- **Types:** never hand-write DB row/enum types. Derive them via `Tables<'x'>` /
  `Database['public']['Enums']['x']` (this is why derived DB types use `type`, not
  `interface`). Query with `supabase-js`; helper signatures take `SupabaseClient<Database>`.
- Never edit existing files in `supabase/migrations/` and never run schema commands using mcp without being specifically asked to do so. Require confirmation if the target is remote.
- App data access stays on `supabase-js`; never add a runtime Drizzle client (it would bypass RLS).

## Realtime

- Use `broadcast` — never `postgres_changes`
- Topic naming: `scope:entity:id` (e.g. `user:123:notifications`)
- Event naming: `entity_action` snake_case (e.g. `message_created`)
- Set `private: true` on all channels; always include cleanup/unsubscribe

## Testing

Full guide: **`docs/runbooks/testing.md`**. Four layers; `pnpm test` (unit +
component) is the fast default. CI (`.github/workflows/test.yml`) runs all layers
on PRs and pushes to `preview`/`production`.

- **Where tests live:** unit `*.test.ts` co-located next to `src/lib/*` source;
  component `*.test.tsx` next to the component under `src/components/`;
  integration in `tests/integration/*.int.test.ts`; E2E in
  `tests/e2e/*.spec.ts`. Shared setup in `tests/setup/`.
- **What goes where:** pure logic (no DB) → unit; React rendering → component;
  DB schema/constraints/triggers/RLS → integration; real user flows through the
  app → E2E. The app talks to the DB only via `supabase-js` (PostgREST over
  HTTP), which can't run against the bare test container — so query-code/route
  coverage belongs to E2E, not integration.
- **Integration DB is throwaway.** `pnpm test:integration` boots a `postgres:16`
  Testcontainer, runs `tests/setup/bootstrap.sql` (recreates the minimal
  `auth`/`realtime`/`storage` surface), then applies `supabase/migrations`.
  **Your local dev DB is never touched, and `supabase db reset` is never run.**
  Each test runs in `withRollback()` (always rolls back); use
  `asClaims(client, { sub })` / `asAnon(client)` to exercise RLS and the
  `tests/setup/factories.ts` helpers to create rows.
- **When a migration adds a new Supabase-managed object** the shim lacks,
  integration setup fails with `Migration failed: <file>` — add the minimal
  missing object to `tests/setup/bootstrap.sql`. Never edit `supabase/migrations/`
  for tests.
- **New feature = new test** in the matching layer. Run the relevant layer before
  committing; `pnpm test` and typecheck must pass.

## GitHub

- Use `gh` (GitHub CLI) for all GitHub operations if available.

## Environment

- Never commit `.env.local` or secrets
