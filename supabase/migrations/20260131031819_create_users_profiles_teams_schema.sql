-- Migration: Create users, profiles, and teams schema with realtime support
-- Purpose: Creates custom users table (replacing auth.users reference), profiles table, teams table
-- Includes automatic updated_at triggers and realtime broadcasting for users table
-- Affected tables: users, profiles, teams
-- Special considerations: Users table is separate from auth.users, profiles reference users table

-- Create profile_role enum for profiles table
create type public.profile_role as enum ('student', 'team_leader', 'coach', 'admin');

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
  picture text,  -- defaults to Google profile picture on link
  user_id uuid unique references public.users(id) on delete set null,  -- linked after OTP verification
  work_email text unique not null,
  role public.profile_role not null default 'student',
  team_id uuid references public.teams(id) on delete set null,
  phone_number text,
  personal_email text,
  date_of_birth date,
  removed_access timestamptz,  -- null = active, set = revoked
  removed_access_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint valid_czu_domain check (
    work_email like '%@studenti.czu.cz' or work_email like '%@pef.czu.cz'
  )
);

comment on table public.profiles is 'User profile data with role and team membership. Pre-created by admin, linked to user after OTP verification.';

-- Create trigger function to automatically update updated_at column
-- This function will be used by all tables with updated_at columns
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Update the updated_at column to current timestamp on any update
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.handle_updated_at() is 'Trigger function that automatically updates the updated_at column to the current timestamp on row updates.';

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

-- Enable realtime publication for users table
alter publication supabase_realtime add table public.users;

-- Create trigger function for realtime broadcasting on users table
-- Uses realtime.broadcast_changes for database change notifications
create or replace function public.users_realtime_broadcast_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Broadcast changes to users table using dedicated topic pattern
  -- Topic format: users:{user_id} for user-specific updates
  perform realtime.broadcast_changes(
    tg_table_name || ':' || coalesce(new.id, old.id)::text,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return coalesce(new, old);
end;
$$;

comment on function public.users_realtime_broadcast_trigger() is 'Trigger function that broadcasts changes to the users table via Supabase Realtime. Uses dedicated topic pattern users:{user_id}.';

-- Create trigger for realtime broadcasting on users table
create trigger users_realtime_broadcast_trigger
after insert or update or delete on public.users
for each row
execute function public.users_realtime_broadcast_trigger();

-- Create indexes for common queries
create index profiles_user_id_idx on public.profiles(user_id);
create index profiles_work_email_idx on public.profiles(work_email);
create index profiles_team_id_idx on public.profiles(team_id);
create index users_google_email_idx on public.users(google_email);
create index users_suggested_work_email_idx on public.users(suggested_work_email);
create index users_auth_user_id_idx on public.users(auth_user_id);

-- Enable Row Level Security on all tables
alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.teams enable row level security;

-- RLS Policies for users table
-- Users can view their own user record (via auth_user_id link to auth.users)
create policy "Users can view their own user record" on public.users
for select
to authenticated
using ( auth_user_id = (select auth.uid()) );

-- Users can update their own user record
create policy "Users can update their own user record" on public.users
for update
to authenticated
using ( auth_user_id = (select auth.uid()) )
with check ( auth_user_id = (select auth.uid()) );

-- Allow authenticated users to insert their own user record (during signup)
create policy "Users can insert their own user record" on public.users
for insert
to authenticated
with check ( auth_user_id = (select auth.uid()) );

-- RLS Policies for profiles table
-- Users can view their own profile (via user_id -> users.auth_user_id -> auth.uid())
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

-- Users can view profiles in their team (for team collaboration)
create policy "Users can view profiles in their team" on public.profiles
for select
to authenticated
using (
  team_id in (
    select team_id
    from public.profiles
    where user_id in (
      select id
      from public.users
      where auth_user_id = (select auth.uid())
    )
  )
);

-- Admins can view all profiles (role check via application logic)
-- For now, allow authenticated users to view all profiles
-- Application layer should enforce admin-only access
create policy "Authenticated users can view all profiles" on public.profiles
for select
to authenticated
using ( true );

-- Only admins can insert profiles (enforced by application layer)
create policy "Authenticated users can insert profiles" on public.profiles
for insert
to authenticated
with check ( true );

-- Users can update their own profile
create policy "Users can update their own profile" on public.profiles
for update
to authenticated
using (
  user_id in (
    select id
    from public.users
    where auth_user_id = (select auth.uid())
  )
)
with check (
  user_id in (
    select id
    from public.users
    where auth_user_id = (select auth.uid())
  )
);

-- Admins can update any profile (enforced by application layer)
create policy "Authenticated users can update profiles" on public.profiles
for update
to authenticated
using ( true )
with check ( true );

-- RLS Policies for teams table
-- All authenticated users can view teams
create policy "Authenticated users can view teams" on public.teams
for select
to authenticated
using ( true );

-- Only admins can insert teams (enforced by application layer)
create policy "Authenticated users can insert teams" on public.teams
for insert
to authenticated
with check ( true );

-- Only admins can update teams (enforced by application layer)
create policy "Authenticated users can update teams" on public.teams
for update
to authenticated
using ( true )
with check ( true );

-- Only admins can delete teams (enforced by application layer)
create policy "Authenticated users can delete teams" on public.teams
for delete
to authenticated
using ( true );

-- Create index for RLS policy performance on profiles.team_id
-- This index helps with the "Users can view profiles in their team" policy
create index profiles_team_id_user_id_idx on public.profiles(team_id, user_id);

-- RLS Policies for realtime.messages table (required for private channels)
-- Users can receive broadcasts for their own user record
create policy "Users can receive broadcasts for their own user record" on realtime.messages
for select
to authenticated
using (
  topic like 'users:%' and
  exists (
    select 1
    from public.users
    where auth_user_id = (select auth.uid())
    and topic = 'users:' || id::text
  )
);

-- Index for realtime.messages RLS policy performance
create index if not exists idx_realtime_messages_topic on realtime.messages(topic);
