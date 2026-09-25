-- Auto-create a `training` time entry when a team member is marked present on a
-- Training Session. Window comes from the team's recurring TS schedule.
-- Rules (docs/plans/2026-09-24-timetracking-design.md §6):
--   1. A tracked entry overlapping the TS window wins — nothing is created.
--   2. Present + no entry in the window → entry for the whole TS window.
--   3. Status changed away from present → the untouched auto entry is deleted.
--   4. No schedule for that weekday → nothing (no invented hours).
create or replace function public.sync_training_session_time_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activity public.team_activities%rowtype;
  v_schedule public.recurring_schedules%rowtype;
  v_start timestamptz;
  v_end timestamptz;
begin
  select * into v_activity from public.team_activities where id = new.activity_id;
  if not found or v_activity.activity_type <> 'training_session' or v_activity.removed_at is not null then
    return new;
  end if;

  if new.status <> 'present' then
    -- Rule 3: only rows the user never touched (trigger creates them with created_by = updated_by).
    delete from public.time_entries
      where attendance_id = new.id
        and source = 'attendance'
        and updated_by_profile_id = created_by_profile_id;
    return new;
  end if;

  -- Idempotent: one auto entry per attendance row.
  if exists (select 1 from public.time_entries where attendance_id = new.id) then
    return new;
  end if;

  -- recurring_schedules.day_of_week follows JS getDay(): 0 = Sunday … 6 = Saturday.
  select * into v_schedule
    from public.recurring_schedules
    where team_id = v_activity.team_id
      and schedule_type = 'training_session'
      and removed_at is null
      and day_of_week = extract(dow from v_activity.occurred_at)
      and valid_from <= v_activity.occurred_at
      and (valid_until is null or valid_until >= v_activity.occurred_at)
    order by start_time
    limit 1;
  if not found then
    return new; -- Rule 4
  end if;

  v_start := (v_activity.occurred_at + v_schedule.start_time) at time zone 'Europe/Prague';
  -- TODO(TS module, issue #60): once team_activity_attendees.hours exists,
  -- use start_time + make_interval(hours => new.hours) instead of end_time.
  v_end := (v_activity.occurred_at + v_schedule.end_time) at time zone 'Europe/Prague';

  begin
    insert into public.time_entries (
      profile_id, direction, title, started_at, ended_at, duration_ms, source, attendance_id,
      created_by_profile_id, updated_by_profile_id
    ) values (
      new.profile_id, 'training', 'Training Session', v_start, v_end,
      (extract(epoch from (v_end - v_start)) * 1000)::bigint, 'attendance', new.id,
      new.profile_id, new.profile_id
    );
  exception when exclusion_violation then
    null; -- Rule 1: the tracked entry wins.
  end;

  return new;
end;
$$;

drop trigger if exists team_activity_attendees_sync_time_entry on public.team_activity_attendees;
create trigger team_activity_attendees_sync_time_entry
  after insert or update of status on public.team_activity_attendees
  for each row execute function public.sync_training_session_time_entry();
