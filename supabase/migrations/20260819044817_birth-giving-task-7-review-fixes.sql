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
  v_idempotency_safe_window CONSTANT interval := interval '23 hours';
  v_manual_review_error CONSTANT text :=
    'Automatic retry stopped: uncertain provider outcome exceeded the 23-hour idempotency safety window; manual reconciliation required';
BEGIN
  IF p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Delivery claim limit must be between 1 and 100' USING ERRCODE = '22023';
  END IF;

  UPDATE public.birth_giving_email_deliveries d
     SET status = 'manual_review',
         processing_started_at = NULL,
         processing_token = NULL,
         last_error = v_manual_review_error
   WHERE d.status = 'processing'
     AND d.processing_started_at <= clock_timestamp() - v_lease_timeout
     AND coalesce(d.first_attempt_at, d.processing_started_at)
           <= clock_timestamp() - v_idempotency_safe_window;

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
         first_attempt_at = NULL,
         processing_started_at = NULL,
         processing_token = NULL,
         last_error = left(coalesce(nullif(trim(p_error), ''), 'Unknown email delivery error'), 4000)
   WHERE id = p_delivery_id
     AND status = 'processing'
     AND processing_token = p_processing_token;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.birth_giving_process_due_starts(p_limit integer DEFAULT 25)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_event_id uuid;
  v_event public.birth_giving_events%ROWTYPE;
  v_processed integer := 0;
BEGIN
  IF p_limit < 1 OR p_limit > 500 THEN
    RAISE EXCEPTION 'Processing limit must be between 1 and 500' USING ERRCODE = '22023';
  END IF;
  FOR v_event_id IN
    SELECT e.id
      FROM public.birth_giving_events e
     WHERE e.status = 'published' AND e.removed_at IS NULL
       AND e.starts_at <= clock_timestamp() AND e.start_processed_at IS NULL
     ORDER BY e.starts_at, e.id
     LIMIT p_limit
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_event_id::text, 0)
    );
    SELECT * INTO v_event
      FROM public.birth_giving_events e
     WHERE e.id = v_event_id
       AND e.status = 'published' AND e.removed_at IS NULL
       AND e.starts_at <= clock_timestamp() AND e.start_processed_at IS NULL
     FOR UPDATE;
    CONTINUE WHEN NOT FOUND;

    UPDATE public.birth_giving_events
       SET joining_open = false,
           start_processed_at = clock_timestamp()
     WHERE id = v_event.id;
    UPDATE public.birth_giving_team_proposals
       SET state = 'expired', resolved_at = clock_timestamp()
     WHERE event_id = v_event.id AND state = 'pending';
    DELETE FROM public.birth_giving_looking_for_team WHERE event_id = v_event.id;

    UPDATE public.birth_giving_teams t
       SET status = CASE WHEN members.member_count < v_event.minimum_team_size
                         THEN 'cancelled'::public.birth_giving_team_status
                         ELSE 'confirmed'::public.birth_giving_team_status END,
           cancelled_at = CASE WHEN members.member_count < v_event.minimum_team_size
                               THEN clock_timestamp() ELSE NULL END,
           cancellation_reason = CASE WHEN members.member_count < v_event.minimum_team_size
                                      THEN 'minimum_team_size_not_met' ELSE NULL END
      FROM (
        SELECT m.team_id, count(*)::integer AS member_count
          FROM public.birth_giving_team_members m
         WHERE m.event_id = v_event.id
         GROUP BY m.team_id
      ) members
     WHERE t.event_id = v_event.id AND t.id = members.team_id;
    DELETE FROM public.birth_giving_teams t
     WHERE t.event_id = v_event.id
       AND NOT EXISTS (
         SELECT 1 FROM public.birth_giving_team_members m
          WHERE m.event_id = t.event_id AND m.team_id = t.id
       );
    UPDATE public.birth_giving_team_members m
       SET frozen_at = clock_timestamp()
      FROM public.birth_giving_teams t
     WHERE m.event_id = v_event.id AND t.event_id = m.event_id AND t.id = m.team_id
       AND t.status = 'confirmed';

    IF EXISTS (
      SELECT 1 FROM public.birth_giving_assignments a
       WHERE a.event_id = v_event.id AND a.state = 'present'
    ) THEN
      INSERT INTO public.birth_giving_email_deliveries (
        event_id, profile_id, message_type, replacement_id, recipient_email,
        created_by_profile_id, updated_by_profile_id
      )
      SELECT v_event.id, m.profile_id, 'assignment_release', NULL,
             coalesce(nullif(trim(p.work_email), ''), u.verified_work_email),
             m.profile_id, m.profile_id
        FROM public.birth_giving_team_members m
        JOIN public.birth_giving_teams t ON t.event_id = m.event_id AND t.id = m.team_id
        JOIN public.profiles p ON p.id = m.profile_id
        JOIN public.users u ON u.id = p.user_id
       WHERE m.event_id = v_event.id AND t.status = 'confirmed'
         AND coalesce(nullif(trim(p.work_email), ''), u.verified_work_email) IS NOT NULL
      ON CONFLICT (event_id, profile_id, message_type, replacement_id) DO NOTHING;
      UPDATE public.birth_giving_events
         SET start_emails_queued_at = clock_timestamp()
       WHERE id = v_event.id;
    END IF;
    v_processed := v_processed + 1;
  END LOOP;
  RETURN v_processed;
END;
$$;

CREATE OR REPLACE FUNCTION public.birth_giving_confirm_assignment(
  p_actor_profile_id uuid, p_event_id uuid, p_storage_path text,
  p_original_file_name text, p_mime_type text, p_file_size bigint
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_event public.birth_giving_events%ROWTYPE;
  v_old_path text;
  v_had_assignment boolean := false;
  v_replacement_id uuid;
  v_expected_extensions text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.users u ON u.id = p.user_id
    WHERE p.id = p_actor_profile_id AND p.access_removed_at IS NULL
      AND p.beta_access_granted_at IS NOT NULL AND u.verified_work_email IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'An active verified beta profile is required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_event FROM public.birth_giving_events e
  WHERE e.id = p_event_id AND e.removed_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.birth_giving_event_organizers o
    WHERE o.event_id = p_event_id AND o.profile_id = p_actor_profile_id
  ) THEN
    RAISE EXCEPTION 'Only an event organizer can manage the assignment' USING ERRCODE = '42501';
  END IF;
  IF v_event.status = 'published' AND clock_timestamp() >= v_event.starts_at +
     (CASE v_event.duration WHEN '8h' THEN interval '8 hours' ELSE interval '24 hours' END) THEN
    RAISE EXCEPTION 'Assignment is locked after the event has ended';
  END IF;

  v_expected_extensions := CASE p_mime_type
    WHEN 'application/pdf' THEN ARRAY['pdf']
    WHEN 'application/vnd.openxmlformats-officedocument.presentationml.presentation' THEN ARRAY['pptx']
    WHEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' THEN ARRAY['docx']
    WHEN 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' THEN ARRAY['xlsx']
    WHEN 'image/jpeg' THEN ARRAY['jpg', 'jpeg']
    WHEN 'image/png' THEN ARRAY['png']
    WHEN 'image/webp' THEN ARRAY['webp']
    ELSE NULL
  END;
  IF p_storage_path IS NULL
     OR p_storage_path NOT LIKE 'birth-giving/assignments/' || p_event_id::text || '/%'
     OR substring(p_storage_path FROM length('birth-giving/assignments/' || p_event_id::text || '/') + 1) LIKE '%/%'
     OR p_original_file_name IS NULL OR p_original_file_name ~ '[\\/]'
     OR v_expected_extensions IS NULL
     OR lower(p_original_file_name) ~ '\.(bat|cmd|com|exe|html?|js|mjs|ps1|scr|sh|svg)(\.|$)'
     OR lower(p_storage_path) ~ '\.(bat|cmd|com|exe|html?|js|mjs|ps1|scr|sh|svg)(\.|$)'
     OR lower(split_part(p_original_file_name, '.', array_length(string_to_array(p_original_file_name, '.'), 1))) <> ALL(v_expected_extensions)
     OR lower(split_part(p_storage_path, '.', array_length(string_to_array(p_storage_path, '.'), 1))) <> ALL(v_expected_extensions)
     OR p_file_size < 1 OR p_file_size > 26214400 THEN
    RAISE EXCEPTION 'Invalid assignment file metadata' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM storage.objects object
  WHERE object.bucket_id = 'documents' AND object.name = p_storage_path
    AND jsonb_typeof(object.metadata -> 'size') = 'number'
    AND (object.metadata ->> 'size')::bigint = p_file_size
    AND split_part(object.metadata ->> 'mimetype', ';', 1) = p_mime_type
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Storage object metadata does not match the confirmed assignment' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.birth_giving_storage_cleanup_claims claim
    WHERE claim.storage_path = p_storage_path
  ) THEN
    RAISE EXCEPTION 'Storage object is claimed for cleanup' USING ERRCODE = '55000';
  END IF;

  SELECT a.storage_path, a.state = 'present' INTO v_old_path, v_had_assignment
  FROM public.birth_giving_assignments a WHERE a.event_id = p_event_id FOR UPDATE;
  IF v_had_assignment AND v_old_path = p_storage_path THEN RETURN NULL; END IF;
  v_replacement_id := gen_random_uuid();
  INSERT INTO public.birth_giving_assignments (
    event_id, state, replacement_id, storage_path, original_file_name, mime_type,
    file_size, uploaded_by_profile_id, uploaded_at, created_by_profile_id, updated_by_profile_id
  ) VALUES (
    p_event_id, 'present', v_replacement_id, p_storage_path, p_original_file_name, p_mime_type,
    p_file_size, p_actor_profile_id, clock_timestamp(), p_actor_profile_id, p_actor_profile_id
  ) ON CONFLICT (event_id) DO UPDATE SET
    state = 'present', replacement_id = excluded.replacement_id,
    storage_path = excluded.storage_path, original_file_name = excluded.original_file_name,
    mime_type = excluded.mime_type, file_size = excluded.file_size,
    uploaded_by_profile_id = excluded.uploaded_by_profile_id, uploaded_at = excluded.uploaded_at,
    updated_by_profile_id = p_actor_profile_id;

  IF v_event.status = 'published'
     AND v_event.starts_at <= clock_timestamp()
     AND clock_timestamp() < v_event.starts_at +
       (CASE v_event.duration WHEN '8h' THEN interval '8 hours' ELSE interval '24 hours' END) THEN
    INSERT INTO public.birth_giving_email_deliveries (
      event_id, profile_id, message_type, replacement_id, recipient_email,
      created_by_profile_id, updated_by_profile_id
    )
    SELECT v_event.id, m.profile_id,
           CASE WHEN v_had_assignment THEN 'assignment_replacement'::public.birth_giving_email_message_type
                ELSE 'assignment_release'::public.birth_giving_email_message_type END,
           CASE WHEN v_had_assignment THEN v_replacement_id ELSE NULL END,
           coalesce(nullif(trim(p.work_email), ''), u.verified_work_email),
           p_actor_profile_id, p_actor_profile_id
    FROM public.birth_giving_team_members m
    JOIN public.birth_giving_teams t ON t.event_id = m.event_id AND t.id = m.team_id
    JOIN public.profiles p ON p.id = m.profile_id
    JOIN public.users u ON u.id = p.user_id
    WHERE m.event_id = v_event.id AND m.frozen_at IS NOT NULL AND t.status = 'confirmed'
      AND coalesce(nullif(trim(p.work_email), ''), u.verified_work_email) IS NOT NULL
    ON CONFLICT (event_id, profile_id, message_type, replacement_id) DO NOTHING;
    IF NOT v_had_assignment THEN
      UPDATE public.birth_giving_events
         SET start_emails_queued_at = clock_timestamp()
       WHERE id = v_event.id;
    END IF;
  END IF;
  RETURN v_old_path;
END;
$$;
