DROP FUNCTION public.birth_giving_unreferenced_storage_paths(interval);

CREATE OR REPLACE FUNCTION public.birth_giving_finalize_storage_cleanup(
  p_storage_path text,
  p_claim_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_deleted boolean;
BEGIN
  WITH deleted AS (
    DELETE FROM public.birth_giving_storage_cleanup_claims claim
    WHERE claim.storage_path = p_storage_path
      AND claim.claim_id = p_claim_id
      AND NOT EXISTS (
        SELECT 1 FROM storage.objects object
        WHERE object.bucket_id = 'documents' AND object.name = p_storage_path
      )
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM deleted) INTO v_deleted;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION public.birth_giving_release_storage_cleanup_claim(
  p_storage_path text,
  p_claim_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_deleted boolean;
BEGIN
  WITH deleted AS (
    DELETE FROM public.birth_giving_storage_cleanup_claims claim
    WHERE claim.storage_path = p_storage_path AND claim.claim_id = p_claim_id
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM deleted) INTO v_deleted;
  RETURN v_deleted;
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

  IF v_had_assignment AND v_event.status = 'published'
     AND v_event.starts_at <= clock_timestamp()
     AND clock_timestamp() < v_event.starts_at +
       (CASE v_event.duration WHEN '8h' THEN interval '8 hours' ELSE interval '24 hours' END) THEN
    INSERT INTO public.birth_giving_email_deliveries (
      event_id, profile_id, message_type, replacement_id, recipient_email,
      created_by_profile_id, updated_by_profile_id
    )
    SELECT v_event.id, m.profile_id, 'assignment_replacement', v_replacement_id,
           coalesce(nullif(trim(p.work_email), ''), u.verified_work_email),
           p_actor_profile_id, p_actor_profile_id
    FROM public.birth_giving_team_members m
    JOIN public.birth_giving_teams t ON t.event_id = m.event_id AND t.id = m.team_id
    JOIN public.profiles p ON p.id = m.profile_id
    JOIN public.users u ON u.id = p.user_id
    WHERE m.event_id = v_event.id AND m.frozen_at IS NOT NULL AND t.status = 'confirmed'
      AND coalesce(nullif(trim(p.work_email), ''), u.verified_work_email) IS NOT NULL
    ON CONFLICT (event_id, profile_id, message_type, replacement_id) DO NOTHING;
  END IF;
  RETURN v_old_path;
END;
$$;

CREATE OR REPLACE FUNCTION public.birth_giving_confirm_result_file(
  p_actor_profile_id uuid, p_event_id uuid, p_team_id uuid, p_storage_path text,
  p_original_file_name text, p_mime_type text, p_file_size bigint
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_result_id uuid;
  v_total bigint;
  v_expected_extensions text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.users u ON u.id = p.user_id
    WHERE p.id = p_actor_profile_id AND p.access_removed_at IS NULL
      AND p.beta_access_granted_at IS NOT NULL AND u.verified_work_email IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'An active verified beta profile is required' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.birth_giving_teams t
  WHERE t.event_id = p_event_id AND t.id = p_team_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Result team does not belong to the event'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.birth_giving_events e
    JOIN public.birth_giving_teams t ON t.event_id = e.id AND t.id = p_team_id
    WHERE e.id = p_event_id AND e.removed_at IS NULL AND t.status <> 'cancelled'
      AND (
        (e.status = 'published' AND e.starts_at <= clock_timestamp() AND EXISTS (
          SELECT 1 FROM public.birth_giving_team_members m
          WHERE m.event_id = e.id AND m.team_id = t.id AND m.profile_id = p_actor_profile_id
        )) OR (
          e.starts_at + (CASE e.duration WHEN '8h' THEN interval '8 hours' ELSE interval '24 hours' END) <= clock_timestamp()
          AND EXISTS (
            SELECT 1 FROM public.birth_giving_event_organizers o
            WHERE o.event_id = e.id AND o.profile_id = p_actor_profile_id
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Only a team member or authorized historical organizer can manage results' USING ERRCODE = '42501';
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
     OR p_storage_path NOT LIKE 'birth-giving/results/' || p_event_id::text || '/' || p_team_id::text || '/%'
     OR substring(p_storage_path FROM length('birth-giving/results/' || p_event_id::text || '/' || p_team_id::text || '/') + 1) LIKE '%/%'
     OR p_original_file_name IS NULL OR p_original_file_name ~ '[\\/]'
     OR v_expected_extensions IS NULL
     OR lower(p_original_file_name) ~ '\.(bat|cmd|com|exe|html?|js|mjs|ps1|scr|sh|svg)(\.|$)'
     OR lower(p_storage_path) ~ '\.(bat|cmd|com|exe|html?|js|mjs|ps1|scr|sh|svg)(\.|$)'
     OR lower(split_part(p_original_file_name, '.', array_length(string_to_array(p_original_file_name, '.'), 1))) <> ALL(v_expected_extensions)
     OR lower(split_part(p_storage_path, '.', array_length(string_to_array(p_storage_path, '.'), 1))) <> ALL(v_expected_extensions)
     OR p_file_size < 1 OR p_file_size > 26214400 THEN
    RAISE EXCEPTION 'Invalid result file metadata' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM storage.objects object
  WHERE object.bucket_id = 'documents' AND object.name = p_storage_path
    AND jsonb_typeof(object.metadata -> 'size') = 'number'
    AND (object.metadata ->> 'size')::bigint = p_file_size
    AND split_part(object.metadata ->> 'mimetype', ';', 1) = p_mime_type
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Storage object metadata does not match the confirmed result' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.birth_giving_storage_cleanup_claims claim
    WHERE claim.storage_path = p_storage_path
  ) THEN
    RAISE EXCEPTION 'Storage object is claimed for cleanup' USING ERRCODE = '55000';
  END IF;

  SELECT f.id INTO v_result_id FROM public.birth_giving_team_result_files f
  WHERE f.event_id = p_event_id AND f.team_id = p_team_id
    AND f.storage_path = p_storage_path AND f.removed_at IS NULL;
  IF FOUND THEN RETURN v_result_id; END IF;

  SELECT coalesce(sum(f.file_size), 0) INTO v_total
  FROM public.birth_giving_team_result_files f
  WHERE f.event_id = p_event_id AND f.team_id = p_team_id AND f.removed_at IS NULL;
  IF v_total + p_file_size > 104857600 THEN RAISE EXCEPTION 'Team result storage limit is 100 MiB'; END IF;
  v_result_id := gen_random_uuid();
  INSERT INTO public.birth_giving_team_result_files (
    id, event_id, team_id, storage_path, original_file_name, mime_type, file_size,
    uploaded_by_profile_id, created_by_profile_id, updated_by_profile_id
  ) VALUES (
    v_result_id, p_event_id, p_team_id, p_storage_path, p_original_file_name, p_mime_type,
    p_file_size, p_actor_profile_id, p_actor_profile_id, p_actor_profile_id
  );
  UPDATE public.birth_giving_teams SET result_state = 'present', updated_by_profile_id = p_actor_profile_id
  WHERE event_id = p_event_id AND id = p_team_id;
  RETURN v_result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.birth_giving_finalize_storage_cleanup(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.birth_giving_release_storage_cleanup_claim(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.birth_giving_finalize_storage_cleanup(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.birth_giving_release_storage_cleanup_claim(text, uuid) TO service_role;
