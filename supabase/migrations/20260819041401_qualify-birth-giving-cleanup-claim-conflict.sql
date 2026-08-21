CREATE OR REPLACE FUNCTION public.birth_giving_claim_storage_cleanup(
  p_grace_period interval,
  p_stale_after interval,
  p_limit integer
)
RETURNS TABLE(storage_path text, claim_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF p_grace_period IS NULL OR p_grace_period <= interval '0 seconds'
     OR p_stale_after IS NULL OR p_stale_after <= interval '0 seconds'
     OR p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'Valid cleanup grace, stale interval, and limit are required' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT object.name
    FROM storage.objects object
    LEFT JOIN public.birth_giving_storage_cleanup_claims existing
      ON existing.storage_path = object.name
    WHERE object.bucket_id = 'documents'
      AND (object.name LIKE 'birth-giving/assignments/%' OR object.name LIKE 'birth-giving/results/%')
      AND object.created_at < clock_timestamp() - p_grace_period
      AND (existing.storage_path IS NULL OR existing.claimed_at < clock_timestamp() - p_stale_after)
      AND NOT EXISTS (
        SELECT 1 FROM public.birth_giving_assignments assignment
        WHERE assignment.state = 'present' AND assignment.storage_path = object.name
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.birth_giving_team_result_files result_file
        WHERE result_file.removed_at IS NULL AND result_file.storage_path = object.name
      )
    ORDER BY object.created_at, object.name
    FOR UPDATE OF object SKIP LOCKED
    LIMIT p_limit
  ), claimed AS (
    INSERT INTO public.birth_giving_storage_cleanup_claims AS existing (
      storage_path, claim_id, claimed_at, attempt_count
    )
    SELECT candidate.name, gen_random_uuid(), clock_timestamp(), 1
    FROM candidates candidate
    ON CONFLICT ON CONSTRAINT birth_giving_storage_cleanup_claims_pkey DO UPDATE SET
      claim_id = gen_random_uuid(),
      claimed_at = clock_timestamp(),
      attempt_count = existing.attempt_count + 1
    WHERE existing.claimed_at < clock_timestamp() - p_stale_after
    RETURNING existing.storage_path, existing.claim_id
  )
  SELECT claimed.storage_path, claimed.claim_id FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.birth_giving_claim_storage_cleanup(interval, interval, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.birth_giving_claim_storage_cleanup(interval, interval, integer) TO service_role;
