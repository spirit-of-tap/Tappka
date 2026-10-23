-- get_teams_with_member_stats(): credit legacy frozen points per essay.
--
-- The retired points system awarded each essay separately, even when several
-- essays pointed at one shared book/source record (e.g. podcast episodes
-- imported under a single "book"). Frozen essays therefore count once per
-- essay, regardless of book_id/content_source_id. Live (unfrozen) essays keep
-- the one-credit-per-book / one-credit-per-source dedupe. Matches the three TS
-- aggregation functions in src/lib/essays/queries.ts.
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
  earliest_live_book_essay as (
    select distinct on (e.author_profile_id, e.book_id)
      e.author_profile_id, e.book_id
    from public.essays e
    where e.book_id is not null
      and e.frozen_book_points is null
      and e.published_at is not null
      and e.removed_at is null
    order by e.author_profile_id, e.book_id, e.published_at asc
  ),
  member_points as (
    select
      pts.author_profile_id,
      coalesce(sum(pts.points), 0) as book_points
    from (
      -- Legacy frozen credit: one row per essay, regardless of whether the
      -- essay shares its book/source with other essays.
      select e.author_profile_id, e.frozen_book_points as points
      from public.essays e
      where e.frozen_book_points is not null
        and e.published_at is not null
        and e.removed_at is null

      union all

      -- Live book credit: one per (author, book), earliest essay wins.
      select sub.author_profile_id, b.book_points as points
      from earliest_live_book_essay sub
      join public.books b
        on b.id = sub.book_id
       and b.list_status in ('shortlist', 'longlist')

      union all

      -- Live content-source credit: one per (author, source).
      select sub.author_profile_id, cs.points
      from (
        select distinct e.author_profile_id, e.content_source_id
        from public.essays e
        where e.content_source_id is not null
          and e.frozen_book_points is null
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

-- coach_review_filtered_ids(): resolve a legacy frozen value before a
-- content source, mirroring resolveEssayPoints(). The frozen value is the
-- per-essay credit awarded by the retired system, so it stays authoritative
-- even when the essay also links to a shared content source.
CREATE OR REPLACE FUNCTION public.coach_review_filtered_ids(p_coach_profile_id uuid, p_team_id uuid, p_tab text, p_rocket text, p_points text, p_reply text, p_page integer, p_page_size integer, p_search text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_offset int;
  v_limit int;
  v_tab text := coalesce(nullif(btrim(p_tab), ''), 'unread');
  v_rocket text := coalesce(nullif(btrim(p_rocket), ''), 'all');
  v_points text := coalesce(nullif(btrim(p_points), ''), 'all');
  v_reply text := coalesce(nullif(btrim(p_reply), ''), 'all');
  v_search text := nullif(btrim(p_search), '');
  v_pattern text;
  v_result jsonb;
  v_caller uuid;
begin
  -- Auth: caller must be coach/admin and must match p_coach_profile_id
  v_caller := public.current_profile_id();
  if v_caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.is_coach_or_admin() then
    raise exception 'Only coaches or admins can access coach review' using errcode = '42501';
  end if;
  if v_caller <> p_coach_profile_id and not public.is_admin() then
    raise exception 'Coach can only query own review inbox' using errcode = '42501';
  end if;

  if v_tab not in ('unread', 'read') then
    v_tab := 'unread';
  end if;

  v_offset := greatest(0, (greatest(1, coalesce(p_page, 1)) - 1) * greatest(1, coalesce(p_page_size, 50)));
  v_limit := greatest(1, coalesce(p_page_size, 50));

  -- Validate enum-like filters to avoid injection via case branches
  if v_rocket not in ('all', 'rocket', 'non-rocket') then
    v_rocket := 'all';
  end if;
  if v_points not in ('all', '1', '2', '3', '0') then
    v_points := 'all';
  end if;
  if v_reply not in ('all', 'with-reply', 'without-reply', 'edited-after-comment', 'no-coach-comment') then
    v_reply := 'all';
  end if;

  -- Escape LIKE wildcards so the search is a literal substring match
  if v_search is not null then
    v_pattern := '%' || replace(replace(replace(left(v_search, 100), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with
  -- Admins write essays too (students with elevated permissions), and the
  -- caller's own essays are included so an admin sees their essay's feedback.
  student_ids as (
    select p.id
    from public.profiles p
    where p.role in ('student', 'admin')
      and p.access_removed_at is null
      and (p_team_id is null or p.team_id = p_team_id)
  ),
  base_essays as (
    select e.id, e.author_profile_id, e.book_id, e.published_at, e.removed_at, e.created_at, e.updated_at,
      -- Resolved essay points, mirroring resolveEssayPoints():
      -- frozen legacy value first, then content source, then live book
      -- (archived live books count as 0, missing values count as 0).
      case
        when e.frozen_book_points is not null then e.frozen_book_points
        when e.content_source_id is not null then coalesce(cs.points, 0)
        when b.id is not null then (case when b.list_status = 'archived' then 0 else coalesce(b.book_points, 0) end)
        else 0
      end as resolved_points
    from public.essays e
    left join public.books b on b.id = e.book_id
    left join public.content_sources cs on cs.id = e.content_source_id
    where e.author_profile_id in (select id from student_ids)
      and e.published_at is not null
      and e.removed_at is null
      and (
        case
          when v_rocket = 'rocket' then coalesce(b.is_rocket_model, false)
          when v_rocket = 'non-rocket' then not coalesce(b.is_rocket_model, false)
          else true
        end
      )
      and (
        v_pattern is null
        or b.title_cs ilike v_pattern
        or b.title_en ilike v_pattern
        or b.author ilike v_pattern
        or cs.title ilike v_pattern
        or cs.creator ilike v_pattern
        or exists (
          select 1 from public.profiles ap
          where ap.id = e.author_profile_id and ap.name ilike v_pattern
        )
        or exists (
          select 1 from public.essay_revisions sr
          where sr.essay_id = e.id and sr.invalid_since is null and sr.title ilike v_pattern
        )
      )
  ),
  coach_stats as (
    select
      ec.essay_id as essay_id,
      min(ec.created_at) as earliest_at,
      array_agg(ec.id) as coach_ids
    from public.essay_comments ec
    join public.profiles pr on pr.id = ec.author_profile_id
    where ec.removed_at is null
      and pr.role = 'coach'
      and ec.essay_id in (select id from base_essays)
    group by ec.essay_id
  ),
  author_reply as (
    select distinct ec.essay_id
    from public.essay_comments ec
    join coach_stats cs on cs.essay_id = ec.essay_id
    join public.essays e on e.id = ec.essay_id
    where ec.removed_at is null
      and ec.author_profile_id = e.author_profile_id
      and (
        ec.parent_id = any(cs.coach_ids)
        or ec.created_at > cs.earliest_at
      )
  ),
  rev_max as (
    select
      r.essay_id as essay_id,
      max(coalesce(r.updated_at, r.created_at)) as max_rev_at
    from public.essay_revisions r
    where r.invalid_since is null
      and r.essay_id in (select essay_id from coach_stats)
    group by r.essay_id
  ),
  -- Read status is team-wide: read once ANY coach/admin marked it.
  read_ids as (
    select distinct essay_id from public.essay_coach_reads
  ),
  filtered as (
    select e.id, e.created_at, (ri.essay_id is not null) as is_read
    from base_essays e
    left join coach_stats cs on cs.essay_id = e.id
    left join author_reply ar on ar.essay_id = e.id
    left join rev_max rm on rm.essay_id = e.id
    left join read_ids ri on ri.essay_id = e.id
    where
      case v_reply
        when 'all' then true
        when 'no-coach-comment' then cs.essay_id is null
        when 'with-reply' then cs.essay_id is not null and ar.essay_id is not null
        when 'without-reply' then cs.essay_id is not null and ar.essay_id is null
        when 'edited-after-comment' then cs.essay_id is not null and greatest(e.updated_at, coalesce(rm.max_rev_at, e.updated_at)) > cs.earliest_at + interval '60 seconds'
        else true
      end
      and (
        case
          when v_points in ('1','2','3') then e.resolved_points = v_points::numeric
          when v_points = '0' then e.resolved_points not in (1, 2, 3)
          else true
        end
      )
  ),
  counts as (
    select
      count(*) filter (where not is_read) as unread_cnt,
      count(*) filter (where is_read) as read_cnt
    from filtered
  ),
  paginated as (
    select f.id
    from filtered f
    where f.is_read = (v_tab = 'read')
    order by f.created_at desc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'essay_ids', coalesce((select jsonb_agg(to_jsonb(p.id)) from paginated p), '[]'::jsonb),
    'total_count', case when v_tab = 'read' then c.read_cnt else c.unread_cnt end,
    'unread_count', c.unread_cnt,
    'read_count', c.read_cnt,
    'has_more', (case when v_tab = 'read' then c.read_cnt else c.unread_cnt end) > (v_offset + v_limit)
  )
  into v_result
  from counts c;

  return v_result;
end;
$function$;
