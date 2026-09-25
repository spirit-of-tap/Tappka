CREATE TYPE "public"."time_direction" AS ENUM('training', 'reading', 'practise');--> statement-breakpoint
CREATE TYPE "public"."time_entry_source" AS ENUM('timer', 'manual', 'attendance');--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"direction" time_direction NOT NULL,
	"tag_id" uuid,
	"title" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_ms" bigint,
	"source" time_entry_source DEFAULT 'manual' NOT NULL,
	"attendance_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "time_entries_title_check" CHECK ("time_entries"."title" IS NULL OR char_length("time_entries"."title") <= 120),
	CONSTRAINT "time_entries_end_after_start" CHECK ("time_entries"."ended_at" IS NULL OR "time_entries"."ended_at" > "time_entries"."started_at"),
	CONSTRAINT "time_entries_duration_matches" CHECK ((
		("time_entries"."ended_at" IS NULL AND "time_entries"."duration_ms" IS NULL)
		OR ("time_entries"."ended_at" IS NOT NULL AND "time_entries"."duration_ms" IS NOT NULL AND "time_entries"."duration_ms" = (extract(epoch FROM ("time_entries"."ended_at" - "time_entries"."started_at")) * 1000)::bigint)
	))
);
--> statement-breakpoint
ALTER TABLE "time_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "time_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "time_tags_name_check" CHECK (char_length(btrim("time_tags"."name")) BETWEEN 1 AND 40)
);
--> statement-breakpoint
ALTER TABLE "time_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."time_tags"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "public"."team_activity_attendees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_tags" ADD CONSTRAINT "time_tags_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_tags" ADD CONSTRAINT "time_tags_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_tags" ADD CONSTRAINT "time_tags_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "time_entries_profile_started_idx" ON "time_entries" USING btree ("profile_id" uuid_ops,"started_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "time_entries_tag_idx" ON "time_entries" USING btree ("tag_id" uuid_ops) WHERE (tag_id IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "time_entries_one_running_key" ON "time_entries" USING btree ("profile_id" uuid_ops) WHERE (ended_at IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "time_entries_attendance_id_key" ON "time_entries" USING btree ("attendance_id" uuid_ops) WHERE (attendance_id IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "time_tags_profile_name_key" ON "time_tags" USING btree ("profile_id" uuid_ops,lower(btrim("name")));--> statement-breakpoint
CREATE POLICY "Team, coaches and admins can view time entries" ON "time_entries" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((
	profile_id = current_profile_id()
	OR is_coach_or_admin()
	OR profile_id IN (
		SELECT p.id FROM profiles p
		WHERE p.team_id IS NOT NULL
			AND p.access_removed_at IS NULL
			AND p.team_id = (SELECT team_id FROM profiles WHERE id = current_profile_id())
	)
));--> statement-breakpoint
CREATE POLICY "Users can create own time entries" ON "time_entries" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (profile_id = current_profile_id() AND source <> 'attendance');--> statement-breakpoint
CREATE POLICY "Users can update own time entries" ON "time_entries" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (profile_id = current_profile_id()) WITH CHECK (profile_id = current_profile_id());--> statement-breakpoint
CREATE POLICY "Users can delete own time entries" ON "time_entries" AS PERMISSIVE FOR DELETE TO "authenticated" USING (profile_id = current_profile_id());--> statement-breakpoint
CREATE POLICY "Team, coaches and admins can view time tags" ON "time_tags" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((
	profile_id = current_profile_id()
	OR is_coach_or_admin()
	OR profile_id IN (
		SELECT p.id FROM profiles p
		WHERE p.team_id IS NOT NULL
			AND p.access_removed_at IS NULL
			AND p.team_id = (SELECT team_id FROM profiles WHERE id = current_profile_id())
	)
));--> statement-breakpoint
CREATE POLICY "Users can create own time tags" ON "time_tags" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (profile_id = current_profile_id());--> statement-breakpoint
CREATE POLICY "Users can update own time tags" ON "time_tags" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (profile_id = current_profile_id()) WITH CHECK (profile_id = current_profile_id());--> statement-breakpoint
CREATE POLICY "Users can delete own time tags" ON "time_tags" AS PERMISSIVE FOR DELETE TO "authenticated" USING (profile_id = current_profile_id());