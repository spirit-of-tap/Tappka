-- Previously a near-duplicate of 20260718212747_noisy_medusa that broke
-- `supabase db reset` with: type "schedule_type" already exists.
-- Meaningful follow-ups (timestamptz casts / NOT NULL) live in
-- 20260718220831_romantic_juggernaut.sql. Kept as a no-op so the
-- migration version stays stable in history.

select 1;
