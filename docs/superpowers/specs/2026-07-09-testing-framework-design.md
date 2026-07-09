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

Covers code that builds/runs Drizzle + Supabase queries, and API route handlers.

- A test-setup module boots **one Testcontainers Postgres per run**, applies `supabase/migrations` (the exact migration files that ship to production), and exposes a Drizzle/pg client pointed at that container.
- **Isolation:** each test runs inside a transaction that is **rolled back** at teardown. Nothing persists between tests; nothing is ever reset. The dev DB is never in the connection string.
- **RLS:** policies arrive via migrations. Tests set `role` and `request.jwt.claims` within the transaction to exercise policies as a given user. (Supabase's Auth *service* is not present in the container; setting JWT claims directly is the standard way to test RLS.)
- **Why this proves merges are safe:** the test DB in every environment is built by replaying `supabase/migrations` — the same files the deploy workflow pushes to preview/production. A passing integration test validates queries against the real, current schema about to ship.

### E2E (Playwright)

A thin layer over critical flows only: auth/login, make a reservation, submit an essay. Runs against `next build && next start` + local Supabase, seeded with known fixture data. **Seed only — never a reset of dev data.**

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
