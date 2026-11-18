-- Custom SQL migration file, put your code below! --
-- Training sessions: facilitator removes a guest (cross) from a session's Crossy list.
-- Crosses join/leave only via join_training_session / leave_training_session, so the
-- facilitator-initiated removal is also an RPC, not a direct table write.

create or replace function public.remove_training_session_guest(p_session_id uuid, p_profile_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_facilitator uuid;
  v_session record;
  v_count integer;
begin
  select s.id, s.starts_at into v_session
  from public.training_sessions s
  where s.id = p_session_id and s.removed_at is null
  for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;

  if v_session.starts_at <= now() then raise exception 'already_started' using errcode = 'P0001'; end if;

  select id into v_facilitator
  from public.training_session_facilitators
  where training_session_id = p_session_id and profile_id = public.current_profile_id()
  limit 1;
  if v_facilitator is null and not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.training_session_guests
  where training_session_id = p_session_id and profile_id = p_profile_id;

  select count(*) into v_count from public.training_session_guests where training_session_id = p_session_id;
  return v_count;
end;
$$;

revoke all on function public.remove_training_session_guest(uuid, uuid) from public, anon;
grant execute on function public.remove_training_session_guest(uuid, uuid) to authenticated;
