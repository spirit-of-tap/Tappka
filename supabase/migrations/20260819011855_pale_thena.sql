ALTER TABLE "birth_giving_events" DROP CONSTRAINT "birth_giving_events_normalized_name_check";--> statement-breakpoint
ALTER TABLE "birth_giving_events" DROP CONSTRAINT "birth_giving_events_normalized_customer_check";--> statement-breakpoint
ALTER TABLE "birth_giving_events" ADD CONSTRAINT "birth_giving_events_normalized_name_check" CHECK (normalized_name = lower(regexp_replace(trim(normalize(name, NFKC)), '[[:space:]]+', ' ', 'g')));--> statement-breakpoint
ALTER TABLE "birth_giving_events" ADD CONSTRAINT "birth_giving_events_normalized_customer_check" CHECK (normalized_customer = lower(regexp_replace(trim(normalize(customer, NFKC)), '[[:space:]]+', ' ', 'g')));--> statement-breakpoint
ALTER POLICY "Community can view released BG assignments" ON "birth_giving_assignments" TO authenticated USING (EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = birth_giving_assignments.event_id AND e.removed_at IS NULL AND ((e.status = 'published' AND e.starts_at <= now() AND EXISTS (
  SELECT 1
  FROM users
  JOIN profiles caller_profile ON caller_profile.user_id = users.id
  WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
    AND caller_profile.access_removed_at IS NULL
)) OR EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = e.id AND o.profile_id = current_profile_id()))));--> statement-breakpoint
ALTER POLICY "Community can view BG team searches" ON "birth_giving_looking_for_team" TO authenticated USING (EXISTS (
  SELECT 1
  FROM users
  JOIN profiles caller_profile ON caller_profile.user_id = users.id
  WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
    AND caller_profile.access_removed_at IS NULL
) AND EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = birth_giving_looking_for_team.event_id AND e.status = 'published' AND e.removed_at IS NULL));--> statement-breakpoint
ALTER POLICY "Profiles can start their own BG team search" ON "birth_giving_looking_for_team" TO authenticated WITH CHECK (profile_id = current_profile_id() AND created_by_profile_id = current_profile_id() AND updated_by_profile_id = current_profile_id() AND EXISTS (
  SELECT 1
  FROM profiles caller_profile
  WHERE caller_profile.id = current_profile_id()
    AND caller_profile.access_removed_at IS NULL
) AND EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = birth_giving_looking_for_team.event_id AND e.status = 'published' AND e.joining_open AND now() < e.starts_at AND e.removed_at IS NULL) AND NOT EXISTS (SELECT 1 FROM birth_giving_team_members m WHERE m.event_id = birth_giving_looking_for_team.event_id AND m.profile_id = current_profile_id()));--> statement-breakpoint
ALTER POLICY "Profiles can update their own BG team search" ON "birth_giving_looking_for_team" TO authenticated USING (profile_id = current_profile_id() AND created_by_profile_id = current_profile_id() AND updated_by_profile_id = current_profile_id() AND EXISTS (
  SELECT 1
  FROM profiles caller_profile
  WHERE caller_profile.id = current_profile_id()
    AND caller_profile.access_removed_at IS NULL
) AND EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = birth_giving_looking_for_team.event_id AND e.status = 'published' AND e.joining_open AND now() < e.starts_at AND e.removed_at IS NULL) AND NOT EXISTS (SELECT 1 FROM birth_giving_team_members m WHERE m.event_id = birth_giving_looking_for_team.event_id AND m.profile_id = current_profile_id())) WITH CHECK (profile_id = current_profile_id() AND created_by_profile_id = current_profile_id() AND updated_by_profile_id = current_profile_id() AND EXISTS (
  SELECT 1
  FROM profiles caller_profile
  WHERE caller_profile.id = current_profile_id()
    AND caller_profile.access_removed_at IS NULL
) AND EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = birth_giving_looking_for_team.event_id AND e.status = 'published' AND e.joining_open AND now() < e.starts_at AND e.removed_at IS NULL) AND NOT EXISTS (SELECT 1 FROM birth_giving_team_members m WHERE m.event_id = birth_giving_looking_for_team.event_id AND m.profile_id = current_profile_id()));--> statement-breakpoint
ALTER POLICY "Community can view published BG reflections" ON "birth_giving_reflections" TO authenticated USING (removed_at IS NULL AND EXISTS (
  SELECT 1
  FROM users
  JOIN profiles caller_profile ON caller_profile.user_id = users.id
  WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
    AND caller_profile.access_removed_at IS NULL
) AND EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = birth_giving_reflections.event_id AND e.status = 'published' AND e.removed_at IS NULL));--> statement-breakpoint
ALTER POLICY "Participants can create their BG reflections" ON "birth_giving_reflections" TO authenticated WITH CHECK (EXISTS (
  SELECT 1
  FROM profiles caller_profile
  WHERE caller_profile.id = current_profile_id()
    AND caller_profile.access_removed_at IS NULL
) AND profile_id = current_profile_id() AND created_by_profile_id = current_profile_id() AND updated_by_profile_id = current_profile_id());--> statement-breakpoint
ALTER POLICY "Participants can update their BG reflections" ON "birth_giving_reflections" TO authenticated USING (EXISTS (
  SELECT 1
  FROM profiles caller_profile
  WHERE caller_profile.id = current_profile_id()
    AND caller_profile.access_removed_at IS NULL
) AND profile_id = current_profile_id()) WITH CHECK (EXISTS (
  SELECT 1
  FROM profiles caller_profile
  WHERE caller_profile.id = current_profile_id()
    AND caller_profile.access_removed_at IS NULL
) AND profile_id = current_profile_id() AND updated_by_profile_id = current_profile_id());--> statement-breakpoint
ALTER POLICY "Community can view published BG memberships" ON "birth_giving_team_members" TO authenticated USING (EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = birth_giving_team_members.event_id AND e.removed_at IS NULL AND ((e.status = 'published' AND EXISTS (
  SELECT 1
  FROM users
  JOIN profiles caller_profile ON caller_profile.user_id = users.id
  WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
    AND caller_profile.access_removed_at IS NULL
)) OR EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = e.id AND o.profile_id = current_profile_id()))));--> statement-breakpoint
ALTER POLICY "Profiles can view relevant BG proposals" ON "birth_giving_team_proposals" TO authenticated USING (EXISTS (
  SELECT 1
  FROM profiles caller_profile
  WHERE caller_profile.id = current_profile_id()
    AND caller_profile.access_removed_at IS NULL
) AND (candidate_profile_id = current_profile_id() OR initiated_by_profile_id = current_profile_id() OR EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = birth_giving_team_proposals.event_id AND o.profile_id = current_profile_id()) OR EXISTS (SELECT 1 FROM birth_giving_team_members m WHERE m.event_id = birth_giving_team_proposals.event_id AND m.team_id = birth_giving_team_proposals.team_id AND m.profile_id = current_profile_id())));--> statement-breakpoint
ALTER POLICY "Community can view published BG result files" ON "birth_giving_team_result_files" TO authenticated USING (birth_giving_team_result_files.removed_at IS NULL AND EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = birth_giving_team_result_files.event_id AND e.removed_at IS NULL AND ((e.status = 'published' AND EXISTS (
  SELECT 1
  FROM users
  JOIN profiles caller_profile ON caller_profile.user_id = users.id
  WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
    AND caller_profile.access_removed_at IS NULL
)) OR EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = e.id AND o.profile_id = current_profile_id()))));--> statement-breakpoint
ALTER POLICY "BG members and organizers can insert result files" ON "birth_giving_team_result_files" TO authenticated WITH CHECK (false);--> statement-breakpoint
ALTER POLICY "BG members and organizers can update result files" ON "birth_giving_team_result_files" TO authenticated USING (false) WITH CHECK (false);--> statement-breakpoint
ALTER POLICY "Community can view published BG teams" ON "birth_giving_teams" TO authenticated USING (EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = birth_giving_teams.event_id AND e.removed_at IS NULL AND ((e.status = 'published' AND EXISTS (
  SELECT 1
  FROM users
  JOIN profiles caller_profile ON caller_profile.user_id = users.id
  WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
    AND caller_profile.access_removed_at IS NULL
)) OR EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = e.id AND o.profile_id = current_profile_id()))));