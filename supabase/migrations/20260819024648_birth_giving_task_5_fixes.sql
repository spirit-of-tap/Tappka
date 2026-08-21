CREATE FUNCTION public.birth_giving_update_event(
  p_event_id uuid,
  p_name text DEFAULT NULL,
  p_customer text DEFAULT NULL,
  p_starts_at timestamp with time zone DEFAULT NULL,
  p_duration public.birth_giving_duration DEFAULT NULL,
  p_minimum_team_size integer DEFAULT NULL,
  p_maximum_team_size integer DEFAULT NULL,
  p_joining_open boolean DEFAULT NULL,
  p_organizer_profile_ids uuid[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_event public.birth_giving_events%ROWTYPE;
  v_organizer_count integer;
  v_now timestamp with time zone := clock_timestamp();
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'An active verified profile is required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_event
    FROM public.birth_giving_events
   WHERE id = p_event_id
   FOR UPDATE;
  IF v_event.id IS NULL OR v_event.removed_at IS NOT NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.birth_giving_event_organizers o
        WHERE o.event_id = p_event_id AND o.profile_id = v_profile_id
     ) THEN
    RAISE EXCEPTION 'Only an event organizer is authorized to update this event' USING ERRCODE = '42501';
  END IF;
  IF v_event.status NOT IN ('draft', 'published')
     OR v_now >= v_event.starts_at + (CASE v_event.duration
          WHEN '8h'::public.birth_giving_duration THEN interval '8 hours'
          WHEN '24h'::public.birth_giving_duration THEN interval '24 hours'
        END) THEN
    RAISE EXCEPTION 'Only an active event can be updated before it has ended' USING ERRCODE = '55000';
  END IF;
  IF p_joining_open IS DISTINCT FROM v_event.joining_open
     AND p_joining_open IS NOT NULL
     AND v_now >= v_event.starts_at THEN
    RAISE EXCEPTION 'Joining can only change before the event start' USING ERRCODE = '55000';
  END IF;
  IF length(trim(coalesce(p_name, v_event.name))) = 0
     OR length(trim(coalesce(p_customer, v_event.customer))) = 0
     OR coalesce(p_minimum_team_size, v_event.minimum_team_size) < 1
     OR coalesce(p_maximum_team_size, v_event.maximum_team_size)
        < coalesce(p_minimum_team_size, v_event.minimum_team_size) THEN
    RAISE EXCEPTION 'Invalid Birth Giving event details' USING ERRCODE = '22023';
  END IF;

  IF p_organizer_profile_ids IS NOT NULL THEN
    SELECT count(DISTINCT requested_id)::integer
      INTO v_organizer_count
      FROM unnest(p_organizer_profile_ids) requested_id
      JOIN public.profiles p ON p.id = requested_id AND p.access_removed_at IS NULL;
    IF v_organizer_count = 0
       OR v_organizer_count <> cardinality(p_organizer_profile_ids)
       OR NOT (v_profile_id = ANY(p_organizer_profile_ids)) THEN
      RAISE EXCEPTION 'Event requires distinct active organizers including the caller' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.birth_giving_events
     SET name = trim(coalesce(p_name, name)),
         normalized_name = lower(regexp_replace(trim(normalize(coalesce(p_name, name), NFKC)), '[[:space:]]+', ' ', 'g')),
         customer = trim(coalesce(p_customer, customer)),
         normalized_customer = lower(regexp_replace(trim(normalize(coalesce(p_customer, customer), NFKC)), '[[:space:]]+', ' ', 'g')),
         starts_at = coalesce(p_starts_at, starts_at),
         duration = coalesce(p_duration, duration),
         minimum_team_size = coalesce(p_minimum_team_size, minimum_team_size),
         maximum_team_size = coalesce(p_maximum_team_size, maximum_team_size),
         joining_open = coalesce(p_joining_open, joining_open),
         updated_by_profile_id = v_profile_id
   WHERE id = p_event_id;

  IF p_organizer_profile_ids IS NOT NULL THEN
    DELETE FROM public.birth_giving_event_organizers o
     WHERE o.event_id = p_event_id
       AND NOT (o.profile_id = ANY(p_organizer_profile_ids));
    INSERT INTO public.birth_giving_event_organizers (
      event_id, profile_id, created_by_profile_id, updated_by_profile_id
    )
    SELECT p_event_id, requested_id, v_profile_id, v_profile_id
      FROM unnest(p_organizer_profile_ids) requested_id
    ON CONFLICT (event_id, profile_id) DO UPDATE
      SET updated_by_profile_id = EXCLUDED.updated_by_profile_id;
  END IF;

  RETURN p_event_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.birth_giving_update_event(uuid, text, text, timestamptz, public.birth_giving_duration, integer, integer, boolean, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.birth_giving_update_event(uuid, text, text, timestamptz, public.birth_giving_duration, integer, integer, boolean, uuid[]) TO authenticated;

DROP FUNCTION public.birth_giving_create_proposal(uuid, uuid, uuid, public.birth_giving_proposal_direction);

CREATE FUNCTION public.birth_giving_create_proposal(
  p_event_id uuid,
  p_team_id uuid,
  p_candidate_profile_id uuid,
  p_direction public.birth_giving_proposal_direction,
  p_acknowledge_move boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_event public.birth_giving_events%ROWTYPE;
  v_team public.birth_giving_teams%ROWTYPE;
  v_proposal_id uuid;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'An active verified profile is required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_event FROM public.birth_giving_events WHERE id = p_event_id FOR UPDATE;
  SELECT * INTO v_team
    FROM public.birth_giving_teams
   WHERE id = p_team_id AND event_id = p_event_id
   FOR UPDATE;
  IF v_event.id IS NULL OR v_event.status <> 'published' OR v_event.removed_at IS NOT NULL
     OR NOT v_event.joining_open OR clock_timestamp() >= v_event.starts_at THEN
    RAISE EXCEPTION 'Team formation is closed for this event' USING ERRCODE = '55000';
  END IF;
  IF v_team.id IS NULL OR v_team.status <> 'forming' THEN
    RAISE EXCEPTION 'Target team does not belong to the open event' USING ERRCODE = '23503';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = p_candidate_profile_id AND p.access_removed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Candidate must have an active profile' USING ERRCODE = '42501';
  END IF;

  IF p_direction = 'join_request' THEN
    IF p_candidate_profile_id <> v_profile_id THEN
      RAISE EXCEPTION 'A join request can only be created for the caller' USING ERRCODE = '42501';
    END IF;
  ELSIF p_direction = 'invitation' THEN
    IF p_candidate_profile_id = v_profile_id OR NOT EXISTS (
      SELECT 1 FROM public.birth_giving_team_members m
       WHERE m.event_id = p_event_id AND m.team_id = p_team_id AND m.profile_id = v_profile_id
    ) THEN
      RAISE EXCEPTION 'Only a target-team member can invite another profile' USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported proposal direction' USING ERRCODE = '22023';
  END IF;

  IF NOT coalesce(p_acknowledge_move, false) AND EXISTS (
    SELECT 1 FROM public.birth_giving_team_members m
     WHERE m.event_id = p_event_id
       AND m.profile_id = p_candidate_profile_id
       AND m.team_id <> p_team_id
       AND m.confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'MOVE_REQUIRES_ACKNOWLEDGEMENT' USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.birth_giving_team_proposals (
    event_id, team_id, candidate_profile_id, initiated_by_profile_id, direction,
    state, created_by_profile_id, updated_by_profile_id
  ) VALUES (
    p_event_id, p_team_id, p_candidate_profile_id, v_profile_id, p_direction,
    'pending', v_profile_id, v_profile_id
  ) RETURNING id INTO v_proposal_id;
  RETURN v_proposal_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.birth_giving_create_proposal(uuid, uuid, uuid, public.birth_giving_proposal_direction, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.birth_giving_create_proposal(uuid, uuid, uuid, public.birth_giving_proposal_direction, boolean) TO authenticated;

DROP FUNCTION public.birth_giving_resolve_proposal(uuid, text);

CREATE FUNCTION public.birth_giving_resolve_proposal(p_proposal_id uuid, p_action text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_event_id uuid;
BEGIN
  SELECT p.event_id INTO v_event_id
    FROM public.birth_giving_team_proposals p
   WHERE p.id = p_proposal_id;
  IF v_event_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_event_id::text, 0)
    );
    PERFORM 1 FROM public.birth_giving_events e
     WHERE e.id = v_event_id FOR UPDATE;
  END IF;
  PERFORM public.birth_giving_resolve_proposal_locked(p_proposal_id, p_action);
  RETURN v_event_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.birth_giving_resolve_proposal(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.birth_giving_resolve_proposal(uuid, text) TO authenticated;
