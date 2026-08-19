CREATE OR REPLACE FUNCTION public.birth_giving_can_manage_assignment(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT public.birth_giving_active_profile_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM public.birth_giving_events e
        JOIN public.birth_giving_event_organizers o ON o.event_id = e.id
       WHERE e.id = p_event_id
         AND e.removed_at IS NULL
         AND o.profile_id = public.birth_giving_active_profile_id()
         AND (
           e.status = 'draft'
           OR clock_timestamp() < e.starts_at + (CASE e.duration
             WHEN '8h' THEN interval '8 hours'
             ELSE interval '24 hours'
           END)
         )
    );
$$;

CREATE OR REPLACE FUNCTION public.birth_giving_can_manage_result(p_event_id uuid, p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT public.birth_giving_active_profile_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM public.birth_giving_events e
        JOIN public.birth_giving_teams t ON t.event_id = e.id AND t.id = p_team_id
       WHERE e.id = p_event_id
         AND e.removed_at IS NULL
         AND t.status <> 'cancelled'
         AND (
           (
             e.status = 'published'
             AND e.starts_at <= clock_timestamp()
             AND EXISTS (
               SELECT 1 FROM public.birth_giving_team_members m
                WHERE m.event_id = e.id AND m.team_id = t.id
                  AND m.profile_id = public.birth_giving_active_profile_id()
             )
           )
           OR (
             e.starts_at + (CASE e.duration
               WHEN '8h' THEN interval '8 hours'
               ELSE interval '24 hours'
              END) <= clock_timestamp()
             AND EXISTS (
               SELECT 1 FROM public.birth_giving_event_organizers o
                WHERE o.event_id = e.id
                  AND o.profile_id = public.birth_giving_active_profile_id()
             )
           )
         )
    );
$$;

CREATE OR REPLACE FUNCTION public.birth_giving_confirm_assignment(
  p_event_id uuid,
  p_storage_path text,
  p_original_file_name text,
  p_mime_type text,
  p_file_size bigint
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_event public.birth_giving_events%ROWTYPE;
  v_old_path text;
  v_had_assignment boolean := false;
  v_replacement_id uuid := gen_random_uuid();
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'An active verified profile is required' USING ERRCODE = '42501';
  END IF;
  IF p_storage_path IS NULL OR p_storage_path NOT LIKE 'birth-giving/assignments/' || p_event_id::text || '/%'
     OR length(trim(p_original_file_name)) = 0 OR length(trim(p_mime_type)) = 0
     OR p_file_size < 1 OR p_file_size > 26214400 THEN
    RAISE EXCEPTION 'Invalid assignment file metadata' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_event FROM public.birth_giving_events e
   WHERE e.id = p_event_id AND e.removed_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.birth_giving_event_organizers o
     WHERE o.event_id = p_event_id AND o.profile_id = v_profile_id
  ) THEN
    RAISE EXCEPTION 'Only an event organizer can manage the assignment' USING ERRCODE = '42501';
  END IF;
  IF v_event.status = 'published' AND clock_timestamp() >= v_event.starts_at + (CASE v_event.duration
       WHEN '8h' THEN interval '8 hours' ELSE interval '24 hours' END) THEN
    RAISE EXCEPTION 'Assignment is locked after the event has ended';
  END IF;

  SELECT a.storage_path, a.state = 'present' INTO v_old_path, v_had_assignment
    FROM public.birth_giving_assignments a WHERE a.event_id = p_event_id FOR UPDATE;

  INSERT INTO public.birth_giving_assignments (
    event_id, state, replacement_id, storage_path, original_file_name, mime_type,
    file_size, uploaded_by_profile_id, uploaded_at, created_by_profile_id, updated_by_profile_id
  ) VALUES (
    p_event_id, 'present', v_replacement_id, p_storage_path, p_original_file_name, p_mime_type,
    p_file_size, v_profile_id, clock_timestamp(), v_profile_id, v_profile_id
  )
  ON CONFLICT (event_id) DO UPDATE SET
    state = 'present', replacement_id = excluded.replacement_id,
    storage_path = excluded.storage_path, original_file_name = excluded.original_file_name,
    mime_type = excluded.mime_type, file_size = excluded.file_size,
    uploaded_by_profile_id = excluded.uploaded_by_profile_id, uploaded_at = excluded.uploaded_at,
    updated_by_profile_id = v_profile_id;

  IF v_had_assignment AND v_event.status = 'published'
     AND v_event.starts_at <= clock_timestamp()
     AND clock_timestamp() < v_event.starts_at + (CASE v_event.duration
       WHEN '8h' THEN interval '8 hours' ELSE interval '24 hours' END) THEN
    INSERT INTO public.birth_giving_email_deliveries (
      event_id, profile_id, message_type, replacement_id, recipient_email,
      created_by_profile_id, updated_by_profile_id
    )
    SELECT v_event.id, m.profile_id, 'assignment_replacement', v_replacement_id,
           coalesce(nullif(trim(p.work_email), ''), u.verified_work_email),
           v_profile_id, v_profile_id
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

CREATE OR REPLACE FUNCTION public.birth_giving_mark_assignment_missing(p_event_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_event public.birth_giving_events%ROWTYPE;
  v_old_path text;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'An active verified profile is required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_event FROM public.birth_giving_events e
   WHERE e.id = p_event_id AND e.removed_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.birth_giving_event_organizers o
     WHERE o.event_id = p_event_id AND o.profile_id = v_profile_id
  ) THEN
    RAISE EXCEPTION 'Only an event organizer can manage the assignment' USING ERRCODE = '42501';
  END IF;
  IF clock_timestamp() < v_event.starts_at + (CASE v_event.duration
       WHEN '8h' THEN interval '8 hours' ELSE interval '24 hours' END) THEN
    RAISE EXCEPTION 'Assignment can only be marked missing for a historical event';
  END IF;
  SELECT storage_path INTO v_old_path FROM public.birth_giving_assignments
   WHERE event_id = p_event_id FOR UPDATE;
  INSERT INTO public.birth_giving_assignments (
    event_id, state, replacement_id, created_by_profile_id, updated_by_profile_id
  ) VALUES (p_event_id, 'missing', gen_random_uuid(), v_profile_id, v_profile_id)
  ON CONFLICT (event_id) DO UPDATE SET
    state = 'missing', replacement_id = gen_random_uuid(), storage_path = NULL,
    original_file_name = NULL, mime_type = NULL, file_size = NULL,
    uploaded_by_profile_id = NULL, uploaded_at = NULL, updated_by_profile_id = v_profile_id;
  RETURN v_old_path;
END;
$$;

CREATE OR REPLACE FUNCTION public.birth_giving_confirm_result_file(
  p_event_id uuid,
  p_team_id uuid,
  p_storage_path text,
  p_original_file_name text,
  p_mime_type text,
  p_file_size bigint
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_result_id uuid := gen_random_uuid();
  v_total bigint;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'An active verified profile is required' USING ERRCODE = '42501';
  END IF;
  IF p_storage_path IS NULL OR p_storage_path NOT LIKE 'birth-giving/results/' || p_event_id::text || '/' || p_team_id::text || '/%'
     OR length(trim(p_original_file_name)) = 0 OR length(trim(p_mime_type)) = 0
     OR p_file_size < 1 OR p_file_size > 26214400 THEN
    RAISE EXCEPTION 'Invalid result file metadata' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.birth_giving_teams t
   WHERE t.event_id = p_event_id AND t.id = p_team_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Result team does not belong to the event';
  END IF;
  IF NOT public.birth_giving_can_manage_result(p_event_id, p_team_id) THEN
    RAISE EXCEPTION 'Only a team member or authorized historical organizer can manage results' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(sum(f.file_size), 0) INTO v_total
    FROM public.birth_giving_team_result_files f
   WHERE f.event_id = p_event_id AND f.team_id = p_team_id AND f.removed_at IS NULL;
  IF v_total + p_file_size > 104857600 THEN
    RAISE EXCEPTION 'Team result storage limit is 100 MiB';
  END IF;
  INSERT INTO public.birth_giving_team_result_files (
    id, event_id, team_id, storage_path, original_file_name, mime_type, file_size,
    uploaded_by_profile_id, created_by_profile_id, updated_by_profile_id
  ) VALUES (
    v_result_id, p_event_id, p_team_id, p_storage_path, p_original_file_name, p_mime_type,
    p_file_size, v_profile_id, v_profile_id, v_profile_id
  );
  UPDATE public.birth_giving_teams SET result_state = 'present', updated_by_profile_id = v_profile_id
   WHERE event_id = p_event_id AND id = p_team_id;
  RETURN v_result_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.birth_giving_remove_result_file(p_result_file_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_file public.birth_giving_team_result_files%ROWTYPE;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'An active verified profile is required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_file FROM public.birth_giving_team_result_files f
   WHERE f.id = p_result_file_id AND f.removed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Result file is missing or already removed'; END IF;
  PERFORM 1 FROM public.birth_giving_teams t
   WHERE t.event_id = v_file.event_id AND t.id = v_file.team_id FOR UPDATE;
  IF NOT public.birth_giving_can_manage_result(v_file.event_id, v_file.team_id) THEN
    RAISE EXCEPTION 'Only a team member or authorized historical organizer can manage results' USING ERRCODE = '42501';
  END IF;
  UPDATE public.birth_giving_team_result_files
     SET removed_at = clock_timestamp(), removed_by_profile_id = v_profile_id,
         updated_by_profile_id = v_profile_id
   WHERE id = p_result_file_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.birth_giving_team_result_files f
     WHERE f.event_id = v_file.event_id AND f.team_id = v_file.team_id AND f.removed_at IS NULL
  ) THEN
    UPDATE public.birth_giving_teams SET result_state = 'pending', updated_by_profile_id = v_profile_id
     WHERE event_id = v_file.event_id AND id = v_file.team_id;
  END IF;
  RETURN v_file.storage_path;
END;
$$;

CREATE OR REPLACE FUNCTION public.birth_giving_mark_result_missing(p_event_id uuid, p_team_id uuid)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_profile_id uuid := public.birth_giving_active_profile_id();
  v_event public.birth_giving_events%ROWTYPE;
  v_paths text[];
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'An active verified profile is required' USING ERRCODE = '42501';
  END IF;
  SELECT e.* INTO v_event FROM public.birth_giving_events e
   JOIN public.birth_giving_teams t ON t.event_id = e.id AND t.id = p_team_id
   WHERE e.id = p_event_id AND e.removed_at IS NULL FOR UPDATE OF e;
  IF NOT FOUND THEN RAISE EXCEPTION 'Result team does not belong to the event'; END IF;
  PERFORM 1 FROM public.birth_giving_teams t
   WHERE t.event_id = p_event_id AND t.id = p_team_id FOR UPDATE;
  IF clock_timestamp() < v_event.starts_at + (CASE v_event.duration
       WHEN '8h' THEN interval '8 hours' ELSE interval '24 hours' END) THEN
    RAISE EXCEPTION 'Result can only be marked missing for a historical event';
  END IF;
  IF NOT public.birth_giving_can_manage_result(p_event_id, p_team_id) THEN
    RAISE EXCEPTION 'Only a team member or authorized historical organizer can manage results' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(array_agg(f.storage_path ORDER BY f.storage_path), ARRAY[]::text[]) INTO v_paths
    FROM public.birth_giving_team_result_files f
   WHERE f.event_id = p_event_id AND f.team_id = p_team_id AND f.removed_at IS NULL;
  UPDATE public.birth_giving_team_result_files
     SET removed_at = clock_timestamp(), removed_by_profile_id = v_profile_id,
         updated_by_profile_id = v_profile_id
   WHERE event_id = p_event_id AND team_id = p_team_id AND removed_at IS NULL;
  UPDATE public.birth_giving_teams SET result_state = 'missing', updated_by_profile_id = v_profile_id
   WHERE event_id = p_event_id AND id = p_team_id;
  RETURN v_paths;
END;
$$;

REVOKE ALL ON FUNCTION public.birth_giving_can_manage_assignment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.birth_giving_can_manage_result(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.birth_giving_confirm_assignment(uuid, text, text, text, bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.birth_giving_mark_assignment_missing(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.birth_giving_confirm_result_file(uuid, uuid, text, text, text, bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.birth_giving_remove_result_file(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.birth_giving_mark_result_missing(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.birth_giving_can_manage_assignment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.birth_giving_can_manage_result(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.birth_giving_confirm_assignment(uuid, text, text, text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.birth_giving_mark_assignment_missing(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.birth_giving_confirm_result_file(uuid, uuid, text, text, text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.birth_giving_remove_result_file(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.birth_giving_mark_result_missing(uuid, uuid) TO authenticated;
