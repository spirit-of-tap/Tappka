-- Custom SQL migration file, put your code below! --

-- Training sessions: guest RPCs, search, updated_at triggers, realtime broadcast.

create or replace function public.join_training_session(p_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_team uuid;
  v_session record;
  v_count integer;
begin
  if v_profile is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select team_id into v_team from public.profiles where id = v_profile and access_removed_at is null;
  if not found then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Row lock serializes concurrent joins for the same session (last-seat race).
  select id, team_id, starts_at, cancelled_at, guest_capacity into v_session
  from public.training_sessions
  where id = p_session_id and removed_at is null
  for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_session.cancelled_at is not null then raise exception 'cancelled' using errcode = 'P0001'; end if;
  if v_session.starts_at <= now() then raise exception 'already_started' using errcode = 'P0001'; end if;
  if v_team is not distinct from v_session.team_id then raise exception 'own_team' using errcode = 'P0001'; end if;

  select count(*) into v_count from public.training_session_guests where training_session_id = p_session_id;
  if exists (select 1 from public.training_session_guests where training_session_id = p_session_id and profile_id = v_profile) then
    return v_count;
  end if;
  if v_count >= v_session.guest_capacity then raise exception 'capacity_full' using errcode = 'P0001'; end if;

  insert into public.training_session_guests (training_session_id, profile_id) values (p_session_id, v_profile);
  return v_count + 1;
end;
$$;

create or replace function public.leave_training_session(p_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_session record;
  v_count integer;
begin
  if v_profile is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select id, starts_at into v_session from public.training_sessions
  where id = p_session_id and removed_at is null for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_session.starts_at <= now() then raise exception 'already_started' using errcode = 'P0001'; end if;
  delete from public.training_session_guests where training_session_id = p_session_id and profile_id = v_profile;
  select count(*) into v_count from public.training_session_guests where training_session_id = p_session_id;
  return v_count;
end;
$$;

revoke all on function public.join_training_session(uuid) from public, anon;
revoke all on function public.leave_training_session(uuid) from public, anon;
grant execute on function public.join_training_session(uuid) to authenticated;
grant execute on function public.leave_training_session(uuid) to authenticated;

create or replace function public.search_training_sessions(p_query text)
returns setof uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id
  from public.training_sessions s
  left join public.training_session_preparations p
    on p.training_session_id = s.id and p.published_at is not null
  where s.removed_at is null
    and (
      s.topic ilike '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or s.description ilike '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or p.content_text ilike '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    );
$$;

grant execute on function public.search_training_sessions(text) to authenticated;

create trigger training_sessions_updated_at_trigger before update on public.training_sessions
  for each row execute function public.handle_updated_at();
create trigger training_session_preparations_updated_at_trigger before update on public.training_session_preparations
  for each row execute function public.handle_updated_at();
create trigger training_session_reflections_updated_at_trigger before update on public.training_session_reflections
  for each row execute function public.handle_updated_at();
create trigger training_session_attendees_updated_at_trigger before update on public.training_session_attendees
  for each row execute function public.handle_updated_at();

create or replace function public.broadcast_training_session_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_profile_id uuid;
  v_event text;
  v_count integer;
begin
  if tg_table_name = 'training_session_guests' then
    if tg_op = 'DELETE' then
      v_session_id := old.training_session_id; v_profile_id := old.profile_id; v_event := 'guest_left';
    else
      v_session_id := new.training_session_id; v_profile_id := new.profile_id; v_event := 'guest_joined';
    end if;
  else
    v_session_id := new.id; v_event := 'session_updated';
  end if;

  select count(*) into v_count from public.training_session_guests where training_session_id = v_session_id;
  perform realtime.send(
    jsonb_build_object('session_id', v_session_id, 'guest_count', v_count, 'profile_id', v_profile_id),
    v_event,
    'community:training_sessions:feed',
    true
  );
  return null;
end;
$$;

create trigger training_session_guests_broadcast_trigger
  after insert or delete on public.training_session_guests
  for each row execute function public.broadcast_training_session_change();

create trigger training_sessions_broadcast_trigger
  after update on public.training_sessions
  for each row
  when (
    old.starts_at is distinct from new.starts_at
    or old.ends_at is distinct from new.ends_at
    or old.room_id is distinct from new.room_id
    or old.location_note is distinct from new.location_note
    or old.guest_capacity is distinct from new.guest_capacity
    or old.cancelled_at is distinct from new.cancelled_at
    or old.topic is distinct from new.topic
    or old.removed_at is distinct from new.removed_at
  )
  execute function public.broadcast_training_session_change();

drop policy if exists "Authenticated can receive training session feed" on realtime.messages;
create policy "Authenticated can receive training session feed" on realtime.messages
for select
to authenticated
using ((select realtime.topic()) = 'community:training_sessions:feed');

-- Soft-remove a session. SECURITY DEFINER because a plain UPDATE setting
-- removed_at fails RLS: the new row no longer passes the SELECT policy.
create or replace function public.remove_training_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_team uuid;
  v_session_team uuid;
begin
  if v_profile is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select team_id into v_session_team
  from public.training_sessions
  where id = p_session_id and removed_at is null
  for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;

  select team_id into v_team from public.profiles where id = v_profile and access_removed_at is null;
  if v_team is null or v_team is distinct from v_session_team then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.training_sessions
  set removed_at = now(), updated_by_profile_id = v_profile
  where id = p_session_id;
end;
$$;

revoke all on function public.remove_training_session(uuid) from public, anon;
grant execute on function public.remove_training_session(uuid) to authenticated;
