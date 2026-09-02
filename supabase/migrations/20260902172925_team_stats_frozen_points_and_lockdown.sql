-- get_teams_with_member_stats(): resolve frozen_book_points, matching
-- getTeamBookPointsStats() in src/lib/essays/queries.ts exactly.
--
-- Pre-2026-09-03 essays freeze the point value their book had under the
-- retired points system in essays.frozen_book_points. The book-points branch
-- below used to sum the LIVE books.book_points for every distinct
-- (author, book) pair, ignoring the freeze entirely. It now resolves one row
-- per (author, book) pair using the EARLIEST published_at essay (matching
-- the app's earliest-essay-wins dedup tie-break) and prefers that essay's
-- frozen_book_points, falling back to the live book_points when it's NULL.
-- The content-sources branch is unaffected (frozen_book_points only applies
-- to book-linked essays) and is left as-is.
CREATE OR REPLACE FUNCTION public.get_teams_with_member_stats()
 RETURNS TABLE(team_id uuid, team_name text, profile_id uuid, profile_name text, profile_picture text, essay_count bigint, book_points numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with member_essays as (
    select author_profile_id, count(id) as essay_count
    from public.essays
    where published_at is not null
      and removed_at is null
    group by author_profile_id
  ),
  earliest_book_essay as (
    select distinct on (e.author_profile_id, e.book_id)
      e.author_profile_id, e.book_id, e.frozen_book_points
    from public.essays e
    where e.book_id is not null
      and e.published_at is not null
      and e.removed_at is null
    order by e.author_profile_id, e.book_id, e.published_at asc
  ),
  member_points as (
    select
      pts.author_profile_id,
      coalesce(sum(pts.points), 0) as book_points
    from (
      select sub.author_profile_id, coalesce(sub.frozen_book_points, b.book_points) as points
      from earliest_book_essay sub
      join public.books b
        on b.id = sub.book_id
       and b.list_status in ('shortlist', 'longlist')

      union all

      select sub.author_profile_id, cs.points
      from (
        select distinct e.author_profile_id, e.content_source_id
        from public.essays e
        where e.content_source_id is not null
          and e.published_at is not null
          and e.removed_at is null
      ) sub
      join public.content_sources cs
        on cs.id = sub.content_source_id
       and cs.status = 'approved'
    ) pts
    group by pts.author_profile_id
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
$function$;

-- Bound frozen_book_points to the same range as books.book_points
-- (books_book_points_check in db/schema/books.ts), and block students from
-- writing it directly via PostgREST. The existing "Authors can update their
-- own essays" RLS policy is row-scoped, not column-scoped, so a column-level
-- REVOKE is the right primitive: it's evaluated before RLS and only blocks
-- UPDATE statements that include this column, so the app's normal
-- author-update path for other essay fields is unaffected. The backfill
-- script runs as service role and is unaffected too.
ALTER TABLE public.essays
  ADD CONSTRAINT essays_frozen_book_points_check
  CHECK (frozen_book_points IS NULL OR (frozen_book_points >= 0 AND frozen_book_points <= 3));

REVOKE UPDATE (frozen_book_points) ON public.essays FROM authenticated;
