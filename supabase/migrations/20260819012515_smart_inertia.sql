ALTER POLICY "Profiles can stop their own BG team search" ON "birth_giving_looking_for_team" TO authenticated USING (EXISTS (
  SELECT 1
  FROM profiles caller_profile
  WHERE caller_profile.id = current_profile_id()
    AND caller_profile.access_removed_at IS NULL
) AND profile_id = current_profile_id());--> statement-breakpoint
ALTER POLICY "Participants can create their BG reflections" ON "birth_giving_reflections" TO authenticated WITH CHECK (false);--> statement-breakpoint
ALTER POLICY "Participants can update their BG reflections" ON "birth_giving_reflections" TO authenticated USING (false) WITH CHECK (false);