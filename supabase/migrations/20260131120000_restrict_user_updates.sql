-- Migration: Restrict user updates to suggested_work_email only
-- Purpose: Allows users to only update suggested_work_email field, automatically updates last_otp_sent_at
-- Affected tables: users
-- Special considerations: Prevents users from modifying any other fields in the users table

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Create trigger function to restrict updates to suggested_work_email only
-- Automatically updates last_otp_sent_at when suggested_work_email changes
-- Prevents users from modifying any other fields in the users table
create or replace function public.handle_user_update_restriction()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Allow only suggested_work_email to be changed
  -- Reset all other fields to their original values to prevent modification
  new.id := old.id;
  new.auth_user_id := old.auth_user_id;
  new.google_email := old.google_email;
  new.google_profile_picture := old.google_profile_picture;
  new.google_full_name := old.google_full_name;
  new.created_at := old.created_at;
  
  -- Automatically update last_otp_sent_at when suggested_work_email changes
  if old.suggested_work_email is distinct from new.suggested_work_email then
    new.last_otp_sent_at := now();
  else
    -- Keep existing last_otp_sent_at if suggested_work_email hasn't changed
    new.last_otp_sent_at := old.last_otp_sent_at;
  end if;
  
  -- updated_at is handled by the existing handle_updated_at() trigger
  -- so we don't need to set it here
  
  return new;
end;
$$;

comment on function public.handle_user_update_restriction() is 'Trigger function that restricts user updates to suggested_work_email only. Automatically updates last_otp_sent_at when suggested_work_email changes. Prevents modification of all other fields including google_email, google_profile_picture, google_full_name, auth_user_id, id, and created_at.';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Create trigger to enforce update restrictions on users table
-- This trigger runs BEFORE the update to prevent field modifications
drop trigger if exists users_update_restriction_trigger on public.users;

create trigger users_update_restriction_trigger
before update on public.users
for each row
execute function public.handle_user_update_restriction();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Drop the existing permissive update policy
drop policy if exists "Users can update their own user record" on public.users;

-- Create a new restrictive update policy that only allows updating suggested_work_email
-- The trigger function will enforce that only suggested_work_email can be changed
create policy "Users can update only suggested_work_email" on public.users
for update
to authenticated
using ( (select auth.uid()) = auth_user_id )
with check ( (select auth.uid()) = auth_user_id );

comment on policy "Users can update only suggested_work_email" on public.users is 'RLS policy that allows authenticated users to update only their own user record. The handle_user_update_restriction() trigger enforces that only suggested_work_email can be modified, and automatically updates last_otp_sent_at.';

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant execute permissions for the new trigger function
grant execute on function public.handle_user_update_restriction() to authenticated;
grant execute on function public.handle_user_update_restriction() to anon;
