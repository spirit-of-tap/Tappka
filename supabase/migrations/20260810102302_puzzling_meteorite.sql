DROP POLICY "Essay revisions cannot be updated" ON "essay_revisions" CASCADE;--> statement-breakpoint
CREATE POLICY "Authors can update their newest recent essay revision" ON "essay_revisions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((created_by_profile_id = ( SELECT current_profile_id())) AND (created_at > (now() - '00:30:00'::interval)))) WITH CHECK ((created_by_profile_id = ( SELECT current_profile_id())));--> statement-breakpoint
ALTER POLICY "Authenticated users can view essay revisions" ON "essay_revisions" TO authenticated USING ((EXISTS ( SELECT 1
   FROM essays e
  WHERE ((e.id = essay_revisions.essay_id) AND ((e.published_at IS NOT NULL) OR (e.author_profile_id = ( SELECT current_profile_id())) OR ( SELECT is_admin()))))));--> statement-breakpoint
ALTER POLICY "Authenticated users can view all essays" ON "essays" TO authenticated USING (((published_at IS NOT NULL) OR (author_profile_id = ( SELECT current_profile_id())) OR ( SELECT is_admin())));