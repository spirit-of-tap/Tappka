-- Custom SQL migration file, put your code below! --

-- Migration: updated_at triggers for Rocket Model mutable tables.
-- Every other mutable table gets a handle_updated_at() BEFORE UPDATE trigger
-- (see users/teams/profiles in 20260131000000_initial_schema.sql,
-- team_reflections in 20260730150625_team_reflection_updated_at_triggers.sql,
-- team_activities in 20260818075419_wealthy_bloodscream.sql). The append-only
-- history tables (rocket_individual_history, rocket_team_history) are
-- intentionally excluded — rows there are never updated.

drop trigger if exists rocket_categories_updated_at_trigger on public.rocket_categories;
create trigger rocket_categories_updated_at_trigger
before update on public.rocket_categories
for each row
execute function public.handle_updated_at();

drop trigger if exists rocket_items_updated_at_trigger on public.rocket_items;
create trigger rocket_items_updated_at_trigger
before update on public.rocket_items
for each row
execute function public.handle_updated_at();

drop trigger if exists rocket_individual_states_updated_at_trigger on public.rocket_individual_states;
create trigger rocket_individual_states_updated_at_trigger
before update on public.rocket_individual_states
for each row
execute function public.handle_updated_at();

drop trigger if exists rocket_team_checks_updated_at_trigger on public.rocket_team_checks;
create trigger rocket_team_checks_updated_at_trigger
before update on public.rocket_team_checks
for each row
execute function public.handle_updated_at();

-- Enforcement: a team check can only be marked complete when every active
-- team member has checked the item individually. The UI disables the team
-- checkbox until coverage is N/N, but only this trigger makes it hold
-- against direct writes. Unchecking (is_checked = false) always passes.
create or replace function public.check_rocket_team_unanimity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_count int;
  v_missing_count int;
begin
  if not coalesce(NEW.is_checked, false) then
    return NEW;
  end if;

  select count(*) into v_member_count
  from public.profiles
  where team_id = NEW.team_id
    and access_removed_at is null;

  if v_member_count = 0 then
    raise exception 'Team check requires at least one active team member' using errcode = '42501';
  end if;

  select count(*) into v_missing_count
  from public.profiles p
  where p.team_id = NEW.team_id
    and p.access_removed_at is null
    and not exists (
      select 1 from public.rocket_individual_states s
      where s.item_id = NEW.item_id
        and s.profile_id = p.id
        and s.is_checked = true
    );

  if v_missing_count > 0 then
    raise exception 'Team check requires every member to check the item individually (% missing)' , v_missing_count using errcode = '42501';
  end if;

  return NEW;
end;
$$;

drop trigger if exists rocket_team_checks_unanimity_trigger on public.rocket_team_checks;
create trigger rocket_team_checks_unanimity_trigger
before insert or update of is_checked on public.rocket_team_checks
for each row
execute function public.check_rocket_team_unanimity();
