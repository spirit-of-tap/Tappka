-- Tappka Books & Essays Module ("Kniha knih" + Eseje)
-- Purpose: Shared catalog of books (with coach approval and 1-3 BookPoints)
--          and student-authored essays written about them.
-- Affected tables: books, essays, essay_comments, book_comments, essay_views
-- Special considerations:
--   - Approved books are immutable (points/status locked by trigger).
--   - Essay views recorded via SECURITY DEFINER RPC; no direct client inserts.

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

create extension if not exists pg_trgm;

-- ============================================================================
-- ENUMS
-- ============================================================================

create type public.book_status as enum ('pending', 'approved', 'rejected');
create type public.book_source as enum ('manual', 'google_books', 'open_library');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Books: shared, coach-curated catalog.
create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null,
  isbn_13 text unique,
  description text,
  cover_path text, -- B2 key under book/<book_id>/...
  tags text[] not null default '{}',
  suggested_points smallint not null default 1 check (suggested_points between 0 and 3),
  book_points smallint not null default 0 check (book_points between 0 and 3),
  status public.book_status not null default 'pending',
  added_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  approved_by_profile_id uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  rejection_reason text,
  source public.book_source not null default 'manual',
  external_id text, -- Google Books volumeId or Open Library work id
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.books is 'Shared catalog of books (Kniha knih). Students add; coaches approve with 1-3 points or reject.';

-- Essays: student-authored, optionally linked to one book.
create table public.essays (
  id uuid primary key default gen_random_uuid(),
  author_profile_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  title text not null,
  content_json jsonb not null default '{}'::jsonb, -- Tiptap document JSON
  content_text text not null default '',           -- Plain text mirror for full-text search
  published boolean not null default true,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.essays is 'Student essays written in Tiptap. No approval workflow; students own their essays.';

-- Essay comments (flat, Facebook-style).
create table public.essay_comments (
  id uuid primary key default gen_random_uuid(),
  essay_id uuid not null references public.essays(id) on delete cascade,
  author_profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Book comments (flat, Facebook-style).
create table public.book_comments (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  author_profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Essay views: one row per (essay, viewer).
-- Author is never inserted as a viewer (guarded in the RPC).
create table public.essay_views (
  essay_id uuid not null references public.essays(id) on delete cascade,
  viewer_profile_id uuid not null references public.profiles(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  primary key (essay_id, viewer_profile_id)
);

comment on table public.essay_views is 'Distinct viewers per essay. Populated via record_essay_view RPC only.';

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Helper: get the calling auth user's profile id.
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id
  from public.profiles p
  join public.users u on u.id = p.user_id
  where u.auth_user_id = (select auth.uid())
  limit 1;
$$;

comment on function public.current_profile_id() is 'Returns the profile.id linked to the calling auth user, or null if unlinked.';

-- Helper: is the calling auth user a coach or admin?
create or replace function public.is_coach_or_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.users u on u.id = p.user_id
    where u.auth_user_id = (select auth.uid())
      and p.role = any(array['coach'::public.profile_role, 'admin'::public.profile_role])
  );
$$;

-- Helper: is the calling auth user an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.users u on u.id = p.user_id
    where u.auth_user_id = (select auth.uid())
      and p.role = 'admin'::public.profile_role
  );
$$;

-- Maintain essays.view_count from essay_views inserts.
-- ON CONFLICT DO UPDATE fires UPDATE triggers (not INSERT) for conflict branch,
-- so this increment only runs on true inserts.
create or replace function public.handle_essay_view_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.essays
    set view_count = view_count + 1
    where id = new.essay_id;
  return new;
end;
$$;

-- Protect approved books: once status='approved', book_points and status cannot change.
create or replace function public.protect_approved_book()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = 'approved'::public.book_status then
    if new.status is distinct from old.status
       or new.book_points is distinct from old.book_points then
      raise exception 'Approved books are immutable; status and book_points cannot change.';
    end if;
  end if;
  return new;
end;
$$;

-- RPC: record an essay view (upsert), security definer so it bypasses
-- the restrictive insert policy on essay_views.
create or replace function public.record_essay_view(p_essay_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_author_id uuid;
begin
  select p.id into v_profile_id
  from public.profiles p
  join public.users u on u.id = p.user_id
  where u.auth_user_id = (select auth.uid())
  limit 1;

  if v_profile_id is null then
    return;
  end if;

  select author_profile_id into v_author_id
  from public.essays
  where id = p_essay_id;

  if v_author_id is null or v_author_id = v_profile_id then
    return;
  end if;

  insert into public.essay_views (essay_id, viewer_profile_id)
  values (p_essay_id, v_profile_id)
  on conflict (essay_id, viewer_profile_id)
  do update set last_viewed_at = now();
end;
$$;

comment on function public.record_essay_view(uuid) is 'Records a distinct view of an essay by the caller. Skips the essay author.';

grant execute on function public.record_essay_view(uuid) to authenticated;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

create trigger books_updated_at_trigger
  before update on public.books
  for each row execute function public.handle_updated_at();

create trigger essays_updated_at_trigger
  before update on public.essays
  for each row execute function public.handle_updated_at();

create trigger essay_comments_updated_at_trigger
  before update on public.essay_comments
  for each row execute function public.handle_updated_at();

create trigger book_comments_updated_at_trigger
  before update on public.book_comments
  for each row execute function public.handle_updated_at();

create trigger essay_views_after_insert_trigger
  after insert on public.essay_views
  for each row execute function public.handle_essay_view_insert();

create trigger books_protect_approved_trigger
  before update on public.books
  for each row execute function public.protect_approved_book();

-- ============================================================================
-- INDEXES
-- ============================================================================

create index books_status_idx on public.books(status);
create index books_added_by_idx on public.books(added_by_profile_id);
create index books_isbn_13_idx on public.books(isbn_13) where isbn_13 is not null;
create index books_title_trgm_idx on public.books using gin (title gin_trgm_ops);
create index books_author_trgm_idx on public.books using gin (author gin_trgm_ops);
create index books_created_desc_idx on public.books(created_at desc);

create index essays_author_idx on public.essays(author_profile_id);
create index essays_book_idx on public.essays(book_id);
create index essays_created_desc_idx on public.essays(created_at desc);
create index essays_content_text_tsv_idx on public.essays using gin (to_tsvector('simple', content_text));

create index essay_comments_essay_idx on public.essay_comments(essay_id);
create index essay_comments_author_idx on public.essay_comments(author_profile_id);

create index book_comments_book_idx on public.book_comments(book_id);
create index book_comments_author_idx on public.book_comments(author_profile_id);

create index essay_views_viewer_idx on public.essay_views(viewer_profile_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.books enable row level security;
alter table public.essays enable row level security;
alter table public.essay_comments enable row level security;
alter table public.book_comments enable row level security;
alter table public.essay_views enable row level security;

-- ----------------------------------------------------------------------------
-- RLS: books
-- ----------------------------------------------------------------------------

create policy "Authenticated users can view all books"
  on public.books for select
  to authenticated
  using (true);

create policy "Authenticated users can add books"
  on public.books for insert
  to authenticated
  with check (added_by_profile_id = public.current_profile_id());

create policy "Coaches and admins can update books"
  on public.books for update
  to authenticated
  using (public.is_coach_or_admin())
  with check (public.is_coach_or_admin());

create policy "Admins can delete books"
  on public.books for delete
  to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- RLS: essays
-- ----------------------------------------------------------------------------

create policy "Authenticated users can view all essays"
  on public.essays for select
  to authenticated
  using (true);

create policy "Authors can create their own essays"
  on public.essays for insert
  to authenticated
  with check (author_profile_id = public.current_profile_id());

create policy "Authors can update their own essays"
  on public.essays for update
  to authenticated
  using (author_profile_id = public.current_profile_id())
  with check (author_profile_id = public.current_profile_id());

create policy "Authors and admins can delete essays"
  on public.essays for delete
  to authenticated
  using (author_profile_id = public.current_profile_id() or public.is_admin());

-- ----------------------------------------------------------------------------
-- RLS: essay_comments
-- ----------------------------------------------------------------------------

create policy "Authenticated users can view essay comments"
  on public.essay_comments for select
  to authenticated
  using (true);

create policy "Authenticated users can add essay comments"
  on public.essay_comments for insert
  to authenticated
  with check (author_profile_id = public.current_profile_id());

create policy "Authors can update their own essay comments"
  on public.essay_comments for update
  to authenticated
  using (author_profile_id = public.current_profile_id())
  with check (author_profile_id = public.current_profile_id());

create policy "Authors and admins can delete essay comments"
  on public.essay_comments for delete
  to authenticated
  using (author_profile_id = public.current_profile_id() or public.is_admin());

-- ----------------------------------------------------------------------------
-- RLS: book_comments
-- ----------------------------------------------------------------------------

create policy "Authenticated users can view book comments"
  on public.book_comments for select
  to authenticated
  using (true);

create policy "Authenticated users can add book comments"
  on public.book_comments for insert
  to authenticated
  with check (author_profile_id = public.current_profile_id());

create policy "Authors can update their own book comments"
  on public.book_comments for update
  to authenticated
  using (author_profile_id = public.current_profile_id())
  with check (author_profile_id = public.current_profile_id());

create policy "Authors and admins can delete book comments"
  on public.book_comments for delete
  to authenticated
  using (author_profile_id = public.current_profile_id() or public.is_admin());

-- ----------------------------------------------------------------------------
-- RLS: essay_views
-- ----------------------------------------------------------------------------

-- Essay authors can see all viewers of their own essays;
-- other callers can see only their own view row.
create policy "Authors see all viewers; others see own row"
  on public.essay_views for select
  to authenticated
  using (
    viewer_profile_id = public.current_profile_id()
    or exists (
      select 1 from public.essays e
      where e.id = essay_views.essay_id
        and e.author_profile_id = public.current_profile_id()
    )
  );

-- Block direct inserts: clients must use record_essay_view RPC.
create policy "No direct inserts to essay_views"
  on public.essay_views for insert
  to authenticated
  with check (false);
