-- Fix type/nullability drift left by rename-without-cast in the prior migration.
-- Idempotent: no-ops when opposite_swordsman already applied the casts (e.g. db reset).

do $fix_published_at$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'essays'
      and column_name = 'published_at'
      and udt_name = 'bool'
  ) then
    alter table public.essays
      alter column published_at drop default;

    alter table public.essays
      alter column published_at drop not null;

    alter table public.essays
      alter column published_at type timestamp with time zone
      using (
        case
          when published_at then created_at
          else null
        end
      );
  end if;
end
$fix_published_at$;

do $fix_beta_access$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'beta_access_granted_at'
      and udt_name = 'bool'
  ) then
    alter table public.profiles
      alter column beta_access_granted_at drop default;

    alter table public.profiles
      alter column beta_access_granted_at drop not null;

    alter table public.profiles
      alter column beta_access_granted_at type timestamp with time zone
      using (
        case
          when beta_access_granted_at then created_at
          else null
        end
      );
  end if;
end
$fix_beta_access$;

do $fix_recurring_created_by$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'recurring_schedules'
      and column_name = 'created_by_profile_id'
      and is_nullable = 'YES'
  ) then
    alter table public.recurring_schedules
      alter column created_by_profile_id set not null;
  end if;
end
$fix_recurring_created_by$;

do $fix_breaks_created_by$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'schedule_breaks'
      and column_name = 'created_by_profile_id'
      and is_nullable = 'YES'
  ) then
    alter table public.schedule_breaks
      alter column created_by_profile_id set not null;
  end if;
end
$fix_breaks_created_by$;
