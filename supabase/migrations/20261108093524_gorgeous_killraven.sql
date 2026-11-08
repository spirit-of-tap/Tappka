CREATE TYPE "public"."calendar_sync_status" AS ENUM('synced', 'removed', 'failed');--> statement-breakpoint
CREATE TABLE "team_google_calendars" (
	"team_id" uuid PRIMARY KEY NOT NULL,
	"calendar_id" text NOT NULL,
	"calendar_name" text NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"connected_by_profile_id" uuid,
	"last_synced_at" timestamp with time zone,
	CONSTRAINT "team_google_calendars_calendar_id_check" CHECK (char_length(calendar_id) >= 3 AND char_length(calendar_id) <= 320),
	CONSTRAINT "team_google_calendars_calendar_name_check" CHECK (char_length(calendar_name) <= 500)
);
--> statement-breakpoint
ALTER TABLE "team_google_calendars" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "training_session_calendar_events" (
	"training_session_id" uuid PRIMARY KEY NOT NULL,
	"team_id" uuid NOT NULL,
	"status" "calendar_sync_status" NOT NULL,
	"error_message" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_session_calendar_events_error_check" CHECK (error_message IS NULL OR char_length(error_message) <= 1000)
);
--> statement-breakpoint
ALTER TABLE "training_session_calendar_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_google_calendars" ADD CONSTRAINT "team_google_calendars_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_google_calendars" ADD CONSTRAINT "team_google_calendars_connected_by_profile_id_fkey" FOREIGN KEY ("connected_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_calendar_events" ADD CONSTRAINT "training_session_calendar_events_session_id_fkey" FOREIGN KEY ("training_session_id") REFERENCES "public"."training_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_calendar_events" ADD CONSTRAINT "training_session_calendar_events_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "training_session_calendar_events_team_status_idx" ON "training_session_calendar_events" USING btree ("team_id" uuid_ops,"status" enum_ops);--> statement-breakpoint
CREATE POLICY "Team and coaches can view team calendar" ON "team_google_calendars" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL) OR is_coach_or_admin()));--> statement-breakpoint
CREATE POLICY "Team and coaches can connect team calendar" ON "team_google_calendars" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL) OR is_coach_or_admin()));--> statement-breakpoint
CREATE POLICY "Team and coaches can update team calendar" ON "team_google_calendars" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL) OR is_coach_or_admin())) WITH CHECK ((team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL) OR is_coach_or_admin()));--> statement-breakpoint
CREATE POLICY "Team and coaches can disconnect team calendar" ON "team_google_calendars" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL) OR is_coach_or_admin()));--> statement-breakpoint
CREATE POLICY "Team and coaches can view calendar sync state" ON "training_session_calendar_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL) OR is_coach_or_admin()));