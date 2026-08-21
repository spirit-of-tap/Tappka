CREATE OR REPLACE FUNCTION public.birth_giving_create_draft(
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
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT public.birth_giving_upsert_draft(
    NULL::uuid,
    p_name,
    p_customer,
    p_starts_at,
    p_duration,
    p_minimum_team_size,
    p_maximum_team_size,
    p_joining_open,
    p_organizer_profile_ids
  )
$$;

CREATE OR REPLACE FUNCTION public.birth_giving_create_historical_team(
  p_event_id uuid,
  p_name text,
  p_member_profile_ids uuid[],
  p_result_state public.birth_giving_team_result_state
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT public.birth_giving_correct_team(
    p_event_id,
    NULL::uuid,
    p_name,
    p_member_profile_ids,
    p_result_state
  )
$$;

REVOKE ALL ON FUNCTION public.birth_giving_create_draft(
  text, text, timestamptz, public.birth_giving_duration, integer, integer, boolean, uuid[]
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.birth_giving_create_historical_team(
  uuid, text, uuid[], public.birth_giving_team_result_state
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.birth_giving_create_draft(
  text, text, timestamptz, public.birth_giving_duration, integer, integer, boolean, uuid[]
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.birth_giving_create_historical_team(
  uuid, text, uuid[], public.birth_giving_team_result_state
) TO authenticated;
