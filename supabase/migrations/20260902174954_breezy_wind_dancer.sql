-- No-op reconciliation: essays_frozen_book_points_check was already added by
-- 20260902172925_team_stats_frozen_points_and_lockdown.sql (a custom migration
-- that also redefines get_teams_with_member_stats() and revokes column-level
-- UPDATE on frozen_book_points). Drizzle's snapshot didn't know about it since
-- that migration was hand-written, so `drizzle-kit generate` re-proposed the
-- same ALTER TABLE here. This file exists only so the Drizzle journal/snapshot
-- catches up to match db/schema/essays.ts; it intentionally does nothing.
select 1;