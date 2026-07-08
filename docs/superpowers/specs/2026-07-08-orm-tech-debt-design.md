# ORM / Data-Layer Tech-Debt Paydown — Design

**Date:** 2026-07-08
**Branch:** `esejbanka` (work to land on `production` via PR)
**Status:** Draft — awaiting approval

## Context

The project uses a **hybrid data architecture**, not a single ORM:

| Layer | Tool | Role |
|---|---|---|
| Schema source of truth | Drizzle ORM 0.45.2 (`db/schema/*.ts`) | DDL + RLS definition only |
| Migration generation | drizzle-kit 0.31.10 | diffs schema → `supabase/migrations/*.sql` |
| Migration application | Supabase CLI | applies SQL |
| Runtime queries | `@supabase/supabase-js` / `@supabase/ssr` | all `.from().select()` |
| Runtime types | hand-written `lib/*/types.ts` | manually kept in sync |

Drizzle is **never imported at runtime** — the app talks to Postgres exclusively through supabase-js. This architecture is sound and is **kept as-is**. The work below pays down tech debt within it.

## Goals

1. **Type safety end-to-end** — the query layer is currently untyped (`any`), the single biggest robustness gap.
2. **Close real advisor findings** — function `search_path`, per-row RLS re-evaluation.
3. **Robustness** — reduce silent drift and hand-maintained duplication.

## Hard Constraint (overrides everything)

**Production must never require a database reset.** Every migration is forward-only, additive, and idempotent where possible. No migration may drop/rewrite an object it did not intend to. Verified by full replay on a throwaway shadow DB before any migration is considered done (see Safety Protocol). The working local DB is never wiped.

## Scope

In scope (confirmed with user):
1. Type the query layer — **zero DB migrations, zero prod risk**.
2. Fix function `search_path` on the 2 flagged functions.
3. Optimize RLS policies (per-row `auth.uid()` → `(select auth.uid())`, dedupe overlapping permissive policies).

**Out of scope (deferred):** moving `btree_gist` / `pg_trgm` out of `public` (higher risk of breaking index/function references; low payoff). Also ignoring the INFO-level `unused_index` / `unindexed_foreign_keys` advisor items — those are unreliable on a traffic-free local stack and are not acted on here.

---

## Workstream 1 — Type the query layer

**Problem.** All three client factories (`lib/supabase/server.ts`, `client.ts`, `admin.ts`) call their `create*Client` without the `<Database>` generic. Result: 40 bare `SupabaseClient` usages, every `.from()` returns `any`, and ~21 manual `as X[]` / `as any` casts across `lib/{essays,books,komunita,auth-helpers,storage}` paper over it. A migration that renames/drops a column produces **no compile error**.

**Design.**
1. Generate `lib/supabase/database.types.ts` via `supabase gen types typescript --local` (or MCP `generate_typescript_types`). Committed to the repo.
2. Add `<Database>` to all three factories. `SupabaseClient` type annotations in helper signatures become `SupabaseClient<Database>`.
3. Refactor `lib/*/types.ts`: derive Row/Insert/Update shapes from the generated types (`Database['public']['Tables']['essays']['Row']`) instead of hand-declaring them. Keep genuine composites (`EssayWithDetails`, `EssayCommentWithAuthor`, …) but build them on top of generated Rows.
4. Remove casts that the typed client makes unnecessary. Casts that remain (e.g. reshaping `essay_comments(count)` join results) get narrowed, not blanket `as any`.
5. Add a `db:types` script and document that it runs after every schema change so types can't drift.

**Interface / boundaries.** `database.types.ts` is generated, never hand-edited. `lib/*/types.ts` is the only place composites live. Consumers import from `lib/*/types.ts`, unaware of the generated file.

**Verification.** `pnpm build` / `tsc --noEmit` must pass. Spot-drive one typed query per module to confirm inferred types match runtime shape.

---

## Workstream 2 — Function `search_path`

**Problem.** `public.get_best_books_per_category` and `public.get_teams_with_member_stats` are `STABLE SECURITY DEFINER` with no `SET search_path`. Advisor `0011_function_search_path_mutable` (WARN, security).

**Design.**
1. In `db/sql/functions.sql`, add `SET search_path = ''` and fully schema-qualify all object references inside both function bodies (matches the pattern already used by `before_user_created_hook`). If qualifying proves noisy, fall back to `SET search_path = public, pg_temp` — decided per-function at implementation time.
2. Create a custom migration via `pnpm db:generate:custom` and paste the `CREATE OR REPLACE FUNCTION` bodies (the documented workflow in `functions.sql`). `CREATE OR REPLACE` is idempotent and forward-only.

**Verification.** Re-run security advisor on the shadow DB — findings for both functions gone. Call each function and confirm identical results.

---

## Workstream 3 — RLS policy optimization

**Problem & drift caveat.** Advisor flags per-row re-evaluation on several policies (e.g. reservations `Users can create/update own reservations`) and overlapping permissive policies on reservations/rooms/room_issues/schedule_breaks/recurring_schedules. Confirmed: the **live** policy uses unwrapped `uid()` (`WHERE users.auth_user_id = uid()`), while the **Drizzle schema file carries no expression** for these policies — i.e. `db/schema/*.ts` has drifted from the live DB. Therefore `drizzle-kit generate` **cannot be trusted** for policy changes here: diffing a drifted schema against a drifted snapshot risks emitting a migration that strips the real policy expression.

**Design (drift-safe).**
1. **Read ground truth from the DB**, not the schema: dump each target policy's exact `qual` / `with_check` from `pg_policies` (already done for reservations; repeat for every flagged policy).
2. **Hand-author custom SQL migrations** (`db:generate:custom`) that `DROP POLICY … ; CREATE POLICY …` with the *exact* live expression, applying only the intended transformation: `auth.uid()` → `(select auth.uid())`, `current_setting(...)` → `(select current_setting(...))`. Overlapping permissive policies are consolidated only where semantics are provably identical; otherwise left alone and noted.
3. **Reconcile the schema files afterward**: backfill the corrected expressions into `db/schema/*.ts` `pgPolicy(...)` calls so the source of truth matches reality going forward, and re-take the Drizzle snapshot. This step is code-only (no new migration) and closes the drift.
4. This workstream is the riskiest and lands **last**, in its own commit/PR-slice, so typing and function fixes are not blocked by it.

**Verification.** On the shadow DB: re-run performance advisor (flagged policies gone), and run RLS behavior checks — for each changed policy, confirm an authorized row is still permitted and an unauthorized row is still denied (behavior must be byte-for-byte equivalent, only faster).

---

## Production-Safety Protocol (applies to Workstreams 2 & 3)

Before any migration is considered done:
1. **Shadow rebuild:** spin up a throwaway Postgres (temporary Supabase shadow DB / separate container), replay **all** migrations `0000…` → newest from scratch. Must succeed with zero errors. This proves a fresh prod-equivalent apply works and no migration references a dropped object.
2. **Diff audit:** inspect each generated/authored migration — it must contain **only** the intended change. Any unexpected DROP/ALTER is a stop-the-line drift signal.
3. **Advisor re-check** on the shadow DB after replay — target findings resolved, no new WARN/ERROR introduced.
4. **No MCP `apply_migration`** for these changes — that is the known source of out-of-band drift. Migrations live as files applied by the Supabase CLI only.
5. Working local DB is never `db reset`. All from-scratch replay happens on the shadow DB.

## Sequencing

1. **Phase 1 — Typing** (no DB risk). Land first; independently valuable.
2. **Phase 2 — Function search_path** (safe additive migration).
3. **Phase 3 — RLS optimization + drift reconciliation** (most careful; last).

Each phase is independently shippable and independently revertable.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Generated types diverge from prod schema | Generate from a schema verified by full shadow replay; wire `db:types` into the change workflow |
| `drizzle-kit generate` strips drifted policy expressions | Workstream 3 bypasses generate; hand-authors from live `pg_policies` truth |
| `search_path=''` breaks unqualified refs in function body | Fully qualify refs, or use `search_path = public, pg_temp`; verify by calling the function |
| Consolidating permissive policies changes access semantics | Only consolidate when provably identical; otherwise leave and note; behavior-test every change |
| Local data loss | Shadow DB for all replay; never reset working local |

## Success Criteria

- `tsc --noEmit` passes with `<Database>`-typed clients; blanket `as any`/`as X[]` casts in query files eliminated or narrowed.
- Security advisor: both function `search_path` findings resolved.
- Performance advisor: flagged `auth_rls_initplan` findings resolved; no behavior change in RLS.
- Full migration replay on a fresh shadow DB succeeds end-to-end.
- Drizzle schema files match live policy definitions (drift closed).
