-- ---------------------------------------------------------------------------
-- Task 3: secure Birth Giving event mutations.
--
-- Narrow SECURITY DEFINER functions for the three-table Birth Giving model.
-- Every function resolves the caller through birth_giving_active_profile_id()
-- (active, verified, beta), runs with an empty fixed search_path, and
-- schema-qualifies every object. Direct authenticated writes on the tables
-- remain denied by RLS (only SELECT policies exist); all mutations flow
-- through these functions, which run with owner (superuser) privileges.
--
-- Approved SQLSTATEs used here:
--   42501 authorization, 23514 invalid state/incomplete retrospective,
--   23505 duplicate identity (raised by the existing unique expression index),
--   P0002 missing resource.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Private caller helper: resolves the single active, verified, beta profile
-- for the current auth.uid(). SECURITY DEFINER so other SECURITY DEFINER
-- bodies can rely on it, but it is intentionally NOT granted to
-- authenticated/anon and EXECUTE is revoked from PUBLIC below.
-- ---------------------------------------------------------------------------

create function public.birth_giving_active_profile_id()
returns uuid
language sql
stable security definer
set search_path = ''
as $$
  select profile.id
    from public.profiles profile
    join public.users app_user on app_user.id = profile.user_id
   where app_user.auth_user_id = (select auth.uid())
     and app_user.verified_work_email is not null
     and profile.access_removed_at is null
     and profile.beta_access_granted_at is not null
$$;

-- ---------------------------------------------------------------------------
-- birth_giving_save_event(p_event_id uuid, p_name text, p_customer text,
--                         p_starts_at timestamptz, p_duration birth_giving_duration,
--                         p_organizer_profile_ids uuid[])
-- Creates a draft (p_event_id IS NULL) or updates organizer-editable event
-- fields. The caller is always kept among organizers: on create it is
-- appended to the supplied set, on update it is re-appended so an organizer
-- cannot remove themselves and lock the event out.
-- ---------------------------------------------------------------------------

create function public.birth_giving_save_event(
  p_event_id uuid,
  p_name text,
  p_customer text,
  p_starts_at timestamptz,
  p_duration public.birth_giving_duration,
  p_organizer_profile_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_event_id uuid;
  v_organizers uuid[];
begin
  if v_profile_id is null then
    raise exception 'An active verified beta profile is required'
      using errcode = '42501';
  end if;

  -- Append the caller to the supplied set and dedupe preserving input order;
  -- drop any NULL entries (the organizer check constraint forbids NULLs).
  -- A NULL input array is treated as empty: the caller is always present.
  v_organizers := (
    select array_agg(elem order by ord)
      from (
        select elem, ord,
               row_number() over (partition by elem order by ord) as rn
          from unnest(array_append(coalesce(p_organizer_profile_ids, array[]::uuid[]), v_profile_id))
               with ordinality as u(elem, ord)
         where elem is not null
      ) dedup
     where rn = 1
  );

  if p_event_id is null then
    insert into public.birth_giving_events (
      name, customer, starts_at, duration, status, organizer_profile_ids,
      created_by_profile_id, updated_by_profile_id
    )
    values (
      p_name, p_customer, p_starts_at, p_duration, 'draft', v_organizers,
      v_profile_id, v_profile_id
    )
    returning id into v_event_id;

    return v_event_id;
  end if;

  -- Update is authorized "in place": only an existing, unremoved event the
  -- caller organizes is locked and updated. A missing/removed event, or a
  -- non-organizer caller, leaves v_event_id NULL and raises 42501 (the error
  -- does not reveal whether the event exists).
  update public.birth_giving_events event
     set name = p_name,
         customer = p_customer,
         starts_at = p_starts_at,
         duration = p_duration,
         organizer_profile_ids = v_organizers,
         updated_by_profile_id = v_profile_id,
         updated_at = clock_timestamp()
   where event.id = p_event_id
     and event.removed_at is null
     and v_profile_id = any(event.organizer_profile_ids)
  returning event.id into v_event_id;

  if v_event_id is null then
    raise exception 'Only an event organizer can update this event'
      using errcode = '42501';
  end if;

  return v_event_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- birth_giving_publish_event(p_event_id uuid)
-- Validates and publishes a draft under an event lock. A past-due
-- retrospective additionally requires an explicit assignment state, at least
-- one team, at least one member per team, and no pending team result.
-- ---------------------------------------------------------------------------

create function public.birth_giving_publish_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_event public.birth_giving_events%rowtype;
  v_now timestamp with time zone;
begin
  if v_profile_id is null then
    raise exception 'An active verified beta profile is required'
      using errcode = '42501';
  end if;

  select * into v_event
    from public.birth_giving_events
   where id = p_event_id
   for update;

  if v_event.id is null
     or not v_profile_id = any(v_event.organizer_profile_ids) then
    raise exception 'Only an event organizer is authorized to publish this event'
      using errcode = '42501';
  end if;

  if v_event.status <> 'draft' or v_event.removed_at is not null then
    raise exception 'Only an active draft can be published'
      using errcode = '23514';
  end if;

  v_now := clock_timestamp();

  if v_event.starts_at <= v_now then
    if v_event.assignment_state = 'none' then
      raise exception 'A retrospective event requires an explicit assignment state'
        using errcode = '23514';
    end if;

    if not exists (
      select 1 from public.birth_giving_teams t where t.event_id = p_event_id
    ) then
      raise exception 'A retrospective event requires at least one team'
        using errcode = '23514';
    end if;

    if exists (
      select 1
        from public.birth_giving_teams t
        left join lateral (
          select count(*)::integer as member_count
            from public.birth_giving_team_members m
           where m.event_id = t.event_id and m.team_id = t.id
        ) members on true
       where t.event_id = p_event_id
         and (t.result_state = 'pending' or members.member_count < 1)
    ) then
      raise exception 'Every retrospective team requires at least one member and a resolved result state'
        using errcode = '23514';
    end if;
  end if;

  update public.birth_giving_events
     set status = 'published',
         updated_by_profile_id = v_profile_id,
         updated_at = v_now
   where id = p_event_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- birth_giving_remove_event(p_event_id uuid)
-- Organizer-only soft deletion. Idempotent: an already-removed event is a
-- no-op.
-- ---------------------------------------------------------------------------

create function public.birth_giving_remove_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_event public.birth_giving_events%rowtype;
begin
  if v_profile_id is null then
    raise exception 'An active verified beta profile is required'
      using errcode = '42501';
  end if;

  select * into v_event
    from public.birth_giving_events
   where id = p_event_id
   for update;

  if v_event.id is null
     or not v_profile_id = any(v_event.organizer_profile_ids) then
    raise exception 'Only an event organizer can remove this event'
      using errcode = '42501';
  end if;

  if v_event.removed_at is not null then
    return;
  end if;

  update public.birth_giving_events
     set removed_at = clock_timestamp(),
         removed_by_profile_id = v_profile_id,
         updated_by_profile_id = v_profile_id,
         updated_at = clock_timestamp()
   where id = p_event_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. The three public functions are executable by authenticated; the
-- private helper is not. Revoking from PUBLIC (the default on CREATE) plus a
-- defensive revoke from anon keeps an authenticated/anonymous caller from
-- calling any of them unless explicitly granted (only the three publics are).
-- ---------------------------------------------------------------------------

revoke execute on function public.birth_giving_active_profile_id() from public;
revoke execute on function public.birth_giving_active_profile_id() from anon;
revoke execute on function public.birth_giving_save_event(uuid, text, text, timestamptz, public.birth_giving_duration, uuid[]) from public;
revoke execute on function public.birth_giving_save_event(uuid, text, text, timestamptz, public.birth_giving_duration, uuid[]) from anon;
revoke execute on function public.birth_giving_publish_event(uuid) from public;
revoke execute on function public.birth_giving_publish_event(uuid) from anon;
revoke execute on function public.birth_giving_remove_event(uuid) from public;
revoke execute on function public.birth_giving_remove_event(uuid) from anon;

grant execute on function public.birth_giving_save_event(uuid, text, text, timestamptz, public.birth_giving_duration, uuid[]) to authenticated;
grant execute on function public.birth_giving_publish_event(uuid) to authenticated;
grant execute on function public.birth_giving_remove_event(uuid) to authenticated;
