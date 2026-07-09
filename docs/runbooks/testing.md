# Testing

Three layers, all runnable with pnpm.

## Layers

| Layer | Command | Needs | What it covers |
|-------|---------|-------|----------------|
| Unit | `pnpm test:unit` | nothing | Pure logic in `lib/*` (`*.test.ts` co-located) |
| Component | `pnpm test:component` | nothing | React components via jsdom + Testing Library (`*.test.tsx`) |
| Integration | `pnpm test:integration` | Docker | DB schema, triggers, RLS against a throwaway Postgres (`tests/integration/*.int.test.ts`) |
| E2E | `pnpm test:e2e` | local Supabase + `pnpm build` | Critical flows against the running app (`tests/e2e/*.spec.ts`) |

`pnpm test` runs unit + component (fast, no Docker). `pnpm test:watch` watches unit.

## The integration database

Integration tests boot a **throwaway** `postgres:16` container (Testcontainers),
run `tests/setup/bootstrap.sql` to recreate the minimal Supabase surface
(`auth`, `realtime`, `storage`), then apply `supabase/migrations`. **Your local
dev database is never touched** — the connection string comes from the container.

- Each test runs inside `withRollback()` (`tests/setup/tx.ts`) — a transaction
  that always rolls back, so nothing persists.
- Use `asClaims(client, { sub: userId })` / `asAnon(client)` (`tests/setup/rls.ts`)
  to exercise RLS as a given user.
- Use factories in `tests/setup/factories.ts` to create rows.

If a new migration references a Supabase object the shim lacks, integration
tests fail in setup with `Migration failed: <file>`. Add the minimal missing
object to `tests/setup/bootstrap.sql`. **Never** edit files under
`supabase/migrations/` for tests, and never run `supabase db reset`.

## Adding an authenticated E2E flow

The worked E2E example is a public-route smoke test (OAuth can't be driven in
CI). For authed flows: create a seeded test user, mint a session with the
`service_role` key via the Supabase admin API, inject the session cookie in a
Playwright fixture, then drive the flow.
