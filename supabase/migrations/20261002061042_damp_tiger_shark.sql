CREATE TABLE "training_session_attendees" (
	"training_session_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"status" "attendance_status" DEFAULT 'present' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "training_session_attendees_pkey" PRIMARY KEY("training_session_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "training_session_attendees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "training_session_facilitators" (
	"training_session_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	CONSTRAINT "training_session_facilitators_pkey" PRIMARY KEY("training_session_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "training_session_facilitators" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "training_session_guests" (
	"training_session_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_session_guests_pkey" PRIMARY KEY("training_session_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "training_session_guests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "training_session_preparations" (
	"training_session_id" uuid PRIMARY KEY NOT NULL,
	"content_json" jsonb NOT NULL,
	"content_text" text NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training_session_preparations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "training_session_reflections" (
	"training_session_id" uuid PRIMARY KEY NOT NULL,
	"content_json" jsonb NOT NULL,
	"content_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training_session_reflections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"room_id" uuid,
	"location_note" text,
	"guest_capacity" integer DEFAULT 0 NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_profile_id" uuid,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "training_sessions_time_check" CHECK (ends_at > starts_at),
	CONSTRAINT "training_sessions_capacity_check" CHECK (guest_capacity >= 0 AND guest_capacity <= 50),
	CONSTRAINT "training_sessions_topic_check" CHECK (char_length(topic) >= 1 AND char_length(topic) <= 200),
	CONSTRAINT "training_sessions_description_check" CHECK (description IS NULL OR char_length(description) <= 2000),
	CONSTRAINT "training_sessions_location_note_check" CHECK (location_note IS NULL OR char_length(location_note) <= 200)
);
--> statement-breakpoint
ALTER TABLE "training_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "training_session_attendees" ADD CONSTRAINT "training_session_attendees_session_id_fkey" FOREIGN KEY ("training_session_id") REFERENCES "public"."training_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_attendees" ADD CONSTRAINT "training_session_attendees_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_attendees" ADD CONSTRAINT "training_session_attendees_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_attendees" ADD CONSTRAINT "training_session_attendees_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_facilitators" ADD CONSTRAINT "training_session_facilitators_session_id_fkey" FOREIGN KEY ("training_session_id") REFERENCES "public"."training_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_facilitators" ADD CONSTRAINT "training_session_facilitators_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_facilitators" ADD CONSTRAINT "training_session_facilitators_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_guests" ADD CONSTRAINT "training_session_guests_session_id_fkey" FOREIGN KEY ("training_session_id") REFERENCES "public"."training_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_guests" ADD CONSTRAINT "training_session_guests_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_preparations" ADD CONSTRAINT "training_session_preparations_session_id_fkey" FOREIGN KEY ("training_session_id") REFERENCES "public"."training_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_preparations" ADD CONSTRAINT "training_session_preparations_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_preparations" ADD CONSTRAINT "training_session_preparations_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_reflections" ADD CONSTRAINT "training_session_reflections_session_id_fkey" FOREIGN KEY ("training_session_id") REFERENCES "public"."training_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_reflections" ADD CONSTRAINT "training_session_reflections_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_reflections" ADD CONSTRAINT "training_session_reflections_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_cancelled_by_profile_id_fkey" FOREIGN KEY ("cancelled_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "training_session_facilitators_profile_idx" ON "training_session_facilitators" USING btree ("profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "training_session_guests_profile_idx" ON "training_session_guests" USING btree ("profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "training_sessions_team_starts_at_idx" ON "training_sessions" USING btree ("team_id" uuid_ops,"starts_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "training_sessions_starts_at_idx" ON "training_sessions" USING btree ("starts_at" timestamptz_ops) WHERE removed_at IS NULL;--> statement-breakpoint
CREATE POLICY "Team members can view attendance" ON "training_session_attendees" AS PERMISSIVE FOR SELECT TO "authenticated" USING (training_session_id IN (SELECT id FROM training_sessions WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Team members can record attendance of members and guests" ON "training_session_attendees" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (training_session_id IN (SELECT id FROM training_sessions WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)) AND (profile_id IN (SELECT p.id FROM profiles p JOIN training_sessions s ON s.team_id = p.team_id WHERE s.id = training_session_id) OR profile_id IN (SELECT g.profile_id FROM training_session_guests g WHERE g.training_session_id = training_session_attendees.training_session_id)));--> statement-breakpoint
CREATE POLICY "Team members can update attendance" ON "training_session_attendees" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (training_session_id IN (SELECT id FROM training_sessions WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL))) WITH CHECK (training_session_id IN (SELECT id FROM training_sessions WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Team members can delete attendance" ON "training_session_attendees" AS PERMISSIVE FOR DELETE TO "authenticated" USING (training_session_id IN (SELECT id FROM training_sessions WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Authenticated can view facilitators" ON "training_session_facilitators" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Team members can add facilitators from their team" ON "training_session_facilitators" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (training_session_id IN (SELECT id FROM training_sessions WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)) AND profile_id IN (SELECT p.id FROM profiles p JOIN training_sessions s ON s.team_id = p.team_id WHERE s.id = training_session_id));--> statement-breakpoint
CREATE POLICY "Team members can remove facilitators" ON "training_session_facilitators" AS PERMISSIVE FOR DELETE TO "authenticated" USING (training_session_id IN (SELECT id FROM training_sessions WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Authenticated can view guests" ON "training_session_guests" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Published preparation is public, drafts team only" ON "training_session_preparations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (published_at IS NOT NULL OR training_session_id IN (SELECT id FROM training_sessions WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Team members can create preparation" ON "training_session_preparations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (training_session_id IN (SELECT id FROM training_sessions WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Team members can update preparation" ON "training_session_preparations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (training_session_id IN (SELECT id FROM training_sessions WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL))) WITH CHECK (training_session_id IN (SELECT id FROM training_sessions WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Team members can view reflection" ON "training_session_reflections" AS PERMISSIVE FOR SELECT TO "authenticated" USING (training_session_id IN (SELECT id FROM training_sessions WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Team members can create reflection" ON "training_session_reflections" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (training_session_id IN (SELECT id FROM training_sessions WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Team members can update reflection" ON "training_session_reflections" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (training_session_id IN (SELECT id FROM training_sessions WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL))) WITH CHECK (training_session_id IN (SELECT id FROM training_sessions WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Authenticated can view training sessions" ON "training_sessions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (removed_at IS NULL);--> statement-breakpoint
CREATE POLICY "Team members can create training sessions" ON "training_sessions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL));--> statement-breakpoint
CREATE POLICY "Team members can update training sessions" ON "training_sessions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)) WITH CHECK (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL));