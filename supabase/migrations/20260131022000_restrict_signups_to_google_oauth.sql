-- Migration: Restrict signups to Google OAuth only
-- Purpose: Blocks email/password signups and OTP signups, only allows Google OAuth
-- This ensures all new accounts must be created via Google OAuth

-- Create before_user_created hook in public schema to only allow Google OAuth signups
-- Blocks email/password signups and other OAuth providers
-- Uses public schema instead of auth schema
create or replace function public.before_user_created_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text;
  v_encrypted_password text;
  v_app_metadata jsonb;
  v_identity jsonb;
  v_has_google_identity boolean := false;
begin
  -- Extract encrypted_password first (most reliable indicator of password signup)
  v_encrypted_password := event->'user'->>'encrypted_password';
  
  -- Block password-based signups immediately (they have encrypted_password)
  if v_encrypted_password is not null then
    raise exception 'Password-based signups are not allowed. Please use Google OAuth to sign in.';
  end if;
  
  -- Extract provider from multiple possible locations
  -- 1. raw_user_meta_data->>'provider'
  v_provider := event->'user'->'raw_user_meta_data'->>'provider';
  
  -- 2. app_metadata->>'provider'
  v_app_metadata := event->'user'->'app_metadata';
  if v_provider is null and v_app_metadata is not null then
    v_provider := v_app_metadata->>'provider';
  end if;
  
  -- 3. Check identities array for Google provider (most reliable for OAuth)
  if event->'user'->'identities' is not null then
    for v_identity in 
      select value from jsonb_array_elements(event->'user'->'identities')
    loop
      if v_identity->>'provider' = 'google' then
        v_has_google_identity := true;
        exit;
      end if;
    end loop;
  end if;
  
  -- Allow Google OAuth signups (check both provider variable and identities array)
  if v_provider = 'google' or v_has_google_identity then
    return event;
  end if;
  
  -- If we reach here, it's not a Google OAuth signup and not a password signup
  -- This must be an OTP or other email-based signup attempt
  raise exception 'Only Google OAuth signups are allowed. Please use Google to sign in.';
end;
$$;

-- Grant execute permission (needed for hook execution)
grant execute on function public.before_user_created_hook(jsonb) to authenticated;
grant execute on function public.before_user_created_hook(jsonb) to anon;

-- Note: Also update supabase/config.toml:
-- [auth.email]
-- enable_signup = false
--
-- [auth.hook.before_user_created]
-- enabled = true
-- uri = "pg-functions://postgres/public/before_user_created_hook"
