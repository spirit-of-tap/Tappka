-- ---------------------------------------------------------------------------
-- Task 4: atomic Birth Giving team mutations.
--
-- SECURITY DEFINER functions for the three-table Birth Giving model that
-- create, synchronize, and delete teams plus their memberships. They reuse the
-- private caller helper birth_giving_active_profile_id() from the Task 3
-- migration, run with an empty fixed search_path, and schema-qualify every
-- object. Direct authenticated writes on the tables remain denied by RLS;
-- all team mutations flow through these functions.
--
-- Approved SQLSTATEs:
--   42501 authorization (covers missing/removed events too, non-leaky),
--   P0002 missing team,
--   23503 nonexistent member profile,
--   23514 inactive member profile / empty name,
--   23505 duplicate membership (profile already on another team in the event);
--        raised by the event+profile unique constraint so the whole mutation
--        rolls back atomically.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Private helper: order-preserving, NULL-dropping array deduplication. Used
-- by both mutators so the "exact supplied set vs. append-the-caller" policy
-- is computed exactly once per function. Not granted to authenticated/anon.
-- ---------------------------------------------------------------------------

create function public.birth_giving_dedupe_profile_ids(p_ids uuid[])
returns uuid[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(elem order by ord), array[]::uuid[])
    from (
      select elem, ord,
             row_number() over (partition by elem order by ord) as rn
        from unnest(coalesce(p_ids, array[]::uuid[])) with ordinality as u(elem, ord)
       where elem is not null
    ) dedup
   where rn = 1;
$$;

-- ---------------------------------------------------------------------------
-- birth_giving_create_team(p_event_id uuid, p_name text,
--                          p_member_profile_ids uuid[])
-- Organizer-only. Creates the team row (result_state 'pending', is_winner
-- false, result_files '[]', audit fields from the caller) and every
-- membership in ONE set-based INSERT, all in one transaction.
--
-- Member policy:
--   - draft retrospective: the exact supplied member set (the caller is a
--     member only if explicitly supplied),
--   - published event: the caller is always appended to the set.
-- Every member must exist (23503) and be active, i.e. not access-removed
-- (23514). The (event_id, profile_id) unique constraint makes a profile that
-- already belongs to another team in the same event raise 23505, which aborts
-- the whole transaction.
-- ---------------------------------------------------------------------------

create function public.birth_giving_create_team(
  p_event_id uuid,
  p_name text,
  p_member_profile_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_event public.birth_giving_events%rowtype;
  v_members uuid[];
  v_team_id uuid;
  v_bad_count integer;
begin
  if v_profile_id is null then
    raise exception 'An active verified beta profile is required'
      using errcode = '42501';
  end if;

  -- Organizer-only authorization under an event lock; a missing or removed
  -- event is indistinguishable from a non-organizer caller (42501).
  select * into v_event
    from public.birth_giving_events
   where id = p_event_id
   for update;

  if v_event.id is null
     or v_event.removed_at is not null
     or not v_profile_id = any(v_event.organizer_profile_ids) then
    raise exception 'Only an event organizer can create a team'
      using errcode = '42501';
  end if;

  -- Member resolution: draft uses the exact set, published always includes
  -- the caller. Both paths deduplicate order-preservingly.
  if v_event.status = 'published' then
    v_members := public.birth_giving_dedupe_profile_ids(
      array_append(coalesce(p_member_profile_ids, array[]::uuid[]), v_profile_id)
    );
  else
    v_members := public.birth_giving_dedupe_profile_ids(p_member_profile_ids);
  end if;

  select count(*) into v_bad_count
    from unnest(v_members) as u(profile_id)
    left join public.profiles p on p.id = u.profile_id
   where p.id is null;
  if v_bad_count > 0 then
    raise exception 'Every team member profile must exist'
      using errcode = '23503';
  end if;

  select count(*) into v_bad_count
    from public.profiles p
    join unnest(v_members) as u(profile_id) on u.profile_id = p.id
   where p.access_removed_at is not null;
  if v_bad_count > 0 then
    raise exception 'Every team member profile must be active'
      using errcode = '23514';
  end if;

  insert into public.birth_giving_teams (
    event_id, name, result_state, result_files, is_winner,
    created_by_profile_id, updated_by_profile_id
  )
  values (
    p_event_id, p_name, 'pending', '[]'::jsonb, false,
    v_profile_id, v_profile_id
  )
  returning id into v_team_id;

  insert into public.birth_giving_team_members (
    event_id, team_id, profile_id,
    created_by_profile_id, updated_by_profile_id
  )
  select p_event_id, v_team_id, u.profile_id, v_profile_id, v_profile_id
    from unnest(v_members) as u(profile_id);

  return v_team_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- birth_giving_update_team(p_event_id uuid, p_team_id uuid, p_name text,
--                          p_member_profile_ids uuid[], p_is_winner boolean)
-- Organizer-only. Locks the event FOR UPDATE first (serializes winner
-- changes), then locks the team. NULL arguments mean "leave unchanged".
--
-- Atomicity: name/winner/membership all commit in the one transaction.
-- Memberships are synchronized with one DELETE + one set-based INSERT; any
-- violation (23505 cross-team duplicate, 23503 unknown profile, 23514
-- inactive profile) rolls back the whole call, including the name/winner
-- change. Winner changes first clear is_winner on every other active team of
-- the event, then set the target, so the partial unique index and explicit
-- state agree even in a single call (and toggling off works).
-- ---------------------------------------------------------------------------

create function public.birth_giving_update_team(
  p_event_id uuid,
  p_team_id uuid,
  p_name text,
  p_member_profile_ids uuid[],
  p_is_winner boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_event public.birth_giving_events%rowtype;
  v_team public.birth_giving_teams%rowtype;
  v_members uuid[];
  v_bad_count integer;
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
     or v_event.removed_at is not null
     or not v_profile_id = any(v_event.organizer_profile_ids) then
    raise exception 'Only an event organizer can update a team'
      using errcode = '42501';
  end if;

  select * into v_team
    from public.birth_giving_teams
   where id = p_team_id
     and event_id = p_event_id
   for update;

  if v_team.id is null then
    raise exception 'The team does not exist in this event'
      using errcode = 'P0002';
  end if;

  -- Synchronize members first: a validation failure must roll back every
  -- subsequent change (name/winner) made in this call.
  if p_member_profile_ids is not null then
    if v_event.status = 'published' then
      v_members := public.birth_giving_dedupe_profile_ids(
        array_append(coalesce(p_member_profile_ids, array[]::uuid[]), v_profile_id)
      );
    else
      v_members := public.birth_giving_dedupe_profile_ids(p_member_profile_ids);
    end if;

    select count(*) into v_bad_count
      from unnest(v_members) as u(profile_id)
      left join public.profiles p on p.id = u.profile_id
     where p.id is null;
    if v_bad_count > 0 then
      raise exception 'Every team member profile must exist'
        using errcode = '23503';
    end if;

    select count(*) into v_bad_count
      from public.profiles p
      join unnest(v_members) as u(profile_id) on u.profile_id = p.id
     where p.access_removed_at is not null;
    if v_bad_count > 0 then
      raise exception 'Every team member profile must be active'
        using errcode = '23514';
    end if;

    delete from public.birth_giving_team_members
     where event_id = p_event_id
       and team_id = p_team_id;

    insert into public.birth_giving_team_members (
      event_id, team_id, profile_id,
      created_by_profile_id, updated_by_profile_id
    )
    select p_event_id, p_team_id, u.profile_id, v_profile_id, v_profile_id
      from unnest(v_members) as u(profile_id);
  end if;

  -- Winner replacement: clear every other active winner, then set the target.
  if p_is_winner is not null then
    if p_is_winner then
      update public.birth_giving_teams
         set is_winner = false
       where event_id = p_event_id
         and is_winner
         and cancelled_at is null
         and id <> p_team_id;
    end if;

    update public.birth_giving_teams
       set is_winner = p_is_winner,
           updated_by_profile_id = v_profile_id,
           updated_at = clock_timestamp()
     where id = p_team_id;
  end if;

  if p_name is not null then
    update public.birth_giving_teams
       set name = p_name,
           updated_by_profile_id = v_profile_id,
           updated_at = clock_timestamp()
     where id = p_team_id;
  end if;

  -- A member-only refresh still records the caller as the updater.
  if p_member_profile_ids is not null then
    update public.birth_giving_teams
       set updated_by_profile_id = v_profile_id,
           updated_at = clock_timestamp()
     where id = p_team_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- birth_giving_delete_team(p_event_id uuid, p_team_id uuid)
-- Organizer-only. Removes the team's memberships and the team atomically.
-- Deleting a non-winner team cannot conflict with the partial winner index
-- (which indexes only winner rows), so no extra handling is required.
-- ---------------------------------------------------------------------------

create function public.birth_giving_delete_team(
  p_event_id uuid,
  p_team_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_event public.birth_giving_events%rowtype;
  v_team public.birth_giving_teams%rowtype;
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
     or v_event.removed_at is not null
     or not v_profile_id = any(v_event.organizer_profile_ids) then
    raise exception 'Only an event organizer can delete a team'
      using errcode = '42501';
  end if;

  select * into v_team
    from public.birth_giving_teams
   where id = p_team_id
     and event_id = p_event_id
   for update;

  if v_team.id is null then
    raise exception 'The team does not exist in this event'
      using errcode = 'P0002';
  end if;

  delete from public.birth_giving_team_members
   where event_id = p_event_id
     and team_id = p_team_id;

  delete from public.birth_giving_teams
   where id = p_team_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. The three public mutators are executable by authenticated; the
-- private deduplication helper is not. Revoking from PUBLIC (the default on
-- CREATE) plus a defensive revoke from anon keeps an authenticated/anonymous
-- caller from calling any of them unless explicitly granted.
-- ---------------------------------------------------------------------------

revoke execute on function public.birth_giving_dedupe_profile_ids(uuid[]) from public;
revoke execute on function public.birth_giving_dedupe_profile_ids(uuid[]) from anon;
revoke execute on function public.birth_giving_create_team(uuid, text, uuid[]) from public;
revoke execute on function public.birth_giving_create_team(uuid, text, uuid[]) from anon;
revoke execute on function public.birth_giving_update_team(uuid, uuid, text, uuid[], boolean) from public;
revoke execute on function public.birth_giving_update_team(uuid, uuid, text, uuid[], boolean) from anon;
revoke execute on function public.birth_giving_delete_team(uuid, uuid) from public;
revoke execute on function public.birth_giving_delete_team(uuid, uuid) from anon;

grant execute on function public.birth_giving_create_team(uuid, text, uuid[]) to authenticated;
grant execute on function public.birth_giving_update_team(uuid, uuid, text, uuid[], boolean) to authenticated;
grant execute on function public.birth_giving_delete_team(uuid, uuid) to authenticated;