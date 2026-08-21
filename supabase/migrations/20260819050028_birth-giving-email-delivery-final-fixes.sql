CREATE OR REPLACE FUNCTION public.birth_giving_email_snapshot_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF (NEW.email_subject IS NULL) <> (NEW.email_html IS NULL) THEN
    RAISE EXCEPTION 'Email subject and HTML snapshot must be stored together' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE'
     AND (OLD.email_subject IS NOT NULL OR OLD.email_html IS NOT NULL)
     AND (NEW.email_subject IS DISTINCT FROM OLD.email_subject
          OR NEW.email_html IS DISTINCT FROM OLD.email_html) THEN
    RAISE EXCEPTION 'Email delivery snapshot is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER birth_giving_email_snapshot_immutable
BEFORE INSERT OR UPDATE OF email_subject, email_html
ON public.birth_giving_email_deliveries
FOR EACH ROW EXECUTE FUNCTION public.birth_giving_email_snapshot_immutable();

CREATE OR REPLACE FUNCTION public.birth_giving_reconcile_email_deliveries()
RETURNS integer
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_lease_timeout CONSTANT interval := interval '10 minutes';
  v_idempotency_safe_window CONSTANT interval := interval '23 hours';
  v_manual_review_error CONSTANT text :=
    'Automatic retry stopped: uncertain provider outcome exceeded the 23-hour idempotency safety window; manual reconciliation required';
  v_count integer;
BEGIN
  UPDATE public.birth_giving_email_deliveries d
     SET status = 'manual_review',
         processing_started_at = NULL,
         processing_token = NULL,
         last_error = v_manual_review_error
   WHERE (
       d.status = 'processing'
       AND d.processing_started_at <= clock_timestamp() - v_lease_timeout
       AND coalesce(d.first_attempt_at, d.processing_started_at)
             <= clock_timestamp() - v_idempotency_safe_window
     ) OR (
       d.status = 'failed'
       AND (d.first_attempt_at IS NULL
            OR d.first_attempt_at <= clock_timestamp() - v_idempotency_safe_window)
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

DROP FUNCTION public.birth_giving_claim_email_deliveries(integer);
CREATE FUNCTION public.birth_giving_claim_email_deliveries(p_limit integer DEFAULT 25)
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
  attempt_count integer,
  email_subject text,
  email_html text
)
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_lease_timeout CONSTANT interval := interval '10 minutes';
  v_idempotency_safe_window CONSTANT interval := interval '23 hours';
BEGIN
  IF p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Delivery claim limit must be between 1 and 100' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT d.id
      FROM public.birth_giving_email_deliveries d
     WHERE (
       d.status = 'pending'
       AND d.next_attempt_at <= clock_timestamp()
     ) OR (
       d.status = 'failed'
       AND d.next_attempt_at <= clock_timestamp()
       AND d.first_attempt_at > clock_timestamp() - v_idempotency_safe_window
     ) OR (
       d.status = 'processing'
       AND d.processing_started_at <= clock_timestamp() - v_lease_timeout
       AND coalesce(d.first_attempt_at, d.processing_started_at)
             > clock_timestamp() - v_idempotency_safe_window
     )
     ORDER BY d.next_attempt_at, d.created_at, d.id
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.birth_giving_email_deliveries d
       SET status = 'processing',
           first_attempt_at = coalesce(d.first_attempt_at, clock_timestamp()),
           processing_started_at = clock_timestamp(),
           processing_token = gen_random_uuid(),
           attempt_count = d.attempt_count + 1,
           last_error = NULL
      FROM candidates c
     WHERE d.id = c.id
     RETURNING d.id, d.processing_token, d.recipient_email, d.message_type,
               d.replacement_id, d.event_id, d.attempt_count,
               d.email_subject, d.email_html
  )
  SELECT c.id, c.processing_token, c.recipient_email, c.message_type,
         c.replacement_id, c.event_id, e.name, e.customer, e.starts_at,
         c.attempt_count, c.email_subject, c.email_html
    FROM claimed c
    JOIN public.birth_giving_events e ON e.id = c.event_id
   ORDER BY c.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.birth_giving_prepare_email_delivery(
  p_delivery_id uuid,
  p_processing_token uuid,
  p_email_subject text,
  p_email_html text
)
RETURNS TABLE (email_subject text, email_html text)
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF nullif(trim(p_email_subject), '') IS NULL OR nullif(trim(p_email_html), '') IS NULL THEN
    RAISE EXCEPTION 'Email subject and HTML are required' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  UPDATE public.birth_giving_email_deliveries d
     SET email_subject = coalesce(d.email_subject, p_email_subject),
         email_html = coalesce(d.email_html, p_email_html)
   WHERE d.id = p_delivery_id
     AND d.status = 'processing'
     AND d.processing_token = p_processing_token
  RETURNING d.email_subject, d.email_html;
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

REVOKE ALL ON FUNCTION public.birth_giving_email_snapshot_immutable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.birth_giving_reconcile_email_deliveries() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.birth_giving_claim_email_deliveries(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.birth_giving_prepare_email_delivery(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.birth_giving_reconcile_email_deliveries() TO service_role;
GRANT EXECUTE ON FUNCTION public.birth_giving_claim_email_deliveries(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.birth_giving_prepare_email_delivery(uuid, uuid, text, text) TO service_role;
