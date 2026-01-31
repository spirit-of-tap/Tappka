-- Migration: Prevent email changes when user has linked profile
-- Purpose: Blocks email changes in auth.users when the user is already linked to a profile
-- Affected tables: auth.users, profiles, users
-- Special considerations: Uses SECURITY DEFINER to access auth.users and profiles tables

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Enhance the email validation trigger to also check if user has a linked profile
-- Prevents email changes once a user is linked to a profile
-- This ensures the email-to-profile link remains stable after initial linking
create or replace function public.validate_czu_email_domain_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_email_change text;
  v_domain text;
  v_user_id uuid;
  v_has_linked_profile boolean;
begin
  if tg_op != 'UPDATE' then
    return NEW;
  end if;

  -- Check if user has a linked profile before allowing email changes
  -- Find the public.users row that matches this auth.users.id
  select id into v_user_id
  from public.users
  where auth_user_id = new.id;

  -- If user exists, check if they have a linked profile
  if v_user_id is not null then
    select exists (
      select 1
      from public.profiles
      where user_id = v_user_id
    ) into v_has_linked_profile;

    -- If user has a linked profile, prevent email changes
    if v_has_linked_profile then
      if OLD.email is distinct from NEW.email then
        raise exception 'Cannot change email address once linked to a profile. Your email is used to maintain your profile connection.';
      end if;
      
      if OLD.email_change is distinct from NEW.email_change then
        raise exception 'Cannot change email address once linked to a profile. Your email is used to maintain your profile connection.';
      end if;
    end if;
  end if;

  -- Continue with existing domain validation for email_change
  if OLD.email_change is distinct from NEW.email_change then
    v_email_change := NEW.email_change;
    
    if v_email_change is not null and v_email_change != '' then
      v_domain := lower(split_part(v_email_change, '@', 2));
      
      if v_domain not in ('pef.czu.cz', 'studenti.czu.cz') then
        raise exception 'Email must end with @pef.czu.cz or @studenti.czu.cz. Provided domain: %', v_domain;
      end if;
    end if;
  end if;

  -- Continue with existing domain validation for email
  if OLD.email is distinct from NEW.email then
    v_email := NEW.email;
    
    if v_email is not null and v_email != '' then
      v_domain := lower(split_part(v_email, '@', 2));
      
      if v_domain not in ('pef.czu.cz', 'studenti.czu.cz') then
        raise exception 'Email must end with @pef.czu.cz or @studenti.czu.cz. Provided domain: %', v_domain;
      end if;
    end if;
  end if;

  return NEW;
end;
$$;

comment on function public.validate_czu_email_domain_trigger() is 'Server-side trigger function that validates email domains and prevents email changes when user has a linked profile. Uses SECURITY DEFINER to access auth.users and profiles tables. Validates email changes (UPDATE) for all users and blocks changes once a profile is linked.';
