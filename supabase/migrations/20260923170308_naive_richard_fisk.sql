ALTER TABLE "teams" ADD COLUMN "group_picture" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "instagram_url" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "linkedin_url" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "ico" text;--> statement-breakpoint
CREATE POLICY "Team members and admins can update teams" ON "teams" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL) OR EXISTS (SELECT 1 FROM profiles WHERE id = current_profile_id() AND role = 'admin' AND access_removed_at IS NULL)) WITH CHECK (id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL) OR EXISTS (SELECT 1 FROM profiles WHERE id = current_profile_id() AND role = 'admin' AND access_removed_at IS NULL));