CREATE OR REPLACE FUNCTION public.birth_giving_validate_retrospective_publication()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF OLD.status = 'draft'
     AND NEW.status = 'published'
     AND EXISTS (
       SELECT 1
         FROM public.birth_giving_teams t
        WHERE t.event_id = NEW.id
          AND (
            (t.result_state = 'present' AND NOT EXISTS (
              SELECT 1
                FROM public.birth_giving_team_result_files f
               WHERE f.event_id = t.event_id
                 AND f.team_id = t.id
                 AND f.removed_at IS NULL
            ))
            OR (t.result_state = 'missing' AND EXISTS (
              SELECT 1
                FROM public.birth_giving_team_result_files f
               WHERE f.event_id = t.event_id
                 AND f.team_id = t.id
                 AND f.removed_at IS NULL
            ))
          )
     ) THEN
    RAISE EXCEPTION 'Every retrospective team result state must agree with its active result files'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
