-- get_teams_with_member_stats(): count approved content sources alongside books.
--
-- The leaderboard's per-member total only summed books.book_points for
-- shortlist/longlist books, so an essay written about an approved podcast,
-- conference or program contributed nothing here even though the profile page
-- and the portfolio export already count it. The aggregation semantics mirror
-- getTeamBookPointsStats() in src/lib/essays/queries.ts exactly: a book counts
-- when list_status is 'shortlist' or 'longlist', a content source when its
-- status is 'approved', and each distinct source counts once per author no
-- matter how many essays reference it.

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
  member_points as (
    select
      pts.author_profile_id,
      coalesce(sum(pts.points), 0) as book_points
    from (
      select sub.author_profile_id, b.book_points as points
      from (
        select distinct e.author_profile_id, e.book_id
        from public.essays e
        where e.book_id is not null
          and e.published_at is not null
          and e.removed_at is null
      ) sub
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
