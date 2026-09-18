-- Custom SQL migration file, put your code below! --

-- Cross-type essay reassignment for duplicate cleanup (e.g. a podcast
-- mistakenly added as a book). Mirrors reassign_essays_to_book, which only
-- covers book -> book. frozen_book_points is deliberately left untouched:
-- it is immune to reassignment, matching the existing function.
CREATE OR REPLACE FUNCTION public.reassign_essays_to_content_source(
  p_source_book_id uuid,
  p_target_content_source_id uuid,
  p_updated_by_profile_id uuid
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_moved integer;
BEGIN
  IF NOT public.is_coach_or_admin() THEN
    RETURN 0;
  END IF;

  UPDATE public.essays
  SET book_id = NULL,
      content_source_id = p_target_content_source_id,
      updated_at = now(),
      updated_by_profile_id = p_updated_by_profile_id
  WHERE book_id = p_source_book_id;

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RETURN v_moved;
END;
$function$;

-- Reassign all essays from one content source to either a book or another
-- content source. Exactly one of the two targets must be set; the other side
-- of the exclusive (book_id XOR content_source_id) link is cleared.
CREATE OR REPLACE FUNCTION public.reassign_content_source_essays(
  p_source_content_source_id uuid,
  p_target_book_id uuid,
  p_target_content_source_id uuid,
  p_updated_by_profile_id uuid
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_moved integer;
BEGIN
  IF NOT public.is_coach_or_admin() THEN
    RETURN 0;
  END IF;

  IF (p_target_book_id IS NULL) = (p_target_content_source_id IS NULL) THEN
    RAISE EXCEPTION 'Exactly one target must be set' USING ERRCODE = '22023';
  END IF;

  IF p_target_book_id IS NOT NULL THEN
    UPDATE public.essays
    SET content_source_id = NULL,
        book_id = p_target_book_id,
        updated_at = now(),
        updated_by_profile_id = p_updated_by_profile_id
    WHERE content_source_id = p_source_content_source_id;
  ELSE
    UPDATE public.essays
    SET content_source_id = p_target_content_source_id,
        updated_at = now(),
        updated_by_profile_id = p_updated_by_profile_id
    WHERE content_source_id = p_source_content_source_id;
  END IF;

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RETURN v_moved;
END;
$function$;
