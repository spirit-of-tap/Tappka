ALTER POLICY "Community can view published BG result files" ON "birth_giving_team_result_files" TO authenticated USING (removed_at IS NULL AND EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = event_id AND e.removed_at IS NULL AND ((e.status = 'published' AND EXISTS (
  SELECT 1
  FROM users
  JOIN profiles caller_profile ON caller_profile.user_id = users.id
  WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
    AND caller_profile.access_removed_at IS NULL
)) OR EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = e.id AND o.profile_id = current_profile_id()))));