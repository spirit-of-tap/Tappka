-- Migration: Set verified work email when email change succeeds
-- Purpose: Automatically sets verified_work_email and verified_work_email_at in public.users when auth.users.email is successfully changed to a CZU domain
-- Affected tables: users, auth.users
-- Special considerations: Runs automatically after email change is committed, only for CZU domains (@pef.czu.cz or @studenti.czu.cz)

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Create trigger function to set verified work email when email change succeeds
-- Updates public.users.verified_work_email and verified_work_email_at when auth.users.email changes to a CZU domain
-- Watches both email and email_change fields to catch all verification scenarios
-- Runs with SECURITY DEFINER to access auth.users table
create or replace function public.set_verified_work_email_on_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_email text;
  v_domain text;
begin
  -- Determine which email to use: prefer new.email, fall back to email_change if email didn't change
  -- When email_change is verified, Supabase typically:
  -- 1. Sets email_change to the new email (temporary)
  -- 2. Verifies OTP
  -- 3. Moves email_change to email and clears email_change
  -- So we need to check both fields
  
  -- Check if email changed
  if old.email is distinct from new.email then
    v_email := new.email;
  -- Check if email_change was cleared (moved to email)
  elsif old.email_change is distinct from new.email_change and (new.email_change is null or new.email_change = '') then
    -- email_change was cleared, use the current email
    v_email := new.email;
  else
    -- No relevant change
    return new;
  end if;
  
  -- Only proceed if email is not null and not empty
  if v_email is null or v_email = '' then
    return new;
  end if;
  
  -- Extract domain from email
  v_domain := lower(split_part(v_email, '@', 2));
  
  -- Only update verified_work_email if domain is a CZU domain
  if v_domain not in ('pef.czu.cz', 'studenti.czu.cz') then
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
  
  -- Update verified_work_email and verified_work_email_at
  -- This happens after OTP verification succeeds, so the email is verified
  -- Only update if the email is different from what's already stored (or not set)
  update public.users
  set verified_work_email = v_email,
      verified_work_email_at = now()
  where id = v_user_id
    and (verified_work_email is null or verified_work_email != v_email);
  
  return new;
end;
$$;

comment on function public.set_verified_work_email_on_change() is 'Trigger function that automatically sets verified_work_email and verified_work_email_at in public.users when auth.users.email is successfully changed to a CZU domain (@pef.czu.cz or @studenti.czu.cz). Watches both email and email_change fields to catch all verification scenarios. Runs after OTP verification succeeds.';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Create trigger on auth.users table to set verified work email when email changes
-- Runs AFTER UPDATE to ensure email change is committed
-- Watches both email and email_change fields to catch all verification scenarios
drop trigger if exists set_verified_work_email_on_change_trigger on auth.users;

create trigger set_verified_work_email_on_change_trigger
after update of email, email_change on auth.users
for each row
when (
  (old.email is distinct from new.email) or 
  (old.email_change is distinct from new.email_change)
)
execute function public.set_verified_work_email_on_change();

-- ============================================================================
-- INITIAL DATA UPDATE
-- ============================================================================

-- Update existing users who already have a CZU email set
-- This handles any existing data that should have verified_work_email set
update public.users u
set verified_work_email = au.email,
    verified_work_email_at = au.updated_at
from auth.users au
where u.auth_user_id = au.id
  and au.email is not null
  and au.email != ''
  and lower(split_part(au.email, '@', 2)) in ('pef.czu.cz', 'studenti.czu.cz')
  and (u.verified_work_email is null or u.verified_work_email != au.email);
