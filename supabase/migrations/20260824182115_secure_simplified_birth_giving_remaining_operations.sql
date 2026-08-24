-- ---------------------------------------------------------------------------
-- Task 5: secure Birth Giving assignment, result, and reflection operations.
--
-- SECURITY DEFINER functions for the three-table Birth Giving model plus the
-- updated-at triggers and the asymmetric table grants.
--
-- Conventions shared with Tasks 3/4:
--   - Every function resolves the caller through birth_giving_active_profile_id()
--     (active, verified, beta) and fails with 42501 when it is absent.
--   - All run SECURITY DEFINER with set search_path = '', schema-qualify every
--     object, and record audit fields from the caller (never from parameters).
--   - Mutations lock the event row FOR UPDATE, then the team row FOR UPDATE,
--     in that fixed order, so embedded-JSON read-modify-write is safe.
--   - None of the six new functions accept caller-supplied ids, uploader ids,
--     or timestamps: uploaded_at/uploaded_by are always derived from the caller.
--
-- Approved SQLSTATEs used here:
--   42501 authorization (organizer / team-member requirements, non-leaky),
--   P0002 missing team or result file,
--   23503 invalid profile relationship,
--   23514 invalid assignment/result state, path, or metadata.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- birth_giving_set_assignment(p_event_id uuid,
--                             p_state birth_giving_assignment_state,
--                             p_storage_path text,
--                             p_original_file_name text,
--                             p_mime_type text,
--                             p_file_size bigint) RETURNS text
-- Organizer-only present/missing assignment transition under an event lock.
-- 'present' requires complete, valid metadata and a storage path placed under
-- the exact `birth-giving/assignments/<event_id>/` prefix (traversal is
-- rejected); 'missing' clears every assignment column back to NULL. 'none' is
-- a creation-time state and is never a valid transition target.
-- Returns the previous assignment storage path, if any, so the route can
-- delete the displaced object after the database commit; otherwise NULL.
-- ---------------------------------------------------------------------------

create function public.birth_giving_set_assignment(
  p_event_id uuid,
  p_state public.birth_giving_assignment_state,
  p_storage_path text,
  p_original_file_name text,
  p_mime_type text,
  p_file_size bigint
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_event public.birth_giving_events%rowtype;
  v_previous_path text;
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
    raise exception 'Only an event organizer can manage the assignment'
      using errcode = '42501';
  end if;

  v_previous_path := v_event.assignment_storage_path;

  if p_state = 'present' then
    -- The path must sit under this event's own prefix and must not traverse
    -- out of it. The column-level check repeats the prefix rule; the explicit
    -- '..' rejection closes the traversal hole the check cannot express.
    if p_storage_path is null
       or length(trim(p_storage_path)) = 0
       or p_storage_path like '%..%'
       or p_storage_path not like 'birth-giving/assignments/' || v_event.id::text || '/%' then
      raise exception 'The assignment path must live under the event prefix'
        using errcode = '23514';
    end if;

    if p_original_file_name is null
       or length(trim(p_original_file_name)) = 0
       or p_mime_type is null
       or length(trim(p_mime_type)) = 0
       or p_file_size is null
       or p_file_size <= 0 then
      raise exception 'Assignment metadata must be complete and valid'
        using errcode = '23514';
    end if;

    update public.birth_giving_events
       set assignment_state = 'present',
           assignment_storage_path = p_storage_path,
           assignment_file_name = p_original_file_name,
           assignment_mime_type = p_mime_type,
           assignment_file_size = p_file_size,
           assignment_uploaded_at = clock_timestamp(),
           assignment_uploaded_by_profile_id = v_profile_id,
           updated_by_profile_id = v_profile_id,
           updated_at = clock_timestamp()
     where id = p_event_id;
  elsif p_state = 'missing' then
    update public.birth_giving_events
       set assignment_state = 'missing',
           assignment_storage_path = null,
           assignment_file_name = null,
           assignment_mime_type = null,
           assignment_file_size = null,
           assignment_uploaded_at = null,
           assignment_uploaded_by_profile_id = null,
           updated_by_profile_id = v_profile_id,
           updated_at = clock_timestamp()
     where id = p_event_id;
  else
    raise exception 'Only present or missing assignment transitions are supported'
      using errcode = '23514';
  end if;

  return v_previous_path;
end;
$$;

-- ---------------------------------------------------------------------------
-- birth_giving_get_visible_assignment(p_event_id uuid)
-- RETURNS TABLE(assignment_state, assignment_storage_path, assignment_file_name,
--               assignment_mime_type, assignment_file_size, assignment_uploaded_at,
--               assignment_uploaded_by_profile_id)
-- Enforces the assignment embargo. An organizer always receives the real row.
-- A non-organizer receives the real row only once starts_at has arrived
-- (starts_at <= now()); before that the function returns a fully blurred row
-- ('none' plus NULL metadata) so the caller cannot learn whether an assignment
-- even exists. Nonexistent and removed events return no row at all.
-- ---------------------------------------------------------------------------

create function public.birth_giving_get_visible_assignment(p_event_id uuid)
returns table (
  assignment_state public.birth_giving_assignment_state,
  assignment_storage_path text,
  assignment_file_name text,
  assignment_mime_type text,
  assignment_file_size bigint,
  assignment_uploaded_at timestamp with time zone,
  assignment_uploaded_by_profile_id uuid
)
language plpgsql
stable
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
   where id = p_event_id;

  -- No row for events that do not exist or have been removed.
  if v_event.id is null or v_event.removed_at is not null then
    return;
  end if;

  if v_profile_id = any(v_event.organizer_profile_ids)
     or v_event.starts_at <= now() then
    return query
      select v_event.assignment_state,
             v_event.assignment_storage_path,
             v_event.assignment_file_name,
             v_event.assignment_mime_type,
             v_event.assignment_file_size,
             v_event.assignment_uploaded_at,
             v_event.assignment_uploaded_by_profile_id;
    return;
  end if;

  -- Embargo: before starts_at a non-organizer sees a blurred row that is
  -- indistinguishable from an event that has no assignment at all.
  return query
    select 'none'::public.birth_giving_assignment_state,
           null::text,
           null::text,
           null::text,
           null::bigint,
           null::timestamp with time zone,
           null::uuid;
end;
$$;

-- ---------------------------------------------------------------------------
-- birth_giving_add_result_file(p_event_id uuid, p_team_id uuid,
--                              p_storage_path text, p_original_file_name text,
--                              p_mime_type text, p_file_size bigint) RETURNS uuid
-- Appends one result-file entry to the team's result_files JSON array.
-- Authorized for an event organizer or a member of the matching team (the
-- SQL mirror of canUploadResults). The event row is locked before the team
-- row, then the array is rebuilt from the freshly locked value, so concurrent
-- appends serialize on the team lock and never overwrite each other. The new
-- id is server-generated and uploaded_at/uploaded_by come from the caller.
-- Returns the new file id.
-- ---------------------------------------------------------------------------

create function public.birth_giving_add_result_file(
  p_event_id uuid,
  p_team_id uuid,
  p_storage_path text,
  p_original_file_name text,
  p_mime_type text,
  p_file_size bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_event public.birth_giving_events%rowtype;
  v_team public.birth_giving_teams%rowtype;
  v_file_id text;
begin
  if v_profile_id is null then
    raise exception 'An active verified beta profile is required'
      using errcode = '42501';
  end if;

  select * into v_event
    from public.birth_giving_events
   where id = p_event_id
   for update;

  if v_event.id is null or v_event.removed_at is not null then
    raise exception 'Result changes require an organizer or matching team membership'
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

  if not (v_profile_id = any(v_event.organizer_profile_ids))
     and not exists (
       select 1
         from public.birth_giving_team_members membership
        where membership.event_id = p_event_id
          and membership.team_id = p_team_id
          and membership.profile_id = v_profile_id
     ) then
    raise exception 'Result changes require an organizer or matching team membership'
      using errcode = '42501';
  end if;

  if p_storage_path is null
     or length(trim(p_storage_path)) = 0
     or p_storage_path like '%..%'
     or p_storage_path not like 'birth-giving/results/' || p_event_id::text || '/' || p_team_id::text || '/%' then
    raise exception 'Result paths must live under the event and team prefix'
      using errcode = '23514';
  end if;

  if p_original_file_name is null
     or length(trim(p_original_file_name)) = 0
     or p_mime_type is null
     or length(trim(p_mime_type)) = 0
     or p_file_size is null
     or p_file_size <= 0 then
    raise exception 'Result metadata must be complete and valid'
      using errcode = '23514';
  end if;

  v_file_id := gen_random_uuid()::text;

  update public.birth_giving_teams
     set result_files = v_team.result_files || jsonb_build_object(
           'id', v_file_id,
           'storage_path', p_storage_path,
           'original_file_name', p_original_file_name,
           'mime_type', p_mime_type,
           'file_size', p_file_size,
           'uploaded_at', clock_timestamp(),
           'uploaded_by_profile_id', v_profile_id
         ),
         result_state = 'present',
         updated_by_profile_id = v_profile_id,
         updated_at = clock_timestamp()
   where id = p_team_id;

  return v_file_id::uuid;
end;
$$;

-- ---------------------------------------------------------------------------
-- birth_giving_remove_result_file(p_result_file_id uuid) RETURNS text
-- Locates the team whose result_files array contains the file, locks its event
-- then team, and re-verifies the entry under the lock. Authorized for an
-- organizer or a member of that team. Removes the entry; when it was the last
-- file the team returns to 'pending'. Returns the removed storage path so the
-- route can delete the object. An unknown id raises P0002.
-- ---------------------------------------------------------------------------

create function public.birth_giving_remove_result_file(p_result_file_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_event_id uuid;
  v_team_id uuid;
  v_event public.birth_giving_events%rowtype;
  v_team public.birth_giving_teams%rowtype;
  v_files jsonb;
  v_removed_path text;
begin
  if v_profile_id is null then
    raise exception 'An active verified beta profile is required'
      using errcode = '42501';
  end if;

  -- Find the owning team without locking; the lock below re-verifies, so a
  -- concurrent removal of the same file is still caught (P0002).
  select t.event_id, t.id
    into v_event_id, v_team_id
    from public.birth_giving_teams t
    join public.birth_giving_events event_row on event_row.id = t.event_id
   where event_row.removed_at is null
     and t.result_files @> jsonb_build_array(jsonb_build_object('id', p_result_file_id::text))
   order by t.id
   limit 1;

  if v_team_id is null then
    raise exception 'No result file with this id exists'
      using errcode = 'P0002';
  end if;

  select * into v_event
    from public.birth_giving_events
   where id = v_event_id
   for update;

  select * into v_team
    from public.birth_giving_teams
   where id = v_team_id
     and event_id = v_event_id
   for update;

  if v_team.id is null then
    raise exception 'No result file with this id exists'
      using errcode = 'P0002';
  end if;

  if not (v_profile_id = any(v_event.organizer_profile_ids))
     and not exists (
       select 1
         from public.birth_giving_team_members membership
        where membership.event_id = v_event_id
          and membership.team_id = v_team_id
          and membership.profile_id = v_profile_id
     ) then
    raise exception 'Result changes require an organizer or matching team membership'
      using errcode = '42501';
  end if;

  select entry->>'storage_path' into v_removed_path
    from jsonb_array_elements(v_team.result_files) as entry
   where entry->>'id' = p_result_file_id::text;

  if v_removed_path is null then
    raise exception 'No result file with this id exists'
      using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(entry), '[]'::jsonb) into v_files
    from jsonb_array_elements(v_team.result_files) as entry
   where entry->>'id' <> p_result_file_id::text;

  update public.birth_giving_teams
     set result_files = v_files,
         result_state = case
           when jsonb_array_length(v_files) = 0 then 'pending'::public.birth_giving_team_result_state
           else 'present'::public.birth_giving_team_result_state
         end,
         updated_by_profile_id = v_profile_id,
         updated_at = clock_timestamp()
   where id = v_team_id;

  return v_removed_path;
end;
$$;

-- ---------------------------------------------------------------------------
-- birth_giving_mark_result_missing(p_event_id uuid, p_team_id uuid) RETURNS text[]
-- Authorized for an organizer or a member of the team. Sets the team's
-- result_state to 'missing', clears result_files to '[]', and returns every
-- previously present storage path so the route can delete the objects.
-- ---------------------------------------------------------------------------

create function public.birth_giving_mark_result_missing(
  p_event_id uuid,
  p_team_id uuid
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_event public.birth_giving_events%rowtype;
  v_team public.birth_giving_teams%rowtype;
  v_paths text[];
begin
  if v_profile_id is null then
    raise exception 'An active verified beta profile is required'
      using errcode = '42501';
  end if;

  select * into v_event
    from public.birth_giving_events
   where id = p_event_id
   for update;

  if v_event.id is null or v_event.removed_at is not null then
    raise exception 'Result changes require an organizer or matching team membership'
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

  if not (v_profile_id = any(v_event.organizer_profile_ids))
     and not exists (
       select 1
         from public.birth_giving_team_members membership
        where membership.event_id = p_event_id
          and membership.team_id = p_team_id
          and membership.profile_id = v_profile_id
     ) then
    raise exception 'Result changes require an organizer or matching team membership'
      using errcode = '42501';
  end if;

  select coalesce(array_agg(entry->>'storage_path'), '{}'::text[]) into v_paths
    from jsonb_array_elements(v_team.result_files) as entry;

  update public.birth_giving_teams
     set result_state = 'missing',
         result_files = '[]'::jsonb,
         updated_by_profile_id = v_profile_id,
         updated_at = clock_timestamp()
   where id = p_team_id;

  return v_paths;
end;
$$;

-- ---------------------------------------------------------------------------
-- birth_giving_upsert_reflection(p_event_id uuid, p_contribution text,
--                                p_learning text) RETURNS void
-- The caller must hold a membership in an active (non-cancelled) team of a
-- non-removed event. Only the caller's own membership row is updated, and only
-- its reflection fields; submitted_at is derived from the caller's clock and
-- updated_by records the caller. Non-leaky: non-members, removed events, and
-- cancelled-team members are all indistinguishable 42501.
-- ---------------------------------------------------------------------------

create function public.birth_giving_upsert_reflection(
  p_event_id uuid,
  p_contribution text,
  p_learning text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_member_id uuid;
begin
  if v_profile_id is null then
    raise exception 'An active verified beta profile is required'
      using errcode = '42501';
  end if;

  -- The membership check constraint stores both fields or neither; a submit
  -- always carries both, so both must be present and non-empty.
  if p_contribution is null
     or length(trim(p_contribution)) = 0
     or p_learning is null
     or length(trim(p_learning)) = 0 then
    raise exception 'Both reflection fields are required and must be non-empty'
      using errcode = '23514';
  end if;

  update public.birth_giving_team_members member
     set reflection_contribution = p_contribution,
         reflection_learning = p_learning,
         reflection_submitted_at = clock_timestamp(),
         updated_by_profile_id = v_profile_id,
         updated_at = clock_timestamp()
    from public.birth_giving_teams team
    join public.birth_giving_events event_row on event_row.id = team.event_id
   where member.event_id = p_event_id
     and member.profile_id = v_profile_id
     and member.team_id = team.id
     and team.cancelled_at is null
     and event_row.removed_at is null
   returning member.id into v_member_id;

  if v_member_id is null then
    raise exception 'Only a member of an active team can submit a reflection'
      using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers: restore the handle_updated_at() BEFORE UPDATE triggers on all
-- three tables (the staging drop removed the legacy table triggers; the new
-- tables never received fresh ones).
-- ---------------------------------------------------------------------------

create trigger birth_giving_events_updated_at_trigger
  before update on public.birth_giving_events
  for each row execute function public.handle_updated_at();

create trigger birth_giving_teams_updated_at_trigger
  before update on public.birth_giving_teams
  for each row execute function public.handle_updated_at();

create trigger birth_giving_team_members_updated_at_trigger
  before update on public.birth_giving_team_members
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Grants. Direct authenticated writes are denied by revoking every table
-- privilege from anon and authenticated and granting back only the SELECT the
-- read path needs:
--   - teams and team_members: SELECT on all columns,
--   - events: SELECT only on the safe columns; the seven assignment columns
--     stay out of reach so assignment metadata is reachable exclusively
--     through birth_giving_get_visible_assignment.
-- The six public functions are executable by authenticated; the private
-- helper birth_giving_active_profile_id() stays revoked from authenticated
-- and anon (PUBLIC lost EXECUTE at creation in Task 3). service_role keeps its
-- full privileges.
-- ---------------------------------------------------------------------------

revoke all on table public.birth_giving_events from anon, authenticated;
revoke all on table public.birth_giving_teams from anon, authenticated;
revoke all on table public.birth_giving_team_members from anon, authenticated;

grant select on public.birth_giving_teams to authenticated;
grant select on public.birth_giving_team_members to authenticated;

grant select (id, name, customer, starts_at, duration, status, organizer_profile_ids,
              removed_at, removed_by_profile_id, created_at, updated_at,
              created_by_profile_id, updated_by_profile_id)
  on public.birth_giving_events to authenticated;

revoke execute on function public.birth_giving_set_assignment(uuid, public.birth_giving_assignment_state, text, text, text, bigint) from public;
revoke execute on function public.birth_giving_set_assignment(uuid, public.birth_giving_assignment_state, text, text, text, bigint) from anon;
revoke execute on function public.birth_giving_get_visible_assignment(uuid) from public;
revoke execute on function public.birth_giving_get_visible_assignment(uuid) from anon;
revoke execute on function public.birth_giving_add_result_file(uuid, uuid, text, text, text, bigint) from public;
revoke execute on function public.birth_giving_add_result_file(uuid, uuid, text, text, text, bigint) from anon;
revoke execute on function public.birth_giving_remove_result_file(uuid) from public;
revoke execute on function public.birth_giving_remove_result_file(uuid) from anon;
revoke execute on function public.birth_giving_mark_result_missing(uuid, uuid) from public;
revoke execute on function public.birth_giving_mark_result_missing(uuid, uuid) from anon;
revoke execute on function public.birth_giving_upsert_reflection(uuid, text, text) from public;
revoke execute on function public.birth_giving_upsert_reflection(uuid, text, text) from anon;

grant execute on function public.birth_giving_set_assignment(uuid, public.birth_giving_assignment_state, text, text, text, bigint) to authenticated;
grant execute on function public.birth_giving_get_visible_assignment(uuid) to authenticated;
grant execute on function public.birth_giving_add_result_file(uuid, uuid, text, text, text, bigint) to authenticated;
grant execute on function public.birth_giving_remove_result_file(uuid) to authenticated;
grant execute on function public.birth_giving_mark_result_missing(uuid, uuid) to authenticated;
grant execute on function public.birth_giving_upsert_reflection(uuid, text, text) to authenticated;