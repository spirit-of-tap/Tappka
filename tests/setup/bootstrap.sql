-- Minimal Supabase environment for the throwaway test database.
-- Recreates only what supabase/migrations reference: auth, realtime, storage.
-- NOT a full Supabase -- no GoTrue, PostgREST, or Storage services.

-- ---- Roles (cluster-global; created if absent) -------------------------
do $$ begin
  -- migrations reference role postgres (e.g. alter default privileges); the
  -- Testcontainers image logs in as "test", so create a stub when missing
  if not exists (select from pg_roles where rolname = 'postgres') then create role postgres nologin; end if;
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin noinherit; end if;
  if not exists (select from pg_roles where rolname = 'supabase_admin') then create role supabase_admin nologin noinherit bypassrls; end if;
end $$;
grant anon, authenticated, service_role to current_user;

-- ---- Grants (Supabase auto-grants these for public tables) ------------
grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- ---- Extensions --------------------------------------------------------
create extension if not exists btree_gist;
create extension if not exists pg_trgm;

-- ---- auth schema -------------------------------------------------------
create schema if not exists auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  email_change text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

create or replace function auth.role() returns text language sql stable as $$
  select current_setting('request.jwt.claims', true)::jsonb ->> 'role';
$$;

-- ---- realtime schema ---------------------------------------------------
create schema if not exists realtime;
grant usage on schema realtime to anon, authenticated, service_role;

create table if not exists realtime.messages (
  id bigint generated always as identity primary key,
  topic text not null,
  extension text,
  payload jsonb,
  event text,
  private boolean default false,
  inserted_at timestamptz not null default now()
);

-- no-op stub matching realtime.send(payload, event, topic, private)
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
  returns void language sql as $$ select $$;

do $$ begin
  if not exists (select from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- ---- storage schema ----------------------------------------------------
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id) on delete cascade,
  name text,
  owner uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb default '{}'::jsonb
);
