# Testing Framework for Tappka — Design

**Date:** 2026-07-09
**Status:** Approved, pending implementation plan
**Context:** Stabilization / tech-debt phase. The project currently has **zero** automated tests, no test runner, and no test CI. This introduces a layered testing harness plus CI gating.

## Goal

Establish a full testing pyramid — fast unit tests, real-database integration tests, and a thin layer of end-to-end tests — wired into CI so broken logic cannot merge to `preview`/`production`. Deliver the harness plus one worked example per layer; coverage grows incrementally as code is touched (fits the stabilization phase).

## Hard constraints

- **Never reset, truncate, or wipe the developer's local database.** Local dev data is precious. Integration tests must use a *separate, disposable* database that has no relationship to the dev DB — the dev DB connection string never appears in any test path.
- No `supabase db reset` anywhere in test or CI flows.

## Stack (for reference)

Next.js 16, React 19, TypeScript (strict), Supabase (Postgres + Drizzle ORM), pnpm, Tailwind v4. Business logic in `lib/*`, ~30 API routes in `app/api/*`, UI in `components/*`.

## Tools

- **Vitest** — unit + integration runner. ESM-native, fast, first-class TS. Config in `vitest.config.ts`, mirroring the `@/*` path alias from `tsconfig.json`.
- **React Testing Library + jsdom** — component tests, driven by Vitest.
- **Playwright** — E2E against the running Next.js app + local Supabase.
- **@testcontainers/postgresql** — throwaway Postgres for integration tests.

## Architecture — three layers

### Unit (fast, no DB)

Pure logic extracted from `lib/*`: availability/date math (reservations), Zod validation schemas, permission calculations, formatters, reducers. Third-party network calls we don't own (external book search API, PostHog) are mocked at this layer. No database, no Docker — instant.

### Integration (real Postgres, throwaway)

Covers the **database contract**: that `supabase/migrations` apply cleanly, and that the resulting schema behaves correctly — key constraints, trigger functions (e.g. `on_auth_user_created` populating `public.users`), and RLS policies. This is the layer that catches a migration silently breaking the schema or a policy.

> **Scope note:** the app talks to the DB exclusively through `@supabase/supabase-js` (PostgREST + Auth over HTTP), which cannot run against a bare Postgres container. So integration tests exercise the schema/RLS directly via a `pg` client — not the app's supabase-js query calls. Full coverage of the app's actual query code and API route handlers lives in the **E2E layer**, which runs against the real local Supabase stack.

- A test-setup module boots **one Testcontainers Postgres per run** (the `supabase/postgres` image so Supabase roles/extensions are present), runs a checked-in **`bootstrap.sql`** to create the minimal Supabase `auth` layer the migrations depend on (`auth` schema, `auth.users`, `auth.uid()`/`auth.jwt()`/`auth.role()` shims that read `request.jwt.claims`), then applies `supabase/migrations` (the exact migration files that ship to production), and exposes a `pg` client pointed at that container.
- **Why `bootstrap.sql` is needed:** the migrations reference `auth.users`, `auth.uid()`, and the `authenticated`/`anon`/`service_role` roles, and place triggers on `auth.users`. These come from Supabase's Auth service (not the base Postgres image), so the test environment must recreate the minimal subset before app migrations apply. This bootstrap is load-bearing and is built/validated empirically until all migrations apply cleanly.
- **Isolation:** each test runs inside a transaction that is **rolled back** at teardown. Nothing persists between tests; nothing is ever reset. The dev DB is never in the connection string.
- **RLS:** policies arrive via migrations. Tests set `role` and `request.jwt.claims` within the transaction to exercise policies as a given user. (Supabase's Auth *service* is not present in the container; setting JWT claims directly is the standard way to test RLS.)
- **Why this proves merges are safe:** the test DB in every environment is built by replaying `supabase/migrations` — the same files the deploy workflow pushes to preview/production. A passing integration test validates queries against the real, current schema about to ship.

### E2E (Playwright)

A thin layer over critical flows. Runs against `next build && next start` + local Supabase, seeded with known fixture data. **Seed only — never a reset of dev data.**

> **First deliverable vs. growth:** the app authenticates via Google OAuth / OTP, which can't be driven through a real third-party login in CI. The worked E2E example is therefore a **public-route smoke test** (app boots and serves), plus a documented pattern for authenticated flows: mint a session for a seeded test user via the `service_role` key / Supabase admin API and inject it, then drive reservation/essay flows. Authed flows are added incrementally on that pattern.

## Directory layout

```
vitest.config.ts
playwright.config.ts
tests/
  setup/            # testcontainers boot, migration apply, tx-rollback helpers, RLS helpers, factories
  unit/             # or co-located *.test.ts next to lib/* source
  integration/      # *.int.test.ts — DB + API route tests
  e2e/              # *.spec.ts Playwright specs + fixtures/seed
```

Two Vitest *projects* (unit vs integration): `pnpm test:unit` stays DB-free and instant; `pnpm test:integration` pulls up Testcontainers.

## package.json scripts

- `test` — unit + integration (Vitest)
- `test:unit` — unit only, no Docker
- `test:integration` — integration, boots Testcontainers
- `test:e2e` — Playwright
- `test:watch` — Vitest watch (unit)

## CI — new `.github/workflows/test.yml`

Runs on pull requests and on pushes to `preview`/`production`, in parallel with the existing `deploy-supabase.yml`. Steps: install → typecheck (`tsc --noEmit`) → `lint` → `test:unit` → `test:integration` (Docker available on runner) → `test:e2e`. Branch protection makes this check required, so broken logic cannot merge/deploy. Nothing in CI or locally ever touches the dev database.

## Seeds / fixtures

A small typed fixture builder (`tests/setup/factories.ts`) creates users, rooms, reservations, etc. on demand inside a test's transaction, so each test declares exactly the data it needs rather than depending on shared global state.

## Scope guardrails (YAGNI)

**Not** in this work: coverage-percentage gates, visual-regression/snapshot testing, mutation testing, or backfilling tests across the whole codebase. Deliverable is the **harness + one worked example per layer**. Coverage grows incrementally as code is touched.

## Deliverables (definition of done)

1. Vitest configured with unit + integration projects and the `@/*` alias.
2. Testcontainers setup module: boots Postgres, applies `supabase/migrations`, provides a Drizzle client and a transaction-rollback wrapper.
3. RLS helper for setting role/JWT claims in a test transaction.
4. Typed fixture/factory helpers.
5. Playwright configured against `next start` + local Supabase, with seed fixtures.
6. One worked example test per layer (unit, integration, E2E) that passes.
7. `package.json` test scripts.
8. `.github/workflows/test.yml` gating PRs and `preview`/`production`.
9. Short README/docs section on how to run each layer and how to write a new test.
