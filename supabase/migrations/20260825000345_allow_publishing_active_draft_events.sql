-- ---------------------------------------------------------------------------
-- Allow publishing any active draft Birth Giving event.
-- ---------------------------------------------------------------------------

create or replace function public.birth_giving_publish_event(p_event_id uuid)
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

  update public.birth_giving_events
     set status = 'published',
         updated_by_profile_id = v_profile_id,
         updated_at = v_now
   where id = p_event_id;
end;
$$;