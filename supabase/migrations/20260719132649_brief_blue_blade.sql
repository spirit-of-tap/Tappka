-- Fix DB functions broken by the schema rename/drop pass:
-- - users.google_full_name / google_profile_picture dropped
-- - profiles.removed_access* / beta_access renamed
-- - essays.published → published_at
-- - books.tags / cover_path replaced by book_tags + supabase_cover_img_url

-- ---------------------------------------------------------------------------
-- handle_new_auth_user: only persist google_email (name/picture columns gone)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_google_email text;
  v_raw_meta_data jsonb;
begin
  v_raw_meta_data := new.raw_user_meta_data;
  v_google_email := coalesce(new.email, v_raw_meta_data->>'email');

  insert into public.users (
    auth_user_id,
    google_email
  )
  values (
    new.id,
    v_google_email
  )
  on conflict (auth_user_id) do update set
    google_email = coalesce(excluded.google_email, public.users.google_email);

  return new;
end;
$$;

comment on function public.handle_new_auth_user() is
  'Trigger function that creates a public.users row when a new auth.users row is inserted. Persists the Google email from auth.users.';

-- ---------------------------------------------------------------------------
-- validate_picture_only_update: follow profiles column renames + new audit cols
-- ---------------------------------------------------------------------------

create or replace function public.validate_picture_only_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_db_role text := current_setting('role', true);
  v_jwt_role text := current_setting('request.jwt.claim.role', true);
begin
  -- bypass restriction for trusted database/system sessions
  if
    session_user in ('postgres', 'supabase_admin', 'supabase_auth_admin')
    or current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin')
    or v_db_role in ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin')
    or v_jwt_role = 'service_role'
  then
    return new;
  end if;

  -- allow user_id-only changes from trusted DB workflows (profile linking / FK null)
  if old.user_id is distinct from new.user_id then
    if (
      old.id is not distinct from new.id
      and old.name is not distinct from new.name
      and old.work_email is not distinct from new.work_email
      and old.role is not distinct from new.role
      and old.team_id is not distinct from new.team_id
      and old.phone_number is not distinct from new.phone_number
      and old.personal_email is not distinct from new.personal_email
      and old.date_of_birth is not distinct from new.date_of_birth
      and old.beta_access_granted_at is not distinct from new.beta_access_granted_at
      and old.access_removed_at is not distinct from new.access_removed_at
      and old.access_removed_by_profile_id is not distinct from new.access_removed_by_profile_id
      and old.created_by_profile_id is not distinct from new.created_by_profile_id
      and old.updated_by_profile_id is not distinct from new.updated_by_profile_id
      and old.created_at is not distinct from new.created_at
    ) then
      return new;
    end if;
  end if;

  -- regular users may only change picture and beta_access_granted_at
  if (
    old.id is distinct from new.id
    or old.name is distinct from new.name
    or old.user_id is distinct from new.user_id
    or old.work_email is distinct from new.work_email
    or old.role is distinct from new.role
    or old.team_id is distinct from new.team_id
    or old.phone_number is distinct from new.phone_number
    or old.personal_email is distinct from new.personal_email
    or old.date_of_birth is distinct from new.date_of_birth
    or old.access_removed_at is distinct from new.access_removed_at
    or old.access_removed_by_profile_id is distinct from new.access_removed_by_profile_id
    or old.created_by_profile_id is distinct from new.created_by_profile_id
    or old.updated_by_profile_id is distinct from new.updated_by_profile_id
    or old.created_at is distinct from new.created_at
  ) then
    raise exception 'Only picture and beta_access_granted_at can be updated by users';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_teams_with_member_stats: access_removed_at + published_at + numeric points
-- ---------------------------------------------------------------------------

drop function if exists public.get_teams_with_member_stats();

create function public.get_teams_with_member_stats()
returns table (
  team_id uuid,
  team_name text,
  profile_id uuid,
  profile_name text,
  profile_picture text,
  essay_count bigint,
  book_points numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with member_essays as (
    select author_profile_id, count(id) as essay_count
    from public.essays
    where published_at is not null
      and removed_at is null
    group by author_profile_id
  ),
  member_points as (
    select
      sub.author_profile_id,
      coalesce(sum(b.book_points), 0) as book_points
    from (
      select distinct e.author_profile_id, e.book_id
      from public.essays e
      where e.book_id is not null
        and e.published_at is not null
        and e.removed_at is null
    ) sub
    join public.books b
      on b.id = sub.book_id
     and b.status = 'approved'
    group by sub.author_profile_id
  )
  select
    t.id as team_id,
    t.name as team_name,
    p.id as profile_id,
    p.name as profile_name,
    p.picture as profile_picture,
    coalesce(me.essay_count, 0) as essay_count,
    coalesce(mp.book_points, 0) as book_points
  from public.teams t
  join public.profiles p
    on p.team_id = t.id
   and p.access_removed_at is null
  left join member_essays me on me.author_profile_id = p.id
  left join member_points mp on mp.author_profile_id = p.id
  where t.removed_at is null
  order by t.name, coalesce(mp.book_points, 0) desc, p.name;
$$;

-- ---------------------------------------------------------------------------
-- get_best_books_per_category: book_tags + supabase_cover_img_url
-- Keeps cover_path / tags aliases so existing RPC consumers stay compatible.
-- ---------------------------------------------------------------------------

drop function if exists public.get_best_books_per_category(integer);

create function public.get_best_books_per_category(top_n integer default 3)
returns table (
  tag text,
  id uuid,
  title text,
  author text,
  cover_path text,
  description text,
  preview_link text,
  tags text[],
  book_points numeric,
  essay_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with book_tag_names as (
    select
      bt.book_id,
      array_agg(tg.name order by tg.name) as tags
    from public.book_tags bt
    join public.tags tg on tg.id = bt.tag_id
    group by bt.book_id
  ),
  ranked as (
    select
      tg.name as tag,
      b.id,
      b.title,
      b.author,
      b.supabase_cover_img_url as cover_path,
      b.description,
      b.preview_link,
      coalesce(btn.tags, '{}'::text[]) as tags,
      b.book_points,
      b.essay_count,
      row_number() over (
        partition by tg.name
        order by (b.essay_count * 3 + coalesce(b.book_points, 0)) desc, b.created_at desc
      ) as rn
    from public.books_with_essay_count b
    join public.book_tags bt on bt.book_id = b.id
    join public.tags tg on tg.id = bt.tag_id
    left join book_tag_names btn on btn.book_id = b.id
    where b.status = 'approved'
  )
  select
    ranked.tag,
    ranked.id,
    ranked.title,
    ranked.author,
    ranked.cover_path,
    ranked.description,
    ranked.preview_link,
    ranked.tags,
    ranked.book_points,
    ranked.essay_count
  from ranked
  where ranked.rn <= top_n
  order by ranked.tag, ranked.rn;
$$;
