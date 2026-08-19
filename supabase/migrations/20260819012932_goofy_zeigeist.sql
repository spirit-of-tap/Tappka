CREATE OR REPLACE FUNCTION public.birth_giving_active_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT p.id
  FROM public.profiles p
  JOIN public.users u ON u.id = p.user_id
  WHERE u.auth_user_id = (SELECT auth.uid())
    AND u.verified_work_email IS NOT NULL
    AND p.access_removed_at IS NULL
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.birth_giving_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER birth_giving_events_set_updated_at
BEFORE UPDATE ON public.birth_giving_events
FOR EACH ROW EXECUTE FUNCTION public.birth_giving_set_updated_at();
CREATE TRIGGER birth_giving_event_organizers_set_updated_at
BEFORE UPDATE ON public.birth_giving_event_organizers
FOR EACH ROW EXECUTE FUNCTION public.birth_giving_set_updated_at();
CREATE TRIGGER birth_giving_assignments_set_updated_at
BEFORE UPDATE ON public.birth_giving_assignments
FOR EACH ROW EXECUTE FUNCTION public.birth_giving_set_updated_at();
CREATE TRIGGER birth_giving_teams_set_updated_at
BEFORE UPDATE ON public.birth_giving_teams
FOR EACH ROW EXECUTE FUNCTION public.birth_giving_set_updated_at();
CREATE TRIGGER birth_giving_team_members_set_updated_at
BEFORE UPDATE ON public.birth_giving_team_members
FOR EACH ROW EXECUTE FUNCTION public.birth_giving_set_updated_at();
CREATE TRIGGER birth_giving_team_proposals_set_updated_at
BEFORE UPDATE ON public.birth_giving_team_proposals
FOR EACH ROW EXECUTE FUNCTION public.birth_giving_set_updated_at();
CREATE TRIGGER birth_giving_looking_for_team_set_updated_at
BEFORE UPDATE ON public.birth_giving_looking_for_team
FOR EACH ROW EXECUTE FUNCTION public.birth_giving_set_updated_at();
CREATE TRIGGER birth_giving_team_result_files_set_updated_at
BEFORE UPDATE ON public.birth_giving_team_result_files
FOR EACH ROW EXECUTE FUNCTION public.birth_giving_set_updated_at();
CREATE TRIGGER birth_giving_reflections_set_updated_at
BEFORE UPDATE ON public.birth_giving_reflections
FOR EACH ROW EXECUTE FUNCTION public.birth_giving_set_updated_at();
CREATE TRIGGER birth_giving_email_deliveries_set_updated_at
BEFORE UPDATE ON public.birth_giving_email_deliveries
FOR EACH ROW EXECUTE FUNCTION public.birth_giving_set_updated_at();

CREATE OR REPLACE FUNCTION public.birth_giving_upsert_draft(
  p_event_id uuid,
  p_name text,
  p_customer text,
  p_starts_at timestamptz,
  p_duration public.birth_giving_duration,
  p_minimum_team_size integer,
  p_maximum_team_size integer,
  p_joining_open boolean,
  p_organizer_profile_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_event_id uuid;
  v_organizer_count integer;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'An active verified profile is required' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0
     OR p_customer IS NULL OR length(trim(p_customer)) = 0
     OR p_starts_at IS NULL OR p_duration IS NULL OR p_joining_open IS NULL
     OR p_minimum_team_size < 1 OR p_maximum_team_size < p_minimum_team_size THEN
    RAISE EXCEPTION 'Invalid Birth Giving draft details' USING ERRCODE = '22023';
  END IF;

  SELECT count(DISTINCT requested_id)::integer
    INTO v_organizer_count
    FROM unnest(p_organizer_profile_ids) requested_id
    JOIN public.profiles p ON p.id = requested_id AND p.access_removed_at IS NULL;
  IF v_organizer_count = 0
     OR v_organizer_count <> cardinality(p_organizer_profile_ids)
     OR NOT (v_profile_id = ANY(p_organizer_profile_ids)) THEN
    RAISE EXCEPTION 'Draft requires distinct active organizers including the caller' USING ERRCODE = '22023';
  END IF;

  IF p_event_id IS NULL THEN
    INSERT INTO public.birth_giving_events (
      name, normalized_name, customer, normalized_customer, starts_at, duration,
      minimum_team_size, maximum_team_size, joining_open, status,
      created_by_profile_id, updated_by_profile_id
    ) VALUES (
      trim(p_name), lower(regexp_replace(trim(normalize(p_name, NFKC)), '[[:space:]]+', ' ', 'g')),
      trim(p_customer), lower(regexp_replace(trim(normalize(p_customer, NFKC)), '[[:space:]]+', ' ', 'g')),
      p_starts_at, p_duration, p_minimum_team_size, p_maximum_team_size, p_joining_open,
      'draft', v_profile_id, v_profile_id
    ) RETURNING id INTO v_event_id;
  ELSE
    SELECT e.id INTO v_event_id
      FROM public.birth_giving_events e
     WHERE e.id = p_event_id
     FOR UPDATE;
    IF v_event_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.birth_giving_event_organizers o
          WHERE o.event_id = v_event_id AND o.profile_id = v_profile_id
       ) THEN
      RAISE EXCEPTION 'Only an event organizer is authorized to update this draft' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.birth_giving_events e
       WHERE e.id = v_event_id AND e.status = 'draft' AND e.removed_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Only an active draft can be updated' USING ERRCODE = '55000';
    END IF;

    UPDATE public.birth_giving_events
       SET name = trim(p_name),
           normalized_name = lower(regexp_replace(trim(normalize(p_name, NFKC)), '[[:space:]]+', ' ', 'g')),
           customer = trim(p_customer),
           normalized_customer = lower(regexp_replace(trim(normalize(p_customer, NFKC)), '[[:space:]]+', ' ', 'g')),
           starts_at = p_starts_at,
           duration = p_duration,
           minimum_team_size = p_minimum_team_size,
           maximum_team_size = p_maximum_team_size,
           joining_open = p_joining_open,
           updated_by_profile_id = v_profile_id
     WHERE id = v_event_id;

    DELETE FROM public.birth_giving_event_organizers o
     WHERE o.event_id = v_event_id
       AND NOT (o.profile_id = ANY(p_organizer_profile_ids));
  END IF;

  INSERT INTO public.birth_giving_event_organizers (
    event_id, profile_id, created_by_profile_id, updated_by_profile_id
  )
  SELECT v_event_id, requested_id, v_profile_id, v_profile_id
    FROM unnest(p_organizer_profile_ids) requested_id
  ON CONFLICT (event_id, profile_id) DO UPDATE
    SET updated_by_profile_id = EXCLUDED.updated_by_profile_id;

  RETURN v_event_id;
END;
$$;

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
  END IF;

  UPDATE public.birth_giving_events
     SET status = 'published', updated_by_profile_id = v_profile_id
   WHERE id = p_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.birth_giving_set_looking_for_team(
  p_event_id uuid,
  p_looking boolean
)
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
  SELECT * INTO v_event FROM public.birth_giving_events WHERE id = p_event_id FOR UPDATE;
  IF v_event.id IS NULL OR v_event.status <> 'published' OR v_event.removed_at IS NOT NULL
     OR NOT v_event.joining_open OR now() >= v_event.starts_at THEN
    RAISE EXCEPTION 'Team formation is closed for this event' USING ERRCODE = '55000';
  END IF;
  IF p_looking AND EXISTS (
    SELECT 1 FROM public.birth_giving_team_members m
     WHERE m.event_id = p_event_id AND m.profile_id = v_profile_id
  ) THEN
    RAISE EXCEPTION 'Confirmed members cannot look for a team' USING ERRCODE = '23505';
  END IF;

  IF p_looking THEN
    INSERT INTO public.birth_giving_looking_for_team (
      event_id, profile_id, created_by_profile_id, updated_by_profile_id
    ) VALUES (p_event_id, v_profile_id, v_profile_id, v_profile_id)
    ON CONFLICT (event_id, profile_id) DO UPDATE
      SET updated_by_profile_id = EXCLUDED.updated_by_profile_id;
  ELSE
    DELETE FROM public.birth_giving_looking_for_team
     WHERE event_id = p_event_id AND profile_id = v_profile_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.birth_giving_create_team(p_event_id uuid, p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_event public.birth_giving_events%ROWTYPE;
  v_team_id uuid;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'An active verified profile is required' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Team name is required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_event FROM public.birth_giving_events WHERE id = p_event_id FOR UPDATE;
  IF v_event.id IS NULL OR v_event.status <> 'published' OR v_event.removed_at IS NOT NULL
     OR NOT v_event.joining_open OR now() >= v_event.starts_at THEN
    RAISE EXCEPTION 'Team formation is closed for this event' USING ERRCODE = '55000';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.birth_giving_team_members m
     WHERE m.event_id = p_event_id AND m.profile_id = v_profile_id
  ) THEN
    RAISE EXCEPTION 'Profile already belongs to a team in this event' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.birth_giving_teams (
    event_id, name, status, result_state, created_by_profile_id, updated_by_profile_id
  ) VALUES (p_event_id, trim(p_name), 'forming', 'pending', v_profile_id, v_profile_id)
  RETURNING id INTO v_team_id;
  INSERT INTO public.birth_giving_team_members (
    event_id, team_id, profile_id, created_by_profile_id, updated_by_profile_id
  ) VALUES (p_event_id, v_team_id, v_profile_id, v_profile_id, v_profile_id);
  DELETE FROM public.birth_giving_looking_for_team
   WHERE event_id = p_event_id AND profile_id = v_profile_id;
  RETURN v_team_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.birth_giving_create_proposal(
  p_event_id uuid,
  p_team_id uuid,
  p_candidate_profile_id uuid,
  p_direction public.birth_giving_proposal_direction
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
     OR NOT v_event.joining_open OR now() >= v_event.starts_at THEN
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

  INSERT INTO public.birth_giving_team_proposals (
    event_id, team_id, candidate_profile_id, initiated_by_profile_id, direction,
    state, created_by_profile_id, updated_by_profile_id
  ) VALUES (
    p_event_id, p_team_id, p_candidate_profile_id, v_profile_id, p_direction,
    'pending', v_profile_id, v_profile_id
  ) RETURNING id INTO v_proposal_id;
  RETURN v_proposal_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.birth_giving_resolve_proposal(
  p_proposal_id uuid,
  p_action text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_proposal public.birth_giving_team_proposals%ROWTYPE;
  v_event public.birth_giving_events%ROWTYPE;
  v_old_team_id uuid;
  v_member_count integer;
  v_state public.birth_giving_proposal_state;
  v_authorized boolean := false;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'An active verified profile is required' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('accept', 'reject', 'cancel') THEN
    RAISE EXCEPTION 'Unsupported proposal action' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_proposal
    FROM public.birth_giving_team_proposals
   WHERE id = p_proposal_id
   FOR UPDATE;
  IF v_proposal.id IS NULL OR v_proposal.state <> 'pending' THEN
    RAISE EXCEPTION 'Proposal is missing or already resolved' USING ERRCODE = '55000';
  END IF;
  SELECT * INTO v_event
    FROM public.birth_giving_events
   WHERE id = v_proposal.event_id
   FOR UPDATE;
  IF v_event.status <> 'published' OR v_event.removed_at IS NOT NULL
     OR NOT v_event.joining_open OR now() >= v_event.starts_at THEN
    RAISE EXCEPTION 'Team formation is closed for this event' USING ERRCODE = '55000';
  END IF;

  PERFORM 1
    FROM public.birth_giving_teams t
   WHERE t.event_id = v_proposal.event_id
     AND (t.id = v_proposal.team_id OR t.id = (
       SELECT m.team_id FROM public.birth_giving_team_members m
        WHERE m.event_id = v_proposal.event_id AND m.profile_id = v_proposal.candidate_profile_id
     ))
   ORDER BY t.id
   FOR UPDATE;

  IF p_action = 'cancel' THEN
    v_authorized := v_profile_id = v_proposal.initiated_by_profile_id;
    v_state := 'cancelled';
  ELSIF v_proposal.direction = 'invitation' THEN
    v_authorized := v_profile_id = v_proposal.candidate_profile_id;
    v_state := CASE WHEN p_action = 'accept' THEN 'accepted' ELSE 'rejected' END;
  ELSE
    v_authorized := EXISTS (
      SELECT 1 FROM public.birth_giving_team_members m
       WHERE m.event_id = v_proposal.event_id
         AND m.team_id = v_proposal.team_id
         AND m.profile_id = v_profile_id
    );
    v_state := CASE WHEN p_action = 'accept' THEN 'accepted' ELSE 'rejected' END;
  END IF;
  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Caller is not authorized to resolve this proposal' USING ERRCODE = '42501';
  END IF;

  IF p_action = 'accept' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = v_proposal.candidate_profile_id AND p.access_removed_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Candidate no longer has an active profile' USING ERRCODE = '42501';
    END IF;
    SELECT count(*)::integer INTO v_member_count
      FROM public.birth_giving_team_members m
     WHERE m.event_id = v_proposal.event_id AND m.team_id = v_proposal.team_id;
    SELECT m.team_id INTO v_old_team_id
      FROM public.birth_giving_team_members m
     WHERE m.event_id = v_proposal.event_id AND m.profile_id = v_proposal.candidate_profile_id;
    IF v_old_team_id IS DISTINCT FROM v_proposal.team_id
       AND v_member_count >= v_event.maximum_team_size THEN
      RAISE EXCEPTION 'Target team is at maximum capacity' USING ERRCODE = '23514';
    END IF;

    IF v_old_team_id IS NULL THEN
      INSERT INTO public.birth_giving_team_members (
        event_id, team_id, profile_id, created_by_profile_id, updated_by_profile_id
      ) VALUES (
        v_proposal.event_id, v_proposal.team_id, v_proposal.candidate_profile_id,
        v_profile_id, v_profile_id
      );
    ELSE
      UPDATE public.birth_giving_team_members
         SET team_id = v_proposal.team_id,
             confirmed_at = now(),
             updated_by_profile_id = v_profile_id
       WHERE event_id = v_proposal.event_id
         AND profile_id = v_proposal.candidate_profile_id;
    END IF;

    DELETE FROM public.birth_giving_looking_for_team
     WHERE event_id = v_proposal.event_id AND profile_id = v_proposal.candidate_profile_id;
    UPDATE public.birth_giving_team_proposals
       SET state = 'cancelled', resolved_by_profile_id = v_profile_id,
           resolved_at = now(), updated_by_profile_id = v_profile_id
     WHERE event_id = v_proposal.event_id
       AND candidate_profile_id = v_proposal.candidate_profile_id
       AND state = 'pending' AND id <> v_proposal.id;
    IF v_old_team_id IS NOT NULL AND v_old_team_id <> v_proposal.team_id
       AND NOT EXISTS (
         SELECT 1 FROM public.birth_giving_team_members m
          WHERE m.event_id = v_proposal.event_id AND m.team_id = v_old_team_id
       ) THEN
      DELETE FROM public.birth_giving_teams
       WHERE event_id = v_proposal.event_id AND id = v_old_team_id;
    END IF;
  END IF;

  UPDATE public.birth_giving_team_proposals
     SET state = v_state, resolved_by_profile_id = v_profile_id,
         resolved_at = now(), updated_by_profile_id = v_profile_id
   WHERE id = v_proposal.id;
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
        frozen_at = EXCLUDED.frozen_at,
        updated_by_profile_id = EXCLUDED.updated_by_profile_id;
  DELETE FROM public.birth_giving_teams t
   WHERE t.event_id = p_event_id AND t.id <> v_team_id
     AND NOT EXISTS (
       SELECT 1 FROM public.birth_giving_team_members m
        WHERE m.event_id = t.event_id AND m.team_id = t.id
     );
  RETURN v_team_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.birth_giving_upsert_reflection(
  p_event_id uuid,
  p_contribution text,
  p_learning text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_reflection_id uuid;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'An active verified profile is required' USING ERRCODE = '42501';
  END IF;
  IF p_contribution IS NULL OR length(trim(p_contribution)) = 0
     OR p_learning IS NULL OR length(trim(p_learning)) = 0 THEN
    RAISE EXCEPTION 'Contribution and learning are required' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.birth_giving_events e
      JOIN public.birth_giving_team_members m
        ON m.event_id = e.id AND m.profile_id = v_profile_id
      JOIN public.birth_giving_teams t
        ON t.event_id = m.event_id AND t.id = m.team_id
     WHERE e.id = p_event_id AND e.status = 'published' AND e.removed_at IS NULL
       AND e.starts_at <= now() AND t.status = 'confirmed'
  ) THEN
    RAISE EXCEPTION 'Reflection requires confirmed event participation' USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.birth_giving_reflections (
    event_id, profile_id, contribution, learning, created_by_profile_id, updated_by_profile_id
  ) VALUES (
    p_event_id, v_profile_id, trim(p_contribution), trim(p_learning), v_profile_id, v_profile_id
  )
  ON CONFLICT (event_id, profile_id) DO UPDATE
    SET contribution = EXCLUDED.contribution,
        learning = EXCLUDED.learning,
        removed_at = NULL,
        updated_by_profile_id = EXCLUDED.updated_by_profile_id
  RETURNING id INTO v_reflection_id;
  RETURN v_reflection_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.birth_giving_process_due_starts(p_limit integer DEFAULT 25)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_event public.birth_giving_events%ROWTYPE;
  v_processed integer := 0;
BEGIN
  IF p_limit < 1 OR p_limit > 500 THEN
    RAISE EXCEPTION 'Processing limit must be between 1 and 500' USING ERRCODE = '22023';
  END IF;
  FOR v_event IN
    SELECT e.*
      FROM public.birth_giving_events e
     WHERE e.status = 'published' AND e.removed_at IS NULL
       AND e.starts_at <= now() AND e.start_processed_at IS NULL
     ORDER BY e.starts_at, e.id
     FOR UPDATE SKIP LOCKED
     LIMIT p_limit
  LOOP
    UPDATE public.birth_giving_events
       SET joining_open = false,
           start_processed_at = now(),
           updated_by_profile_id = v_event.updated_by_profile_id
     WHERE id = v_event.id;
    UPDATE public.birth_giving_team_proposals
       SET state = 'expired', resolved_at = now(),
           updated_by_profile_id = v_event.updated_by_profile_id
     WHERE event_id = v_event.id AND state = 'pending';
    DELETE FROM public.birth_giving_looking_for_team WHERE event_id = v_event.id;

    UPDATE public.birth_giving_teams t
       SET status = CASE WHEN members.member_count < v_event.minimum_team_size
                         THEN 'cancelled'::public.birth_giving_team_status
                         ELSE 'confirmed'::public.birth_giving_team_status END,
           cancelled_at = CASE WHEN members.member_count < v_event.minimum_team_size THEN now() ELSE NULL END,
           cancellation_reason = CASE WHEN members.member_count < v_event.minimum_team_size
                                      THEN 'minimum_team_size_not_met' ELSE NULL END,
           updated_by_profile_id = v_event.updated_by_profile_id
      FROM (
        SELECT m.team_id, count(*)::integer AS member_count
          FROM public.birth_giving_team_members m
         WHERE m.event_id = v_event.id
         GROUP BY m.team_id
      ) members
     WHERE t.event_id = v_event.id AND t.id = members.team_id;
    DELETE FROM public.birth_giving_teams t
     WHERE t.event_id = v_event.id
       AND NOT EXISTS (
         SELECT 1 FROM public.birth_giving_team_members m
          WHERE m.event_id = t.event_id AND m.team_id = t.id
       );
    UPDATE public.birth_giving_team_members m
       SET frozen_at = now(), updated_by_profile_id = v_event.updated_by_profile_id
      FROM public.birth_giving_teams t
     WHERE m.event_id = v_event.id AND t.event_id = m.event_id AND t.id = m.team_id
       AND t.status = 'confirmed';

    INSERT INTO public.birth_giving_email_deliveries (
      event_id, profile_id, message_type, replacement_id, recipient_email,
      created_by_profile_id, updated_by_profile_id
    )
    SELECT v_event.id, m.profile_id, 'assignment_release', NULL,
           coalesce(nullif(trim(p.work_email), ''), u.verified_work_email),
           v_event.updated_by_profile_id, v_event.updated_by_profile_id
      FROM public.birth_giving_team_members m
      JOIN public.birth_giving_teams t ON t.event_id = m.event_id AND t.id = m.team_id
      JOIN public.profiles p ON p.id = m.profile_id
      JOIN public.users u ON u.id = p.user_id
     WHERE m.event_id = v_event.id AND t.status = 'confirmed'
       AND coalesce(nullif(trim(p.work_email), ''), u.verified_work_email) IS NOT NULL
    ON CONFLICT (event_id, profile_id, message_type, replacement_id) DO NOTHING;
    UPDATE public.birth_giving_events
       SET start_emails_queued_at = now(), updated_by_profile_id = v_event.updated_by_profile_id
     WHERE id = v_event.id;
    v_processed := v_processed + 1;
  END LOOP;
  RETURN v_processed;
END;
$$;

REVOKE ALL ON FUNCTION public.birth_giving_active_profile_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.birth_giving_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.birth_giving_upsert_draft(uuid, text, text, timestamptz, public.birth_giving_duration, integer, integer, boolean, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.birth_giving_publish_event(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.birth_giving_set_looking_for_team(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.birth_giving_create_team(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.birth_giving_create_proposal(uuid, uuid, uuid, public.birth_giving_proposal_direction) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.birth_giving_resolve_proposal(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.birth_giving_correct_team(uuid, uuid, text, uuid[], public.birth_giving_team_result_state) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.birth_giving_upsert_reflection(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.birth_giving_process_due_starts(integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.birth_giving_upsert_draft(uuid, text, text, timestamptz, public.birth_giving_duration, integer, integer, boolean, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.birth_giving_publish_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.birth_giving_set_looking_for_team(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.birth_giving_create_team(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.birth_giving_create_proposal(uuid, uuid, uuid, public.birth_giving_proposal_direction) TO authenticated;
GRANT EXECUTE ON FUNCTION public.birth_giving_resolve_proposal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.birth_giving_correct_team(uuid, uuid, text, uuid[], public.birth_giving_team_result_state) TO authenticated;
GRANT EXECUTE ON FUNCTION public.birth_giving_upsert_reflection(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.birth_giving_process_due_starts(integer) TO service_role;
