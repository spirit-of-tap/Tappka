CREATE OR REPLACE FUNCTION public.birth_giving_claim_email_deliveries(p_limit integer DEFAULT 25)
RETURNS TABLE (
  delivery_id uuid,
  processing_token uuid,
  recipient_email text,
  message_type public.birth_giving_email_message_type,
  replacement_id uuid,
  event_id uuid,
  event_name text,
  customer text,
  starts_at timestamptz,
  attempt_count integer
)
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_lease_timeout CONSTANT interval := interval '10 minutes';
BEGIN
  IF p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Delivery claim limit must be between 1 and 100' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT d.id
      FROM public.birth_giving_email_deliveries d
     WHERE (
       d.status IN ('pending', 'failed')
       AND d.next_attempt_at <= clock_timestamp()
     ) OR (
       d.status = 'processing'
       AND d.processing_started_at <= clock_timestamp() - v_lease_timeout
     )
     ORDER BY d.next_attempt_at, d.created_at, d.id
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.birth_giving_email_deliveries d
       SET status = 'processing',
           processing_started_at = clock_timestamp(),
           processing_token = gen_random_uuid(),
           attempt_count = d.attempt_count + 1,
           last_error = NULL
      FROM candidates c
     WHERE d.id = c.id
     RETURNING d.id, d.processing_token, d.recipient_email, d.message_type,
               d.replacement_id, d.event_id, d.attempt_count
  )
  SELECT c.id, c.processing_token, c.recipient_email, c.message_type,
         c.replacement_id, c.event_id, e.name, e.customer, e.starts_at,
         c.attempt_count
    FROM claimed c
    JOIN public.birth_giving_events e ON e.id = c.event_id
   ORDER BY c.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.birth_giving_complete_email_delivery(
  p_delivery_id uuid,
  p_processing_token uuid,
  p_provider_message_id text
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF nullif(trim(p_provider_message_id), '') IS NULL THEN
    RAISE EXCEPTION 'Provider message ID is required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.birth_giving_email_deliveries
     SET status = 'sent',
         sent_at = clock_timestamp(),
         provider_message_id = p_provider_message_id,
         processing_started_at = NULL,
         processing_token = NULL,
         last_error = NULL
   WHERE id = p_delivery_id
     AND status = 'processing'
     AND processing_token = p_processing_token;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.birth_giving_fail_email_delivery(
  p_delivery_id uuid,
  p_processing_token uuid,
  p_error text
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_base_retry_delay CONSTANT interval := interval '1 minute';
  v_max_retry_minutes CONSTANT integer := 1440;
BEGIN
  UPDATE public.birth_giving_email_deliveries
     SET status = 'failed',
         next_attempt_at = clock_timestamp()
           + v_base_retry_delay * least(power(2::numeric, greatest(attempt_count - 1, 0)), v_max_retry_minutes),
         processing_started_at = NULL,
         processing_token = NULL,
         last_error = left(coalesce(nullif(trim(p_error), ''), 'Unknown email delivery error'), 4000)
   WHERE id = p_delivery_id
     AND status = 'processing'
     AND processing_token = p_processing_token;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.birth_giving_claim_email_deliveries(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.birth_giving_complete_email_delivery(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.birth_giving_fail_email_delivery(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.birth_giving_claim_email_deliveries(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.birth_giving_complete_email_delivery(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.birth_giving_fail_email_delivery(uuid, uuid, text) TO service_role;
