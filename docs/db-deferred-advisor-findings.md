# Deferred Supabase advisor findings

Decisions recorded 2026-07-08 during the ORM/data-layer tech-debt pass
(`docs/superpowers/plans/2026-07-08-orm-tech-debt.md`). These findings were
reviewed and **intentionally deferred** — with reasoning — rather than fixed.

## `multiple_permissive_policies` (performance, WARN) — DEFERRED

Flagged pairs (all `role = authenticated`):

| Table | Action | Overlapping policies |
|---|---|---|
| recurring_schedules | SELECT | Authenticated can read · Coaches can manage |
| reservations | SELECT | Authenticated can read · Coaches can manage TS |
| reservations | INSERT | Coaches can manage TS · Users can create own |
| reservations | UPDATE | Coaches can manage TS · Users can update own |
| reservations | DELETE | Coaches can manage TS · Users can delete own |
| room_issues | UPDATE | Coaches can resolve issues · Users can update own issues |
| rooms | SELECT | Admins can manage rooms · Authenticated can read rooms |
| schedule_breaks | SELECT | Authenticated can read · Coaches can manage |

**Why deferred:** every pair overlaps a broad policy with a **`FOR ALL`**
role-scoped "manage" policy. The overlap can't be removed by dropping a policy —
the `FOR ALL` policy legitimately covers the other commands. Eliminating the
overlap would require splitting each `FOR ALL` policy into separate per-command
(`FOR INSERT`/`UPDATE`/`DELETE`) policies. That is a structural change to
security-sensitive RLS for a **performance-only WARN**, with a real risk of
subtly changing access semantics. Poor risk/reward, especially during a
stabilization phase.

**If revisited later:** rewrite each `... can manage ...` policy as explicit
per-command policies (keeping the `USING`/`WITH CHECK` identical), then the
`SELECT` overlap disappears. Author it as a SQL migration from the live
`pg_policies` definitions (same drift-safe pattern as
`20260708203841_optimize_rls_auth_initplan.sql`), behavior-test each command's
allow/deny, and re-run the performance advisor.

## `extension_in_public` (security, WARN) — DEFERRED

`btree_gist` and `pg_trgm` are installed in the `public` schema. Moving an
extension out of `public` (`ALTER EXTENSION ... SET SCHEMA extensions`) can break
index definitions and function references that assume the operators/functions are
on the default search_path. Low payoff, real breakage risk. Left in place.

## INFO-level findings — NOT actionable from local

`unindexed_foreign_keys` and `unused_index` were reported but are **unreliable on
the local stack**: the local DB has no production traffic, so "unused" reflects
zero query history, not a genuinely unused index. Re-evaluate these against the
**production** advisor before acting; do not add/drop indexes based on local runs.
