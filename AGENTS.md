# AGENTS.md - Tappka

Next.js 16 + React 19 + Supabase + Tailwind CSS v4 + shadcn/ui. Package manager: pnpm.

## Commands

```bash
pnpm dev        # Start dev server + local Supabase
pnpm build      # Production build
pnpm lint       # ESLint
pnpm supabase:start
pnpm supabase:stop

# Tests (see docs/runbooks/testing.md)
pnpm test              # Unit + component (fast, no Docker)
pnpm test:unit         # Pure logic in lib/* (*.test.ts, co-located)
pnpm test:component    # React components, jsdom + Testing Library (*.test.tsx)
pnpm test:integration  # DB schema/triggers/RLS on a throwaway Postgres (needs Docker)
pnpm test:e2e          # Playwright flows (needs pnpm build + local Supabase)
pnpm test:watch        # Watch unit tests

# Data layer (see docs/data-layer.md)
pnpm db:generate         # Drizzle: schema edits -> SQL migration
pnpm db:generate:custom  # Empty custom migration (functions/triggers/RLS)
pnpm db:types            # Regenerate lib/supabase/database.types.ts from local DB
pnpm supabase migration up   # Apply pending migrations locally
```

## Code Style

- **TypeScript strict mode** - no `any`, use `interface` over `type` (except derived DB types, which must be `type` — see `docs/data-layer.md`), prefer `??` over `||`
- **Naming**: PascalCase components/types, camelCase vars/functions, UPPER_SNAKE_CASE constants, kebab-case files
- **Imports**: external → `@/` internal → styles. One blank line between groups.
- **React**: default to Server Components; use `"use client"` only for interactivity, browser APIs, or third-party init
- **Constants**: never hardcode magic values - extract to named constants or `as const` objects

## Database Migrations

Full guide: **`docs/data-layer.md`**. See **Database schema changes** below for when
and how migrations are created. The rules below apply to all migrations regardless of origin.

**CRITICAL**: Apply migrations with the **Supabase CLI only** — `supabase migration up`
locally, `supabase db push` to production. **Never** use the MCP `apply_migration` tool:
it records history out-of-band from the CLI and is the root cause of migration-history
drift (see `docs/runbooks/migration-history-drift.md`). A migration must always exist as
a file in `supabase/migrations/` before it is applied; the history table must never
drift from what is on disk.

### Migration rules
- Always enable RLS on new tables
- Separate policies per operation: one `select`, one `insert`, one `update`, one `delete`
- Use `SECURITY INVOKER` and `set search_path = ''` in all functions
- Use `(select auth.uid())` (not bare `auth.uid()`) in RLS policies for performance
- Lowercase SQL keywords, snake_case identifiers, fully qualified names (`public.table`)

## Database schema changes

The schema source of truth is `db/schema/*.ts` (Drizzle). Do NOT hand-write
migrations for tables/columns/enums/indexes.

- **Tables, columns, enums, indexes, views:** edit `db/schema/*.ts`, then
  `pnpm db:generate`. Review the generated SQL in `supabase/migrations/` (watch for
  unintended DROPs), then `pnpm db:types` to regenerate types, then
  `pnpm supabase migration up`. Commit the schema edit, migration, and types together.
- **Functions & triggers:** Drizzle can't model these. Edit the current-state file in
  `db/sql/`, run `pnpm db:generate:custom` to create an empty migration, paste the
  `CREATE OR REPLACE` statement in, then run `pnpm db:generate` once (reports "No schema
  changes") so the Drizzle journal records it; commit the `meta/` changes.
- **RLS policies:** author a custom SQL migration from the live `pg_policies` definition
  (DROP + CREATE). Do NOT backfill policy bodies into `db/schema/*.ts` — the schema files
  don't carry expressions and doing so creates false drift.
- **Types:** never hand-write DB row/enum types. Derive them via `Tables<'x'>` /
  `Database['public']['Enums']['x']` (this is why derived DB types use `type`, not
  `interface`). Query with `supabase-js`; helper signatures take `SupabaseClient<Database>`.
- Never edit existing files in `supabase/migrations/` and never run schema commands
  against production casually.
- App data access stays on `supabase-js`; never add a runtime Drizzle client (it would
  bypass RLS). Rationale in `docs/data-layer.md`.

## Realtime

- Use `broadcast` — never `postgres_changes`
- Topic naming: `scope:entity:id` (e.g. `user:123:notifications`)
- Event naming: `entity_action` snake_case (e.g. `message_created`)
- Set `private: true` on all channels; always include cleanup/unsubscribe

## Testing

Full guide: **`docs/runbooks/testing.md`**. Four layers; `pnpm test` (unit +
component) is the fast default. CI (`.github/workflows/test.yml`) runs all layers
on PRs and pushes to `preview`/`production`.

- **Where tests live:** unit `*.test.ts` co-located next to `lib/*` source;
  component `*.test.tsx` next to the component; integration in
  `tests/integration/*.int.test.ts`; E2E in `tests/e2e/*.spec.ts`. Shared setup
  in `tests/setup/`.
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
- **Known issue:** `pnpm lint` currently crashes on a pre-existing ESLint/ajv
  toolchain error (unrelated to tests) — it will fail the CI lint step until fixed.

## GitHub

- Use `gh` (GitHub CLI) for all GitHub operations — issues, PRs, reviews, and checks
- Use `gh issue` for issue operations: `gh issue list`, `gh issue view`, `gh issue create`, `gh issue close`
- Use `gh pr` for pull request operations: `gh pr list`, `gh pr view`, `gh pr create`, `gh pr checkout`, `gh pr review`, `gh pr merge`
- Always check current context with `gh status` before starting work
- Use `gh browse` to open the repo in a browser when needed

## Environment

- Copy `.env.local.example` → `.env.local` for local dev
- Never commit `.env.local` or secrets
