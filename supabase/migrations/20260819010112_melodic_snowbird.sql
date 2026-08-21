ALTER POLICY "Community can view released BG assignments" ON "birth_giving_assignments" TO authenticated USING (EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = event_id AND e.removed_at IS NULL AND ((e.status = 'published' AND e.starts_at <= now() AND EXISTS (
  SELECT 1
  FROM users
  JOIN profiles caller_profile ON caller_profile.user_id = users.id
  WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
    AND caller_profile.access_removed_at IS NULL
)) OR EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = e.id AND o.profile_id = current_profile_id()))));--> statement-breakpoint
ALTER POLICY "BG organizers can insert assignments" ON "birth_giving_assignments" TO authenticated WITH CHECK (false);--> statement-breakpoint
ALTER POLICY "BG organizers can update assignments" ON "birth_giving_assignments" TO authenticated USING (false) WITH CHECK (false);--> statement-breakpoint
ALTER POLICY "BG organizers can view their organizer rows" ON "birth_giving_event_organizers" TO authenticated USING (can_view_birth_giving_event_organizers(event_id));--> statement-breakpoint
ALTER POLICY "Verified community can view published BG events" ON "birth_giving_events" TO authenticated USING (removed_at IS NULL AND can_view_birth_giving_event_organizers(id));--> statement-breakpoint
ALTER POLICY "Profiles can create BG event drafts" ON "birth_giving_events" TO authenticated WITH CHECK (false);--> statement-breakpoint
ALTER POLICY "BG organizers can update events" ON "birth_giving_events" TO authenticated USING (false) WITH CHECK (false);--> statement-breakpoint
ALTER POLICY "Community can view BG team searches" ON "birth_giving_looking_for_team" TO authenticated USING (EXISTS (
  SELECT 1
  FROM users
  JOIN profiles caller_profile ON caller_profile.user_id = users.id
  WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
    AND caller_profile.access_removed_at IS NULL
) AND EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = event_id AND e.status = 'published' AND e.removed_at IS NULL));--> statement-breakpoint
ALTER POLICY "Community can view published BG reflections" ON "birth_giving_reflections" TO authenticated USING (removed_at IS NULL AND EXISTS (
  SELECT 1
  FROM users
  JOIN profiles caller_profile ON caller_profile.user_id = users.id
  WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
    AND caller_profile.access_removed_at IS NULL
) AND EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = event_id AND e.status = 'published' AND e.removed_at IS NULL));--> statement-breakpoint
ALTER POLICY "Community can view published BG memberships" ON "birth_giving_team_members" TO authenticated USING (EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = event_id AND e.removed_at IS NULL AND ((e.status = 'published' AND EXISTS (
  SELECT 1
  FROM users
  JOIN profiles caller_profile ON caller_profile.user_id = users.id
  WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
    AND caller_profile.access_removed_at IS NULL
)) OR EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = e.id AND o.profile_id = current_profile_id()))));--> statement-breakpoint
ALTER POLICY "Community can view published BG result files" ON "birth_giving_team_result_files" TO authenticated USING (removed_at IS NULL AND EXISTS (
  SELECT 1
  FROM users
  JOIN profiles caller_profile ON caller_profile.user_id = users.id
  WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
    AND caller_profile.access_removed_at IS NULL
) AND EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = event_id AND e.status = 'published' AND e.removed_at IS NULL));--> statement-breakpoint
ALTER POLICY "Community can view published BG teams" ON "birth_giving_teams" TO authenticated USING (EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = event_id AND e.removed_at IS NULL AND ((e.status = 'published' AND EXISTS (
  SELECT 1
  FROM users
  JOIN profiles caller_profile ON caller_profile.user_id = users.id
  WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
    AND caller_profile.access_removed_at IS NULL
)) OR EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = e.id AND o.profile_id = current_profile_id()))));