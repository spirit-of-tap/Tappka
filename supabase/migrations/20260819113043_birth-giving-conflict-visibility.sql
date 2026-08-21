-- Hide another organizer's unpublished draft from conflict resolution.
--
-- birth_giving_find_event_conflict previously returned {id,status} for any
-- exact identity match, letting any beta user learn the id of someone else's
-- private draft and then 404-resume it. It now returns the conflict only when
-- the caller may view it (published events, or drafts the caller organizes);
-- otherwise it returns a single marker row with NULL id/status so callers know
-- the identity is taken without disclosing the event.

CREATE OR REPLACE FUNCTION public.birth_giving_find_event_conflict(
  p_normalized_name text,
  p_normalized_customer text,
  p_starts_at timestamp with time zone
)
RETURNS TABLE(id uuid, status public.birth_giving_event_status)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_profile_id uuid := public.birth_giving_active_profile_id();
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'An active verified beta profile is required' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.birth_giving_events event
     WHERE event.normalized_name = p_normalized_name
       AND event.normalized_customer = p_normalized_customer
       AND event.starts_at = p_starts_at
       AND event.removed_at IS NULL
  ) THEN
    RETURN QUERY
    SELECT
      CASE
        WHEN event.status = 'draft'::public.birth_giving_event_status
         AND NOT EXISTS (
           SELECT 1
             FROM public.birth_giving_event_organizers organizer
            WHERE organizer.event_id = event.id
              AND organizer.profile_id = v_profile_id
         )
          THEN NULL::uuid
        ELSE event.id
      END AS id,
      CASE
        WHEN event.status = 'draft'::public.birth_giving_event_status
         AND NOT EXISTS (
           SELECT 1
             FROM public.birth_giving_event_organizers organizer
            WHERE organizer.event_id = event.id
              AND organizer.profile_id = v_profile_id
         )
          THEN NULL::public.birth_giving_event_status
        ELSE event.status
      END AS status
      FROM public.birth_giving_events event
     WHERE event.normalized_name = p_normalized_name
       AND event.normalized_customer = p_normalized_customer
       AND event.starts_at = p_starts_at
       AND event.removed_at IS NULL
     LIMIT 1;
  END IF;
END;
$function$;
