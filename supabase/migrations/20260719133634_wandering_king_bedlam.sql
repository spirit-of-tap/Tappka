-- When a profile is linked to a user, fill empty name / picture from Google
-- OAuth metadata on auth.users (full_name / name, avatar_url / picture).
-- Does not overwrite non-empty profile fields.

-- ---------------------------------------------------------------------------
-- apply_google_profile_defaults
-- ---------------------------------------------------------------------------

create or replace function public.apply_google_profile_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb;
  v_google_name text;
  v_google_picture text;
  v_name_empty boolean;
  v_picture_empty boolean;
begin
  if new.user_id is null then
    return new;
  end if;

  v_name_empty := nullif(btrim(new.name), '') is null;
  v_picture_empty := new.picture is null or nullif(btrim(new.picture), '') is null;

  if not v_name_empty and not v_picture_empty then
    return new;
  end if;

  select au.raw_user_meta_data
  into v_meta
  from public.users u
  join auth.users au on au.id = u.auth_user_id
  where u.id = new.user_id;

  if v_meta is null then
    return new;
  end if;

  v_google_name := nullif(btrim(coalesce(v_meta->>'full_name', v_meta->>'name')), '');
  v_google_picture := nullif(
    btrim(coalesce(v_meta->>'avatar_url', v_meta->>'picture')),
    ''
  );

  if v_name_empty and v_google_name is not null then
    new.name := v_google_name;
  end if;

  if v_picture_empty and v_google_picture is not null then
    new.picture := v_google_picture;
  end if;

  return new;
end;
$$;

comment on function public.apply_google_profile_defaults() is
  'BEFORE INSERT/UPDATE trigger: when profiles.user_id is set, copy Google full_name/avatar_url from auth.users into empty profiles.name / profiles.picture. SECURITY DEFINER required to read auth.users.';

drop trigger if exists profiles_apply_google_defaults_trigger on public.profiles;

create trigger profiles_apply_google_defaults_trigger
before insert or update of user_id on public.profiles
for each row
execute function public.apply_google_profile_defaults();

-- ---------------------------------------------------------------------------
-- validate_picture_only_update: allow empty→filled name/picture during link
-- ---------------------------------------------------------------------------

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
  ) then
    raise exception 'Only picture and beta_access_granted_at can be updated by users';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill already-linked profiles with empty name / picture
-- ---------------------------------------------------------------------------

update public.profiles p
set
  name = case
    when nullif(btrim(p.name), '') is null then
      coalesce(
        nullif(btrim(coalesce(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name')), ''),
        p.name
      )
    else p.name
  end,
  picture = case
    when p.picture is null or nullif(btrim(p.picture), '') is null then
      coalesce(
        nullif(btrim(coalesce(au.raw_user_meta_data->>'avatar_url', au.raw_user_meta_data->>'picture')), ''),
        p.picture
      )
    else p.picture
  end
from public.users u
join auth.users au on au.id = u.auth_user_id
where p.user_id = u.id
  and (
    nullif(btrim(p.name), '') is null
    or p.picture is null
    or nullif(btrim(p.picture), '') is null
  );
