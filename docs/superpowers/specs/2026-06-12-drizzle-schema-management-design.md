# Drizzle Schema Management — Design

**Date:** 2026-06-12
**Status:** Approved (pending spec review)

## Problem

The database schema lives only in `supabase/migrations/` — 30 incremental SQL files. The history has become hard to follow: superseded objects, fix-on-fix migrations, and dead code make it difficult to answer "what does the database look like right now?"

## Hard constraint

**No production data loss, no risk to production.** Nothing in this conversion runs against the production database. The existing 30 migration files and the remote `schema_migrations` history stay untouched (no squash). Drizzle only generates *future* migration files, which deploy through the exact same pipeline as today.

## Decision

Adopt **Drizzle ORM as the schema source of truth and migration generator**. Drizzle is used purely as a schema-management tool:

- **Changes:** how the schema is defined (TypeScript) and how migrations are produced (`drizzle-kit generate` diffs).
- **Does not change:** runtime data access. All app queries stay on `supabase-js` (`.from()`, `.rpc()`) through PostgREST with RLS enforcement. No Drizzle database connection is added to the app runtime.

Alternatives considered: Supabase declarative schemas (`supabase/schemas/`) — native and lower-effort, but the user prefers a TypeScript ORM schema; migration squash only — doesn't provide an ongoing current-state view; Prisma — poor fit for RLS/triggers/views.

## Architecture

```
db/
  schema/
    profiles.ts        # tables, enums, indexes, RLS policies (pgPolicy)
    teams.ts
    reservations.ts
    books.ts
    essays.ts
    reading.ts         # reading hub, coach reads
    dashboard.ts
    views.ts           # pgView definitions (with security_invoker)
  sql/
    functions.sql      # current-state SQL for functions — Drizzle cannot model these
    triggers.sql       # current-state SQL for triggers
drizzle.config.ts      # dialect: postgresql, out: ./supabase/migrations, migrations.prefix: 'supabase'
supabase/migrations/   # unchanged 30-file history + future drizzle-generated files
```

- RLS policies are defined in-schema via `pgPolicy`, using `drizzle-orm/supabase` predefined roles (`authenticatedRole`, `anonRole`) and `authUsers`.
- Views use `pgView(...).with({ securityInvoker: true })`.
- Triggers and Postgres functions (~26 objects) cannot be expressed in Drizzle. They live as readable current-state files in `db/sql/`, and changes to them ship via `drizzle-kit generate --custom` (hand-written SQL migration) while the current-state file is updated in the same commit.

## One-time migration path

1. Start the local Supabase stack (schema = result of all 30 migrations).
2. `drizzle-kit pull` against the **local** database → introspected TypeScript schema + baseline snapshot.
3. Reorganize the generated schema into the per-domain files above.
4. Extract live functions/triggers from the local database into `db/sql/` (current state only — dead code from the history is dropped here).
5. Baseline so drizzle-kit considers the current state migration zero; existing migration files are not modified.

## Workflow going forward

- **Table / column / enum / index / policy / view change:** edit `db/schema/*.ts` → `pnpm drizzle-kit generate` → review the generated SQL → `supabase migration up` locally → deploy as usual.
- **Trigger / function change:** `pnpm drizzle-kit generate --custom` → write the SQL by hand → update the matching `db/sql/` file.
- **Generated migrations must always be reviewed** before applying — especially anything containing `DROP`.

## Verification

- After setup, `drizzle-kit generate` with no schema edits produces **no migration** (proves the TS schema matches the real database).
- `supabase db advisors` (or MCP `get_advisors`) reports no new issues.
- App builds (`pnpm build`) and lints (`pnpm lint`) cleanly — expected, since no app code changes.
- Parity check: a fresh local database built from the migration history matches the introspected schema.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Introspection misses or mangles an object (e.g., trigram index, enum order, policy detail) | Parity check above; anything Drizzle can't represent stays in `db/sql/` |
| Future generated migration contains an unintended `DROP` | Mandatory review of generated SQL before applying; migrations apply locally first |
| Schema truth split across TS and SQL | Inherent to any ORM here; `db/sql/` files are current-state and reviewed together with schema changes |
| Production impact | None during conversion — no command in this plan targets production |
