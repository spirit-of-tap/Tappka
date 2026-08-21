DROP FUNCTION IF EXISTS public.birth_giving_claim_storage_cleanup(interval, interval, integer);

CREATE OR REPLACE FUNCTION public.birth_giving_claim_storage_cleanup(
  p_grace_period interval,
  p_limit integer
)
RETURNS TABLE(storage_path text, claim_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_candidate_paths text[];
BEGIN
  IF p_grace_period IS NULL OR p_grace_period <= interval '0 seconds'
     OR p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'Valid cleanup grace and limit are required' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(
    array_agg(candidate.name ORDER BY candidate.created_at, candidate.name),
    ARRAY[]::text[]
  )
  INTO v_candidate_paths
  FROM (
    SELECT object.name, object.created_at
    FROM storage.objects object
    WHERE object.bucket_id = 'documents'
      AND (object.name LIKE 'birth-giving/assignments/%' OR object.name LIKE 'birth-giving/results/%')
      AND object.created_at < clock_timestamp() - p_grace_period
      AND NOT EXISTS (
        SELECT 1 FROM public.birth_giving_storage_cleanup_claims claim
        WHERE claim.storage_path = object.name
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.birth_giving_assignments assignment
        WHERE assignment.state = 'present' AND assignment.storage_path = object.name
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.birth_giving_team_result_files result_file
        WHERE result_file.removed_at IS NULL AND result_file.storage_path = object.name
      )
    ORDER BY object.created_at, object.name
    FOR UPDATE OF object
    LIMIT p_limit
  ) candidate;

  -- This separate statement receives a fresh READ COMMITTED snapshot after all
  -- storage locks are held, so a confirmation that just committed is visible.
  RETURN QUERY
  INSERT INTO public.birth_giving_storage_cleanup_claims (
    storage_path, claim_id, claimed_at, attempt_count
  )
  SELECT candidate_path, gen_random_uuid(), clock_timestamp(), 1
  FROM unnest(v_candidate_paths) candidate_path
  WHERE NOT EXISTS (
    SELECT 1 FROM public.birth_giving_assignments assignment
    WHERE assignment.state = 'present' AND assignment.storage_path = candidate_path
  )
    AND NOT EXISTS (
      SELECT 1 FROM public.birth_giving_team_result_files result_file
      WHERE result_file.removed_at IS NULL AND result_file.storage_path = candidate_path
    )
  ON CONFLICT ON CONSTRAINT birth_giving_storage_cleanup_claims_pkey DO NOTHING
  RETURNING birth_giving_storage_cleanup_claims.storage_path,
            birth_giving_storage_cleanup_claims.claim_id;
END;
$$;

COMMENT ON FUNCTION public.birth_giving_claim_storage_cleanup(interval, integer) IS
  'Claims aged unreferenced Birth Giving objects. Claims never expire automatically; crashed workers require manual reconciliation.';

REVOKE ALL ON FUNCTION public.birth_giving_claim_storage_cleanup(interval, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.birth_giving_claim_storage_cleanup(interval, integer) TO service_role;
