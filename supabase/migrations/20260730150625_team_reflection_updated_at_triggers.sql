-- Custom SQL migration file, put your code below! --

-- Migration: updated_at triggers for team reflection tables
-- Purpose: team_reflections, team_semester_reflections, and
--   team_semester_reflection_entries were created without the
--   updated_at-bumping trigger every other mutable table gets (see
--   users_updated_at_trigger / teams_updated_at_trigger / profiles_updated_at_trigger
--   in 20260131000000_initial_schema.sql). Without it, updated_at never
--   changes on UPDATE, so useFieldAutosave's applyIncoming — which skips
--   a broadcast when incoming.updated_at === local.updated_at to avoid
--   reapplying stale/duplicate events — treats every real edit as a no-op
--   and silently discards it. That's why teammates' live edits never
--   appeared without a manual reload.
-- Affected tables: team_reflections, team_semester_reflections,
--   team_semester_reflection_entries

drop trigger if exists team_reflections_updated_at_trigger on public.team_reflections;

create trigger team_reflections_updated_at_trigger
before update on public.team_reflections
for each row
execute function public.handle_updated_at();

drop trigger if exists team_semester_reflections_updated_at_trigger on public.team_semester_reflections;

create trigger team_semester_reflections_updated_at_trigger
before update on public.team_semester_reflections
for each row
execute function public.handle_updated_at();

drop trigger if exists team_semester_reflection_entries_updated_at_trigger on public.team_semester_reflection_entries;

create trigger team_semester_reflection_entries_updated_at_trigger
before update on public.team_semester_reflection_entries
for each row
execute function public.handle_updated_at();
