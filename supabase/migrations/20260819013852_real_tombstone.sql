ALTER FUNCTION public.birth_giving_resolve_proposal(uuid, text)
  RENAME TO birth_giving_resolve_proposal_locked;

REVOKE ALL ON FUNCTION public.birth_giving_resolve_proposal_locked(uuid, text)
  FROM PUBLIC, anon, authenticated;

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
  v_event_id uuid;
BEGIN
  SELECT p.event_id INTO v_event_id
    FROM public.birth_giving_team_proposals p
   WHERE p.id = p_proposal_id;
  IF v_event_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_event_id::text, 0)
    );
  END IF;
  PERFORM public.birth_giving_resolve_proposal_locked(p_proposal_id, p_action);
END;
$$;

REVOKE ALL ON FUNCTION public.birth_giving_resolve_proposal(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.birth_giving_resolve_proposal(uuid, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.birth_giving_validate_retrospective_publication()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF OLD.status = 'draft'
     AND NEW.status = 'published'
     AND NEW.starts_at <= now()
     AND EXISTS (
       SELECT 1
         FROM public.birth_giving_teams t
        WHERE t.event_id = NEW.id
          AND t.result_state = 'present'
          AND NOT EXISTS (
            SELECT 1
              FROM public.birth_giving_team_result_files f
             WHERE f.event_id = t.event_id
               AND f.team_id = t.id
               AND f.removed_at IS NULL
          )
     ) THEN
    RAISE EXCEPTION 'Every retrospective team marked present requires a result file'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER birth_giving_events_validate_retrospective_publication
BEFORE UPDATE OF status ON public.birth_giving_events
FOR EACH ROW
EXECUTE FUNCTION public.birth_giving_validate_retrospective_publication();

REVOKE ALL ON FUNCTION public.birth_giving_validate_retrospective_publication()
  FROM PUBLIC, anon, authenticated;
