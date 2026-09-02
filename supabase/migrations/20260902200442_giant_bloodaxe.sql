-- get_teams_with_member_stats(): a frozen essay now counts even when it has
-- no book_id (and no content_source_id) at all — some legacy essays
-- reference an old-system book that was never imported into the catalog,
-- but the earned credit still counts. Matches the same fix already applied
-- to resolveEssayPoints/getEssaySourceDisplay and the three TS aggregation
-- functions in src/lib/essays/queries.ts.
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

      union all

      -- Frozen essays with no book_id and no content_source_id at all — the
      -- old-system book was never linked/imported. No book to dedupe on, so
      -- every qualifying essay is its own credit.
      select e.author_profile_id, e.frozen_book_points as points
      from public.essays e
      where e.book_id is null
        and e.content_source_id is null
        and e.frozen_book_points is not null
        and e.published_at is not null
        and e.removed_at is null
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
