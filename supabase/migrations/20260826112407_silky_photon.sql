-- Custom SQL migration file, put your code below! --
-- ============================================================================
-- Coach review inbox: database-level filtering & pagination
-- Replaces the two-phase PostgREST IN-array filtering that overflows URL
-- limits when hundreds of coach comments exist. All filters run in SQL:
--   team, rocket, points, reply (coach comment / author reply / edited after),
--   and read/unread tab. Scoped strictly to the coach's student candidate pool
--   (no global essay_comments scan) and bounded by p_page/p_page_size.
-- ============================================================================

create or replace function public.coach_review_filtered_ids(
  p_coach_profile_id uuid,
  p_team_id uuid,
  p_tab text,
  p_rocket text,
  p_points text,
  p_reply text,
  p_page int,
  p_page_size int
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
  v_result jsonb;
  v_total_unread bigint := 0;
  v_total_read bigint := 0;
  v_total_active bigint := 0;
  v_essay_ids jsonb := '[]'::jsonb;
  v_has_more boolean := false;
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

  with
  student_ids as (
    select p.id
    from public.profiles p
    where p.role = 'student'
      and p.access_removed_at is null
      and p.id <> p_coach_profile_id
      and (p_team_id is null or p.team_id = p_team_id)
  ),
  base_essays as (
    select e.id, e.author_profile_id, e.book_id, e.published_at, e.removed_at, e.created_at, e.updated_at
    from public.essays e
    where e.author_profile_id in (select id from student_ids)
      and e.published_at is not null
      and e.removed_at is null
      and (
        case
          when v_rocket = 'rocket' then e.book_id in (select b.id from public.books b where b.is_rocket_model = true)
          when v_rocket = 'non-rocket' then (e.book_id is null or e.book_id not in (select b.id from public.books b where b.is_rocket_model = true))
          else true
        end
      )
      and (
        case
          when v_points in ('1','2','3') then e.book_id in (select b.id from public.books b where b.book_points = v_points::numeric and b.list_status in ('shortlist','longlist'))
          when v_points = '0' then (e.book_id is null or e.book_id not in (select b.id from public.books b where b.book_points > 0 and b.list_status in ('shortlist','longlist')))
          else true
        end
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
      and pr.role in ('coach','admin')
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
    group by r.essay_id
  ),
  filtered_reply as (
    select e.id, e.created_at, e.updated_at
    from base_essays e
    left join coach_stats cs on cs.essay_id = e.id
    left join author_reply ar on ar.essay_id = e.id
    left join rev_max rm on rm.essay_id = e.id
    where
      case v_reply
        when 'all' then true
        when 'no-coach-comment' then cs.essay_id is null
        when 'with-reply' then cs.essay_id is not null and ar.essay_id is not null
        when 'without-reply' then cs.essay_id is not null and ar.essay_id is null
        when 'edited-after-comment' then cs.essay_id is not null and greatest(e.updated_at, coalesce(rm.max_rev_at, e.updated_at)) > cs.earliest_at + interval '60 seconds'
        else true
      end
  ),
  read_ids as (
    select essay_id from public.essay_coach_reads where coach_profile_id = p_coach_profile_id
  ),
  counts as (
    select
      count(*) filter (where fr.id not in (select essay_id from read_ids)) as unread_cnt,
      count(*) filter (where fr.id in (select essay_id from read_ids)) as read_cnt
    from filtered_reply fr
  )
  select
    coalesce((select unread_cnt from counts), 0),
    coalesce((select read_cnt from counts), 0)
  into v_total_unread, v_total_read;

  if v_tab = 'unread' then
    v_total_active := v_total_unread;
  else
    v_total_active := v_total_read;
  end if;

  -- Paginated IDs in display order (created_at desc)
  with
  student_ids as (
    select p.id
    from public.profiles p
    where p.role = 'student'
      and p.access_removed_at is null
      and p.id <> p_coach_profile_id
      and (p_team_id is null or p.team_id = p_team_id)
  ),
  base_essays as (
    select e.id, e.author_profile_id, e.book_id, e.published_at, e.removed_at, e.created_at, e.updated_at
    from public.essays e
    where e.author_profile_id in (select id from student_ids)
      and e.published_at is not null
      and e.removed_at is null
      and (
        case
          when v_rocket = 'rocket' then e.book_id in (select b.id from public.books b where b.is_rocket_model = true)
          when v_rocket = 'non-rocket' then (e.book_id is null or e.book_id not in (select b.id from public.books b where b.is_rocket_model = true))
          else true
        end
      )
      and (
        case
          when v_points in ('1','2','3') then e.book_id in (select b.id from public.books b where b.book_points = v_points::numeric and b.list_status in ('shortlist','longlist'))
          when v_points = '0' then (e.book_id is null or e.book_id not in (select b.id from public.books b where b.book_points > 0 and b.list_status in ('shortlist','longlist')))
          else true
        end
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
      and pr.role in ('coach','admin')
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
    group by r.essay_id
  ),
  filtered_reply as (
    select e.id, e.created_at, e.updated_at
    from base_essays e
    left join coach_stats cs on cs.essay_id = e.id
    left join author_reply ar on ar.essay_id = e.id
    left join rev_max rm on rm.essay_id = e.id
    where
      case v_reply
        when 'all' then true
        when 'no-coach-comment' then cs.essay_id is null
        when 'with-reply' then cs.essay_id is not null and ar.essay_id is not null
        when 'without-reply' then cs.essay_id is not null and ar.essay_id is null
        when 'edited-after-comment' then cs.essay_id is not null and greatest(e.updated_at, coalesce(rm.max_rev_at, e.updated_at)) > cs.earliest_at + interval '60 seconds'
        else true
      end
  ),
  read_ids as (
    select essay_id from public.essay_coach_reads where coach_profile_id = p_coach_profile_id
  ),
  paginated as (
    select fr.id
    from filtered_reply fr
    where
      case v_tab
        when 'unread' then fr.id not in (select essay_id from read_ids)
        when 'read' then fr.id in (select essay_id from read_ids)
        else true
      end
    order by fr.created_at desc
    limit v_limit offset v_offset
  )
  select coalesce(jsonb_agg(to_jsonb(paginated.id)), '[]'::jsonb)
  into v_essay_ids
  from paginated;

  v_has_more := v_total_active > (v_offset + v_limit);

  v_result := jsonb_build_object(
    'essay_ids', v_essay_ids,
    'total_count', v_total_active,
    'unread_count', v_total_unread,
    'read_count', v_total_read,
    'has_more', v_has_more
  );

  return v_result;
end;
$$;

grant execute on function public.coach_review_filtered_ids(uuid, uuid, text, text, text, text, int, int) to authenticated;
grant execute on function public.coach_review_filtered_ids(uuid, uuid, text, text, text, text, int, int) to service_role;

comment on function public.coach_review_filtered_ids(uuid, uuid, text, text, text, text, int, int) is 'Coach review inbox: returns paginated essay ids plus exact unread/read totals for all filters (team, rocket, points, reply, tab). Scoped to student pool to avoid global PostgREST IN overflow.';
