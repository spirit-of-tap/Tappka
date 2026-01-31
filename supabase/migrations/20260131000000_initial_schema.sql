-- Migration: Initial schema setup
-- Purpose: Creates complete database schema with tables, triggers, and restrictive RLS policies
-- Affected tables: users, profiles, teams
-- Special considerations: All RLS policies are restrictive - admin operations require service_role or application-level checks

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

create type public.profile_role as enum ('student', 'team_leader', 'coach', 'admin');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Create users table (custom table, separate from auth.users)
-- Stores Google OAuth user data and OTP tracking
-- Linked to auth.users via auth_user_id for authentication checks
create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  google_email text not null unique,
  suggested_work_email text,
  google_profile_picture text,
  google_full_name text,
  last_otp_sent_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

comment on table public.users is 'Custom users table storing Google OAuth user data and OTP tracking. Separate from auth.users but linked via auth_user_id for authentication.';

-- Create teams table
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  picture text,
  color text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

comment on table public.teams is 'Team information for organizing users into groups.';

-- Create profiles table (pre-created by admin, linked to user after verification)
-- References the new users table instead of auth.users
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  picture text,
  user_id uuid unique references public.users(id) on delete set null,
  work_email text unique not null,
  role public.profile_role not null default 'student',
  team_id uuid references public.teams(id) on delete set null,
  phone_number text,
  personal_email text,
  date_of_birth date,
  removed_access timestamptz,
  removed_access_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint valid_czu_domain check (
    work_email like '%@studenti.czu.cz' or work_email like '%@pef.czu.cz'
  )
);

comment on table public.profiles is 'User profile data with role and team membership. Pre-created by admin, linked to user after OTP verification.';

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Create trigger function to automatically update updated_at column
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.handle_updated_at() is 'Trigger function that automatically updates the updated_at column to the current timestamp on row updates.';

-- Create trigger function to populate public.users on auth.users creation
-- Extracts Google OAuth data from auth.users.raw_user_meta_data and auth.users.email
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_google_email text;
  v_google_full_name text;
  v_google_profile_picture text;
  v_raw_meta_data jsonb;
begin
  v_raw_meta_data := new.raw_user_meta_data;
  v_google_email := coalesce(new.email, v_raw_meta_data->>'email');
  v_google_full_name := v_raw_meta_data->>'full_name';
  v_google_profile_picture := coalesce(
    v_raw_meta_data->>'avatar_url',
    v_raw_meta_data->>'picture'
  );
  
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
  on conflict (auth_user_id) do update set
    google_email = coalesce(excluded.google_email, public.users.google_email),
    google_full_name = coalesce(excluded.google_full_name, public.users.google_full_name),
    google_profile_picture = coalesce(excluded.google_profile_picture, public.users.google_profile_picture);
  
  return new;
end;
$$;

comment on function public.handle_new_auth_user() is 'Trigger function that automatically creates a row in public.users table when a new user is created in auth.users. Extracts Google OAuth profile data from auth.users.raw_user_meta_data.';

-- Create validation trigger function for CZU email domain
-- Ensures that email addresses being changed must end with @pef.czu.cz or @studenti.czu.cz
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
begin
  if tg_op != 'UPDATE' then
    return NEW;
  end if;

  if OLD.email_change is distinct from NEW.email_change then
    v_email_change := NEW.email_change;
    
    if v_email_change is not null and v_email_change != '' then
      v_domain := lower(split_part(v_email_change, '@', 2));
      
      if v_domain not in ('pef.czu.cz', 'studenti.czu.cz') then
        raise exception 'Email must end with @pef.czu.cz or @studenti.czu.cz. Provided domain: %', v_domain;
      end if;
    end if;
  end if;

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

comment on function public.validate_czu_email_domain_trigger() is 'Server-side trigger function that validates email domains at the database level. Uses SECURITY DEFINER to access auth.users table. Validates email changes (UPDATE) for all users.';

-- Create before_user_created hook to restrict signups to Google OAuth only
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
  v_encrypted_password := event->'user'->>'encrypted_password';
  
  if v_encrypted_password is not null then
    raise exception 'Password-based signups are not allowed. Please use Google OAuth to sign in.';
  end if;
  
  v_provider := event->'user'->'raw_user_meta_data'->>'provider';
  v_app_metadata := event->'user'->'app_metadata';
  if v_provider is null and v_app_metadata is not null then
    v_provider := v_app_metadata->>'provider';
  end if;
  
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
  
  if v_provider = 'google' or v_has_google_identity then
    return event;
  end if;
  
  raise exception 'Only Google OAuth signups are allowed. Please use Google to sign in.';
end;
$$;

comment on function public.before_user_created_hook(jsonb) is 'Hook function that restricts signups to Google OAuth only. Blocks password-based and OTP signups.';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Create triggers for updated_at on all tables
create trigger users_updated_at_trigger
before update on public.users
for each row
execute function public.handle_updated_at();

create trigger teams_updated_at_trigger
before update on public.teams
for each row
execute function public.handle_updated_at();

create trigger profiles_updated_at_trigger
before update on public.profiles
for each row
execute function public.handle_updated_at();

-- Create trigger on auth.users table to populate public.users
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

-- Create trigger on auth.users table for email domain validation
drop trigger if exists validate_czu_email_domain_trigger on auth.users;

create trigger validate_czu_email_domain_trigger
before update of email, email_change on auth.users
for each row
execute function public.validate_czu_email_domain_trigger();

-- ============================================================================
-- INDEXES
-- ============================================================================

create index profiles_user_id_idx on public.profiles(user_id);
create index profiles_work_email_idx on public.profiles(work_email);
create index profiles_team_id_idx on public.profiles(team_id);
create index profiles_team_id_user_id_idx on public.profiles(team_id, user_id);
create index users_google_email_idx on public.users(google_email);
create index users_suggested_work_email_idx on public.users(suggested_work_email);
create index if not exists idx_realtime_messages_topic on realtime.messages(topic);

-- ============================================================================
-- REALTIME
-- ============================================================================

alter publication supabase_realtime add table public.users;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.teams enable row level security;

-- ============================================================================
-- RLS POLICIES - USERS TABLE
-- ============================================================================

-- Users can view their own user record
create policy "Users can view their own user record" on public.users
for select
to authenticated
using ( (select auth.uid()) = auth_user_id );

-- Users can update their own user record
create policy "Users can update their own user record" on public.users
for update
to authenticated
using ( (select auth.uid()) = auth_user_id )
with check ( (select auth.uid()) = auth_user_id );

-- Users can insert their own user record (during signup via trigger)
create policy "Users can insert their own user record" on public.users
for insert
to authenticated
with check ( (select auth.uid()) = auth_user_id );

-- ============================================================================
-- RLS POLICIES - PROFILES TABLE
-- ============================================================================

-- Users can view their own profile
create policy "Users can view their own profile" on public.profiles
for select
to authenticated
using (
  user_id in (
    select id
    from public.users
    where auth_user_id = (select auth.uid())
  )
);

-- ============================================================================
-- RLS POLICIES - REALTIME MESSAGES TABLE
-- ============================================================================

-- Users can receive broadcasts for their own user record
create policy "Users can receive broadcasts for their own user record" on realtime.messages
for select
to authenticated
using (
  topic like 'users:%'
  and exists (
    select 1
    from public.users
    where auth_user_id = (select auth.uid())
    and topic = 'users:' || id::text
  )
);

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant execute permissions for Supabase Auth hook function
-- Trigger functions (handle_new_auth_user, validate_czu_email_domain_trigger) are invoked by triggers, not directly, so no EXECUTE grants needed
grant execute on function public.before_user_created_hook(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
revoke execute on function public.before_user_created_hook(jsonb) from anon, authenticated, public;
