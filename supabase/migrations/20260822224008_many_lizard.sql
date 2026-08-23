CREATE TYPE "public"."attendance_status" AS ENUM('present', 'absent', 'excused', 'late');--> statement-breakpoint
CREATE TABLE "team_activity_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"status" "attendance_status" DEFAULT 'present' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "team_activity_attendees_activity_profile_key" UNIQUE("activity_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "team_activity_attendees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_activity_attendees" ADD CONSTRAINT "team_activity_attendees_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."team_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_activity_attendees" ADD CONSTRAINT "team_activity_attendees_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_activity_attendees" ADD CONSTRAINT "team_activity_attendees_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_activity_attendees" ADD CONSTRAINT "team_activity_attendees_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_activity_attendees_activity_idx" ON "team_activity_attendees" USING btree ("activity_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "team_activity_attendees_profile_idx" ON "team_activity_attendees" USING btree ("profile_id" uuid_ops);--> statement-breakpoint
CREATE POLICY "Team members can view activity attendees" ON "team_activity_attendees" AS PERMISSIVE FOR SELECT TO "authenticated" USING (activity_id IN (SELECT id FROM team_activities WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Team members can create activity attendees" ON "team_activity_attendees" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (activity_id IN (SELECT id FROM team_activities WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Team members can update activity attendees" ON "team_activity_attendees" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (activity_id IN (SELECT id FROM team_activities WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL))) WITH CHECK (activity_id IN (SELECT id FROM team_activities WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Team members can delete activity attendees" ON "team_activity_attendees" AS PERMISSIVE FOR DELETE TO "authenticated" USING (activity_id IN (SELECT id FROM team_activities WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));