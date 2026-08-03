-- Custom SQL migration file, put your code below! --

-- Reassign all essays from one book to another. SECURITY DEFINER so a coach
-- can reroute essays written by other authors (essay RLS only allows the
-- author to update their own essays). Returns the number of moved essays.
CREATE OR REPLACE FUNCTION public.reassign_essays_to_book(
  p_source_book_id uuid,
  p_target_book_id uuid,
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
  SET book_id = p_target_book_id,
      updated_at = now(),
      updated_by_profile_id = p_updated_by_profile_id
  WHERE book_id = p_source_book_id;

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RETURN v_moved;
END;
$function$;
