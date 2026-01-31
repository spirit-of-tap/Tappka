-- Migration: Link users to profiles based on email matching
-- Purpose: Automatically links profile rows to user rows when auth.users.email matches profiles.work_email
-- Affected tables: profiles, users, auth.users
-- Special considerations: Runs automatically when user email changes in auth.users table

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Create trigger function to link profiles to users based on email matching
-- Matches auth.users.email with profiles.work_email and links via public.users
-- Runs with SECURITY DEFINER to access auth.users table
create or replace function public.link_user_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_auth_email text;
begin
  -- Get the email from auth.users (use NEW.email after update)
  v_auth_email := new.email;
  
  -- Only proceed if email is not null and has changed
  if v_auth_email is null or v_auth_email = '' then
    return new;
  end if;
  
  -- Find the public.users row that matches this auth.users.id
  select id into v_user_id
  from public.users
  where auth_user_id = new.id;
  
  -- If no matching public.users row found, return early
  if v_user_id is null then
    return new;
  end if;
  
  -- Link profile to user if work_email matches auth.users.email
  -- Only update if profile exists and is not already linked to a different user
  update public.profiles
  set user_id = v_user_id
  where work_email = lower(trim(v_auth_email))
    and (user_id is null or user_id = v_user_id);
  
  return new;
end;
$$;

comment on function public.link_user_to_profile() is 'Trigger function that automatically links profile rows to user rows when auth.users.email matches profiles.work_email. Matches based on currently logged in user email (auth.users.email), uid in user table row (public.users.auth_user_id), and work_email in profile table row (public.profiles.work_email).';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Create trigger on auth.users table to link profiles when email changes
-- Runs AFTER UPDATE to ensure email change is committed
drop trigger if exists link_user_to_profile_trigger on auth.users;

create trigger link_user_to_profile_trigger
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function public.link_user_to_profile();

comment on trigger link_user_to_profile_trigger on auth.users is 'Trigger that automatically links profiles to users when auth.users.email changes. Runs after email update to ensure the change is committed before linking.';

-- ============================================================================
-- INITIAL DATA LINKING
-- ============================================================================

-- Link existing profiles to users based on current email matches
-- This handles any existing data that needs to be linked
update public.profiles p
set user_id = u.id
from public.users u
inner join auth.users au on u.auth_user_id = au.id
where p.work_email = lower(trim(au.email))
  and (p.user_id is null or p.user_id = u.id);

comment on table public.profiles is 'User profile data with role and team membership. Pre-created by admin, linked to user after OTP verification. Automatically linked when auth.users.email matches profiles.work_email.';

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant execute permissions for the trigger function
grant execute on function public.link_user_to_profile() to authenticated;
grant execute on function public.link_user_to_profile() to anon;
