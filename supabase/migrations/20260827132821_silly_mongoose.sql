CREATE TYPE "public"."beta_cohort" AS ENUM('A', 'B');--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "beta_cohort" "beta_cohort" DEFAULT 'A' NOT NULL;--> statement-breakpoint
create or replace function public.validate_picture_only_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_db_role text := current_setting('role', true);
  v_jwt_role text := current_setting('request.jwt.claim.role', true);
  v_name_filled_from_empty boolean;
  v_picture_filled_from_empty boolean;
begin
  -- bypass restriction for trusted database/system sessions
  if
    session_user in ('postgres', 'supabase_admin', 'supabase_auth_admin')
    or current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin')
    or v_db_role in ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin')
    or v_jwt_role = 'service_role'
  then
    return new;
  end if;

  v_name_filled_from_empty :=
    old.name is distinct from new.name
    and nullif(btrim(old.name), '') is null
    and nullif(btrim(new.name), '') is not null;

  v_picture_filled_from_empty :=
    old.picture is distinct from new.picture
    and (old.picture is null or nullif(btrim(old.picture), '') is null)
    and nullif(btrim(coalesce(new.picture, '')), '') is not null;

  -- allow user_id-only changes from trusted DB workflows (profile linking),
  -- including Google defaults filling previously empty name / picture
  if old.user_id is distinct from new.user_id then
    if (
      old.id is not distinct from new.id
      and (old.name is not distinct from new.name or v_name_filled_from_empty)
      and (old.picture is not distinct from new.picture or v_picture_filled_from_empty)
      and old.work_email is not distinct from new.work_email
      and old.role is not distinct from new.role
      and old.team_id is not distinct from new.team_id
      and old.phone_number is not distinct from new.phone_number
      and old.personal_email is not distinct from new.personal_email
      and old.date_of_birth is not distinct from new.date_of_birth
      and old.beta_access_granted_at is not distinct from new.beta_access_granted_at
      and old.access_removed_at is not distinct from new.access_removed_at
      and old.access_removed_by_profile_id is not distinct from new.access_removed_by_profile_id
      and old.created_by_profile_id is not distinct from new.created_by_profile_id
      and old.updated_by_profile_id is not distinct from new.updated_by_profile_id
      and old.created_at is not distinct from new.created_at
      and old.beta_cohort is not distinct from new.beta_cohort
    ) then
      return new;
    end if;
  end if;

  -- regular users may only change picture and beta_access_granted_at
  if (
    old.id is distinct from new.id
    or old.name is distinct from new.name
    or old.user_id is distinct from new.user_id
    or old.work_email is distinct from new.work_email
    or old.role is distinct from new.role
    or old.team_id is distinct from new.team_id
    or old.phone_number is distinct from new.phone_number
    or old.personal_email is distinct from new.personal_email
    or old.date_of_birth is distinct from new.date_of_birth
    or old.access_removed_at is distinct from new.access_removed_at
    or old.access_removed_by_profile_id is distinct from new.access_removed_by_profile_id
    or old.created_by_profile_id is distinct from new.created_by_profile_id
    or old.updated_by_profile_id is distinct from new.updated_by_profile_id
    or old.created_at is distinct from new.created_at
    or old.beta_cohort is distinct from new.beta_cohort
  ) then
    raise exception 'Only picture and beta_access_granted_at can be updated by users';
  end if;

  return new;
end;
$$;