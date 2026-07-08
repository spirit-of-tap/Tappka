-- Migration: Add rektorat domain to auth email validation and verification
-- Purpose: Extend auth email validation, profile sync, and verified email updates to support @rektorat.czu.cz
-- Affected tables: public.profiles, public.users, auth.users
-- Special considerations: Replaces trigger functions already attached to auth.users

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

-- Expand the profile work email domain check to include rektorat.czu.cz
alter table public.profiles
drop constraint if exists valid_czu_domain;

alter table public.profiles
add constraint valid_czu_domain check (
  lower(split_part(work_email, '@', 2)) in ('pef.czu.cz', 'studenti.czu.cz', 'rektorat.czu.cz')
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Validate auth email updates, keep linked profile email in sync, and enforce approved domains.
create or replace function public.validate_czu_email_domain_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_email_change text;
  v_domain text;
  v_user_id uuid;
  v_has_linked_profile boolean;
begin
  if tg_op != 'UPDATE' then
    return new;
  end if;

  -- Find the public.users row linked to this auth.users row.
  select public.users.id
  into v_user_id
  from public.users
  where public.users.auth_user_id = new.id;

  -- If the user has a linked profile, sync profile work_email on direct email changes.
  if v_user_id is not null then
    select exists (
      select 1
      from public.profiles
      where public.profiles.user_id = v_user_id
    )
    into v_has_linked_profile;

    if v_has_linked_profile and old.email is distinct from new.email then
      if new.email is not null then
        if lower(split_part(new.email, '@', 2)) not in ('pef.czu.cz', 'studenti.czu.cz', 'rektorat.czu.cz') then
          raise exception 'New email must belong to an approved domain';
        end if;
      end if;

      update public.profiles
      set work_email = new.email
      where public.profiles.user_id = v_user_id;
    end if;
  end if;

  -- Validate pending email_change value.
  if old.email_change is distinct from new.email_change then
    v_email_change := new.email_change;

    if v_email_change is not null and v_email_change != '' then
      v_domain := lower(split_part(v_email_change, '@', 2));

      if v_domain not in ('pef.czu.cz', 'studenti.czu.cz', 'rektorat.czu.cz') then
        raise exception 'Email must end with @pef.czu.cz, @rektorat.czu.cz or @studenti.czu.cz. Provided domain: %', v_domain;
      end if;
    end if;
  end if;

  -- Validate current auth.users.email value.
  if old.email is distinct from new.email then
    v_email := new.email;

    if v_email is not null and v_email != '' then
      v_domain := lower(split_part(v_email, '@', 2));

      if v_domain not in ('pef.czu.cz', 'studenti.czu.cz', 'rektorat.czu.cz') then
        raise exception 'Email must end with @pef.czu.cz, @rektorat.czu.cz or @studenti.czu.cz. Provided domain: %', v_domain;
      end if;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.validate_czu_email_domain_trigger() is 'Validates auth.users email domains, syncs linked profile work_email on direct email updates, and enforces allowed CZU domains (@pef.czu.cz, @studenti.czu.cz, @rektorat.czu.cz).';

-- Set verified_work_email after successful email verification for allowed CZU domains.
create or replace function public.set_verified_work_email_on_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_email text;
  v_domain text;
begin
  -- Determine which email should be treated as verified after this update.
  if old.email is distinct from new.email then
    v_email := new.email;
  elsif old.email_change is distinct from new.email_change and (new.email_change is null or new.email_change = '') then
    v_email := new.email;
  else
    return new;
  end if;

  if v_email is null or v_email = '' then
    return new;
  end if;

  v_domain := lower(split_part(v_email, '@', 2));

  if v_domain not in ('pef.czu.cz', 'studenti.czu.cz', 'rektorat.czu.cz') then
    return new;
  end if;

  select public.users.id
  into v_user_id
  from public.users
  where public.users.auth_user_id = new.id;

  if v_user_id is null then
    return new;
  end if;

  update public.users
  set verified_work_email = v_email,
      verified_work_email_at = now()
  where public.users.id = v_user_id
    and (public.users.verified_work_email is null or public.users.verified_work_email != v_email);

  return new;
end;
$$;

comment on function public.set_verified_work_email_on_change() is 'Sets public.users.verified_work_email after successful auth email verification for allowed CZU domains (@pef.czu.cz, @studenti.czu.cz, @rektorat.czu.cz).';

-- Backfill verified_work_email for existing users with allowed domains.
update public.users as u
set verified_work_email = au.email,
    verified_work_email_at = au.updated_at
from auth.users as au
where u.auth_user_id = au.id
  and au.email is not null
  and au.email != ''
  and lower(split_part(au.email, '@', 2)) in ('pef.czu.cz', 'studenti.czu.cz', 'rektorat.czu.cz')
  and (u.verified_work_email is null or u.verified_work_email != au.email);
