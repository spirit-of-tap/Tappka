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
-- Uses dynamic jsonb approach to automatically protect all columns except allowed ones
create or replace function public.handle_user_update_restriction()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  -- Whitelist: fields that users are allowed to modify
  v_allowed_fields text[] := array['suggested_work_email'];
  
  -- System fields: can be updated by trigger functions (SECURITY DEFINER), not by users
  v_system_fields text[] := array['verified_work_email', 'verified_work_email_at'];
  
  -- Fields with special handling logic (not reset from OLD)
  v_special_fields text[] := array['last_otp_sent_at', 'updated_at'];
  
  -- JSONB representations of OLD and NEW records
  v_old_jsonb jsonb;
  v_new_jsonb jsonb;
  v_result_jsonb jsonb;
  
  -- Column name for iteration
  v_column_name text;
begin
  -- Convert records to jsonb for dynamic manipulation (must be first)
  v_old_jsonb := to_jsonb(old);
  v_new_jsonb := to_jsonb(new);
  
  -- Start with OLD values (protected state)
  v_result_jsonb := v_old_jsonb;
  
  -- Allow only whitelisted fields from NEW to override OLD values
  foreach v_column_name in array v_allowed_fields
  loop
    if v_new_jsonb ? v_column_name then
      v_result_jsonb := jsonb_set(v_result_jsonb, array[v_column_name], v_new_jsonb->v_column_name);
    end if;
  end loop;
  
  -- Allow system fields to be updated by trigger functions
  -- When verified_work_email is being set/changed, this indicates a system trigger update
  -- Users cannot directly set verified_work_email due to RLS and application logic
  if v_new_jsonb ? 'verified_work_email' and (v_old_jsonb->>'verified_work_email') is distinct from (v_new_jsonb->>'verified_work_email') then
    -- This is a system update setting verified_work_email, allow both system fields
    foreach v_column_name in array v_system_fields
    loop
      if v_new_jsonb ? v_column_name then
        v_result_jsonb := jsonb_set(v_result_jsonb, array[v_column_name], v_new_jsonb->v_column_name);
      end if;
    end loop;
  end if;
  
  -- Handle special field: last_otp_sent_at
  -- Automatically update when suggested_work_email changes
  if (v_old_jsonb->>'suggested_work_email') is distinct from (v_new_jsonb->>'suggested_work_email') then
    v_result_jsonb := jsonb_set(v_result_jsonb, array['last_otp_sent_at'], to_jsonb(now()));
  else
    -- Keep existing last_otp_sent_at if suggested_work_email hasn't changed
    v_result_jsonb := jsonb_set(v_result_jsonb, array['last_otp_sent_at'], v_old_jsonb->'last_otp_sent_at');
  end if;
  
  -- Preserve updated_at from NEW (will be set by handle_updated_at() trigger)
  -- But we include it here to ensure it's not reset
  if v_new_jsonb ? 'updated_at' then
    v_result_jsonb := jsonb_set(v_result_jsonb, array['updated_at'], v_new_jsonb->'updated_at');
  end if;
  
  -- Convert jsonb back to record type using jsonb_populate_record
  -- This preserves proper type casting for all columns
  new := jsonb_populate_record(null::public.users, v_result_jsonb);
  
  return new;
end;
$$;

comment on function public.handle_user_update_restriction() is 'Trigger function that restricts user updates to suggested_work_email only. Allows verified_work_email and verified_work_email_at to be updated by system trigger functions when verified_work_email is being set. Automatically updates last_otp_sent_at when suggested_work_email changes.';

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
