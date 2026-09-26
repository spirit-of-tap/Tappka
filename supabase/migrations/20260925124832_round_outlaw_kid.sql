-- Custom SQL migration file, put your code below! --
-- Coach review search also matches the English book title, the book author and
-- the content source creator (previously only title_cs / source title).
create or replace function public.coach_review_filtered_ids(
  p_coach_profile_id uuid,
  p_team_id uuid,
  p_tab text,
  p_rocket text,
  p_points text,
  p_reply text,
  p_page int,
  p_page_size int,
  p_search text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
      -- content source first, then frozen value, then live book
      -- (archived live books count as 0, missing values count as 0).
      case
        when e.content_source_id is not null then coalesce(cs.points, 0)
        when e.frozen_book_points is not null then e.frozen_book_points
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
$$;

grant execute on function public.coach_review_filtered_ids(uuid, uuid, text, text, text, text, int, int, text) to authenticated;
grant execute on function public.coach_review_filtered_ids(uuid, uuid, text, text, text, text, int, int, text) to service_role;

comment on function public.coach_review_filtered_ids(uuid, uuid, text, text, text, text, int, int, text) is 'Coach review inbox: returns paginated essay ids plus exact unread/read totals for all filters (team, rocket, points, reply, search, tab). Search covers student name, essay title, book title (cs/en) and author, content source title and creator. Read status is team-wide.';
