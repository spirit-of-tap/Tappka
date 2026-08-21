CREATE OR REPLACE FUNCTION public.birth_giving_active_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT p.id
  FROM public.profiles p
  JOIN public.users u ON u.id = p.user_id
  WHERE u.auth_user_id = (SELECT auth.uid())
    AND u.verified_work_email IS NOT NULL
    AND p.access_removed_at IS NULL
    AND p.beta_access_granted_at IS NOT NULL
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.birth_giving_update_event(
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
    RAISE EXCEPTION 'An active verified beta profile is required' USING ERRCODE = '42501';
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
  IF v_event.status = 'published'
     AND (v_event.start_processed_at IS NOT NULL OR v_event.starts_at <= v_now)
     AND (
       (p_starts_at IS NOT NULL AND p_starts_at IS DISTINCT FROM v_event.starts_at)
       OR (p_duration IS NOT NULL AND p_duration IS DISTINCT FROM v_event.duration)
       OR (p_minimum_team_size IS NOT NULL AND p_minimum_team_size IS DISTINCT FROM v_event.minimum_team_size)
       OR (p_maximum_team_size IS NOT NULL AND p_maximum_team_size IS DISTINCT FROM v_event.maximum_team_size)
       OR p_joining_open IS TRUE
     ) THEN
    RAISE EXCEPTION 'Started event lifecycle fields are immutable and joining must remain closed' USING ERRCODE = '55000';
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
         joining_open = CASE
           WHEN status = 'published'
            AND (start_processed_at IS NOT NULL OR coalesce(p_starts_at, starts_at) <= v_now)
             THEN false
           ELSE coalesce(p_joining_open, joining_open)
         END,
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

CREATE OR REPLACE FUNCTION public.can_view_birth_giving_event_organizers(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.birth_giving_event_organizers organizer
      JOIN public.profiles caller_profile ON caller_profile.id = organizer.profile_id
      JOIN public.users caller_user ON caller_user.id = caller_profile.user_id
      WHERE organizer.event_id = target_event_id
        AND caller_user.auth_user_id = (SELECT auth.uid())
        AND caller_user.verified_work_email IS NOT NULL
        AND caller_profile.access_removed_at IS NULL
        AND caller_profile.beta_access_granted_at IS NOT NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.birth_giving_events event
      JOIN public.users caller_user ON caller_user.auth_user_id = (SELECT auth.uid())
      JOIN public.profiles caller_profile ON caller_profile.user_id = caller_user.id
      WHERE event.id = target_event_id
        AND event.status = 'published'
        AND event.removed_at IS NULL
        AND caller_user.verified_work_email IS NOT NULL
        AND caller_profile.access_removed_at IS NULL
        AND caller_profile.beta_access_granted_at IS NOT NULL
    )
$function$;
