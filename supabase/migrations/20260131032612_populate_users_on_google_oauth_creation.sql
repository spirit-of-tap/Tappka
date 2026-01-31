-- Migration: Populate public.users table on Google OAuth user creation
-- Purpose: Automatically creates a record in public.users when a Google OAuth user is created in auth.users
-- Extracts Google email, full name, and profile picture from auth.users metadata
-- Affected tables: auth.users (trigger), public.users (inserts)
-- Special considerations: Uses SECURITY DEFINER to access auth.users table

-- Create trigger function to populate public.users table when Google OAuth user is created
-- This function extracts Google metadata from auth.users and creates corresponding public.users record
create or replace function public.handle_new_google_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_google_email text;
  v_google_full_name text;
  v_google_profile_picture text;
  v_is_google_user boolean := false;
  v_identity jsonb;
begin
  -- Check if this is a Google OAuth user by examining identities
  -- Google OAuth users will have an identity with provider = 'google'
  if new.identities is not null then
    for v_identity in 
      select value from jsonb_array_elements(new.identities)
    loop
      if v_identity->>'provider' = 'google' then
        v_is_google_user := true;
        exit;
      end if;
    end loop;
  end if;

  -- Only proceed if this is a Google OAuth user
  if not v_is_google_user then
    return new;
  end if;

  -- Extract Google email (primary email from auth.users)
  v_google_email := new.email;

  -- Extract Google full name from raw_user_meta_data
  -- Try multiple possible keys: full_name, name
  v_google_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name'
  );

  -- Extract Google profile picture from raw_user_meta_data
  -- Try multiple possible keys: avatar_url, picture
  v_google_profile_picture := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture'
  );

  -- Insert into public.users table with all extracted Google data
  -- Use ON CONFLICT to handle race conditions (if record already exists, update it)
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
  )
  on conflict (auth_user_id) do update
  set
    google_email = excluded.google_email,
    google_full_name = excluded.google_full_name,
    google_profile_picture = excluded.google_profile_picture,
    updated_at = now();

  return new;
end;
$$;

comment on function public.handle_new_google_user() is 'Trigger function that automatically populates public.users table when a Google OAuth user is created in auth.users. Extracts Google email, full name, and profile picture from user metadata.';

-- Create trigger on auth.users table to fire after insert
-- This ensures public.users is populated immediately when Google OAuth user signs up
create trigger on_auth_user_created_populate_users
after insert on auth.users
for each row
execute function public.handle_new_google_user();

-- Grant execute permission (required for trigger execution)
grant execute on function public.handle_new_google_user() to authenticated;
grant execute on function public.handle_new_google_user() to anon;
