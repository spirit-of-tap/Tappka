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
begin
  -- Extract provider from event
  -- For OAuth signups, provider is in raw_user_meta_data
  -- For email/password signups, there's an encrypted_password field
  v_provider := event->'user'->'raw_user_meta_data'->>'provider';
  v_encrypted_password := event->'user'->>'encrypted_password';
  
  -- Allow Google OAuth signups
  if v_provider = 'google' then
    return event;
  end if;
  
  -- Block password-based signups (they have encrypted_password)
  if v_encrypted_password is not null then
    raise exception 'Password-based signups are not allowed. Please use Google OAuth to sign in.';
  end if;
  
  -- Block OTP-based email signups (no encrypted_password, but also no Google provider)
  -- Check if this is an email signup attempt
  if v_provider is null or v_provider != 'google' then
    raise exception 'Only Google OAuth signups are allowed. Please use Google to sign in.';
  end if;
  
  -- Default: reject (should not reach here)
  raise exception 'Signups are restricted to Google OAuth only.';
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
