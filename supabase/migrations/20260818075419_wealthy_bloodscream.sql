-- Custom SQL migration file, put your code below! --

-- Migration: updated_at trigger for team_activities
-- Purpose: team_activities was created without the updated_at-bumping
--   trigger every other mutable table gets (see
--   users_updated_at_trigger / teams_updated_at_trigger / profiles_updated_at_trigger
--   in 20260131000000_initial_schema.sql). Without it, updated_at never
--   changes on UPDATE — the same bug fixed for team_reflections in
--   20260730150625_team_reflection_updated_at_triggers.sql. Keep updated_at
--   in sync so future realtime/autosave logic (which dedups on updated_at)
--   behaves correctly from the start.

drop trigger if exists team_activities_updated_at_trigger on public.team_activities;

create trigger team_activities_updated_at_trigger
before update on public.team_activities
for each row
execute function public.handle_updated_at();
