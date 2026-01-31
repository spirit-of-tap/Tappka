-- Migration: Create trigger function to populate public.users on auth.users creation
-- Purpose: Automatically creates a row in public.users table when a new user is created in auth.users
-- This ensures that every authenticated user has a corresponding record in public.users with their Google OAuth data
-- Affected tables: public.users
-- Special considerations: Uses SECURITY DEFINER to access auth.users table, extracts Google OAuth metadata

-- Create trigger function to populate public.users table when auth.users is created
-- Extracts Google OAuth data from auth.users.raw_user_meta_data and auth.users.email
-- Uses SECURITY DEFINER to allow access to auth.users table
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_google_email text;
  v_google_full_name text;
  v_google_profile_picture text;
  v_raw_meta_data jsonb;
begin
  -- Extract raw_user_meta_data (contains Google OAuth profile information)
  v_raw_meta_data := new.raw_user_meta_data;
  
  -- Extract email from auth.users.email (primary email field)
  -- Fallback to raw_user_meta_data->>'email' if needed
  v_google_email := coalesce(new.email, v_raw_meta_data->>'email');
  
  -- Extract Google OAuth profile data from raw_user_meta_data
  -- Google OAuth typically provides: full_name, avatar_url (or picture), email
  v_google_full_name := v_raw_meta_data->>'full_name';
  v_google_profile_picture := coalesce(
    v_raw_meta_data->>'avatar_url',
    v_raw_meta_data->>'picture'
  );
  
  -- Insert new row into public.users table with extracted data
  -- auth_user_id links to auth.users.id for authentication checks
  insert into public.users (
    auth_user_id,
    google_email,
    google_full_name,
    google_profile_picture
  )
  values (
    new.id,
    v_google_email,
    v_google_full_name,
    v_google_profile_picture
  );
  
  return new;
end;
$$;

comment on function public.handle_new_auth_user() is 'Trigger function that automatically creates a row in public.users table when a new user is created in auth.users. Extracts Google OAuth profile data (email, full_name, profile_picture) from auth.users.raw_user_meta_data and populates the public.users table. Uses SECURITY DEFINER to access auth.users table.';

-- Create trigger on auth.users table
-- Fires AFTER INSERT to ensure the auth.users row is fully created before populating public.users
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

comment on trigger on_auth_user_created on auth.users is 'Trigger that automatically populates public.users table when a new user is created in auth.users via Google OAuth signup.';
