CREATE OR REPLACE FUNCTION public.birth_giving_publish_event(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_event public.birth_giving_events%ROWTYPE;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'An active verified profile is required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_event
    FROM public.birth_giving_events
   WHERE id = p_event_id
   FOR UPDATE;
  IF v_event.id IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.birth_giving_event_organizers o
        WHERE o.event_id = p_event_id AND o.profile_id = v_profile_id
     ) THEN
    RAISE EXCEPTION 'Only an event organizer is authorized to publish this draft' USING ERRCODE = '42501';
  END IF;
  IF v_event.status <> 'draft' OR v_event.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Only an active draft can be published' USING ERRCODE = '55000';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.birth_giving_event_organizers o WHERE o.event_id = p_event_id) THEN
    RAISE EXCEPTION 'At least one organizer is required' USING ERRCODE = '23514';
  END IF;

  IF v_event.starts_at <= now() THEN
    IF NOT EXISTS (SELECT 1 FROM public.birth_giving_assignments a WHERE a.event_id = p_event_id) THEN
      RAISE EXCEPTION 'A retrospective event requires an explicit assignment state' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.birth_giving_teams t WHERE t.event_id = p_event_id) THEN
      RAISE EXCEPTION 'A retrospective event requires at least one team' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1
        FROM public.birth_giving_teams t
        LEFT JOIN LATERAL (
          SELECT count(*)::integer AS member_count
            FROM public.birth_giving_team_members m
           WHERE m.event_id = t.event_id AND m.team_id = t.id
        ) members ON true
       WHERE t.event_id = p_event_id
         AND (t.result_state = 'pending'
              OR members.member_count < v_event.minimum_team_size
              OR members.member_count > v_event.maximum_team_size)
    ) THEN
      RAISE EXCEPTION 'Every retrospective team requires a result state and valid team size' USING ERRCODE = '23514';
    END IF;

    UPDATE public.birth_giving_team_proposals
       SET state = 'expired', resolved_at = now(), updated_by_profile_id = v_profile_id
     WHERE event_id = p_event_id AND state = 'pending';
    DELETE FROM public.birth_giving_looking_for_team WHERE event_id = p_event_id;
    UPDATE public.birth_giving_teams
       SET status = 'confirmed', cancelled_at = NULL, cancellation_reason = NULL,
           updated_by_profile_id = v_profile_id
     WHERE event_id = p_event_id;
    UPDATE public.birth_giving_team_members
       SET frozen_at = coalesce(frozen_at, v_event.starts_at), updated_by_profile_id = v_profile_id
     WHERE event_id = p_event_id;
  END IF;

  UPDATE public.birth_giving_events
     SET status = 'published',
         joining_open = CASE WHEN v_event.starts_at <= now() THEN false ELSE joining_open END,
         start_processed_at = CASE WHEN v_event.starts_at <= now() THEN now() ELSE start_processed_at END,
         updated_by_profile_id = v_profile_id
   WHERE id = p_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.birth_giving_correct_team(
  p_event_id uuid,
  p_team_id uuid,
  p_name text,
  p_member_profile_ids uuid[],
  p_result_state public.birth_giving_team_result_state
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_event public.birth_giving_events%ROWTYPE;
  v_team_id uuid := p_team_id;
  v_member_count integer;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'An active verified profile is required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_event FROM public.birth_giving_events WHERE id = p_event_id FOR UPDATE;
  IF v_event.id IS NULL OR v_event.removed_at IS NOT NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.birth_giving_event_organizers o
        WHERE o.event_id = p_event_id AND o.profile_id = v_profile_id
     ) THEN
    RAISE EXCEPTION 'Only an event organizer is authorized to correct historical teams' USING ERRCODE = '42501';
  END IF;
  IF v_event.starts_at > now() THEN
    RAISE EXCEPTION 'Historical team correction requires an event that has started' USING ERRCODE = '55000';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 OR p_result_state = 'pending' THEN
    RAISE EXCEPTION 'Historical teams require a name and explicit result state' USING ERRCODE = '22023';
  END IF;
  SELECT count(DISTINCT requested_id)::integer INTO v_member_count
    FROM unnest(p_member_profile_ids) requested_id
    JOIN public.profiles p ON p.id = requested_id;
  IF v_member_count = 0 OR v_member_count <> cardinality(p_member_profile_ids) THEN
    RAISE EXCEPTION 'Historical teams require distinct existing profiles' USING ERRCODE = '22023';
  END IF;
  IF v_member_count < v_event.minimum_team_size OR v_member_count > v_event.maximum_team_size THEN
    RAISE EXCEPTION 'Historical team size is outside event capacity' USING ERRCODE = '23514';
  END IF;

  IF v_team_id IS NULL THEN
    INSERT INTO public.birth_giving_teams (
      event_id, name, status, result_state, created_by_profile_id, updated_by_profile_id
    ) VALUES (
      p_event_id, trim(p_name), 'confirmed', p_result_state, v_profile_id, v_profile_id
    ) RETURNING id INTO v_team_id;
  ELSE
    PERFORM 1 FROM public.birth_giving_teams
     WHERE id = v_team_id AND event_id = p_event_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Team does not belong to the event' USING ERRCODE = '23503';
    END IF;
    UPDATE public.birth_giving_teams
       SET name = trim(p_name), status = 'confirmed', result_state = p_result_state,
           cancelled_at = NULL, cancellation_reason = NULL, updated_by_profile_id = v_profile_id
     WHERE id = v_team_id AND event_id = p_event_id;
    DELETE FROM public.birth_giving_team_members m
     WHERE m.event_id = p_event_id AND m.team_id = v_team_id
       AND NOT (m.profile_id = ANY(p_member_profile_ids));
  END IF;

  INSERT INTO public.birth_giving_team_members (
    event_id, team_id, profile_id, confirmed_at, frozen_at,
    created_by_profile_id, updated_by_profile_id
  )
  SELECT p_event_id, v_team_id, requested_id, v_event.starts_at, v_event.starts_at,
         v_profile_id, v_profile_id
    FROM unnest(p_member_profile_ids) requested_id
  ON CONFLICT (event_id, profile_id) DO UPDATE
    SET team_id = EXCLUDED.team_id,
        confirmed_at = EXCLUDED.confirmed_at,
        frozen_at = coalesce(public.birth_giving_team_members.frozen_at, EXCLUDED.frozen_at),
        updated_by_profile_id = EXCLUDED.updated_by_profile_id;
  DELETE FROM public.birth_giving_teams t
   WHERE t.event_id = p_event_id AND t.id <> v_team_id
     AND NOT EXISTS (
       SELECT 1 FROM public.birth_giving_team_members m
        WHERE m.event_id = t.event_id AND m.team_id = t.id
     );

  IF v_event.status = 'published' AND v_event.start_processed_at IS NOT NULL
     AND EXISTS (
       SELECT 1
         FROM public.birth_giving_teams t
         JOIN LATERAL (
           SELECT count(*)::integer AS member_count
             FROM public.birth_giving_team_members m
            WHERE m.event_id = t.event_id AND m.team_id = t.id
        ) members ON true
        WHERE t.event_id = p_event_id
          AND t.status = 'confirmed'
          AND members.member_count > 0
          AND (members.member_count < v_event.minimum_team_size
               OR members.member_count > v_event.maximum_team_size)
     ) THEN
    RAISE EXCEPTION 'Historical correction leaves a team outside event capacity' USING ERRCODE = '23514';
  END IF;
  RETURN v_team_id;
END;
$$;
