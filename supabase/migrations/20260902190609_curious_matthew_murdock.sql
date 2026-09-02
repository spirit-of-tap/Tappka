-- get_teams_with_member_stats(): a frozen essay now counts regardless of its
-- book's current list_status, matching the same fix already applied to the
-- TS aggregation functions (getUserBookPointsStats/getAuthorsApprovedBookPoints/
-- getTeamBookPointsStats in src/lib/essays/queries.ts) and resolveEssayPoints
-- in src/lib/books/points.ts.
--
-- Previously the book-points branch only joined books with
-- list_status in ('shortlist', 'longlist'), so a frozen (pre-2026-09-03)
-- essay whose book was later archived silently dropped out of the sum —
-- contradicting the whole point of freezing: once earned, that credit is
-- baked into the essay and immune to anything that happens to the book
-- afterward (a rescore, a book_id reassignment, or archival).
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
       and (b.list_status in ('shortlist', 'longlist') or sub.frozen_book_points is not null)

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
