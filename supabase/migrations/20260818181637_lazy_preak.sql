-- Custom SQL migration file, put your code below! --

-- Migration: updated_at trigger for personality_tests.
-- Mirrors the team_activities trigger (20260818075419_wealthy_bloodscream.sql):
-- without it, updated_at never changes on UPDATE.

drop trigger if exists personality_tests_updated_at_trigger on public.personality_tests;

create trigger personality_tests_updated_at_trigger
before update on public.personality_tests
for each row
execute function public.handle_updated_at();
