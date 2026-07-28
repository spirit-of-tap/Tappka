CREATE TYPE "public"."semester_reflection_topic" AS ENUM('predmety_zkousky_vyucujici', 'metodika_a_metriky', 'kouci_a_mentori', 'tymy_a_tymove_spolecnosti', 'individualni_prinos', 'komunita', 'komunitni_role', 'komunitni_akce', 'komunitni_a_cross_projekty', 'zacleneni_tucnaku', 'dalsi');--> statement-breakpoint
CREATE TABLE "team_semester_reflection_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"semester_reflection_id" uuid NOT NULL,
	"topic" "semester_reflection_topic" NOT NULL,
	"what_went_well" text,
	"what_didnt_go_well" text,
	"what_next_time" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_profile_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_semester_reflection_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "team_semester_reflections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"semester_month" date NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "team_semester_reflections_month_check" CHECK (EXTRACT(MONTH FROM semester_month) IN (1, 5))
);
--> statement-breakpoint
ALTER TABLE "team_semester_reflections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_semester_reflection_entries" ADD CONSTRAINT "team_semester_reflection_entries_semester_reflection_id_fkey" FOREIGN KEY ("semester_reflection_id") REFERENCES "public"."team_semester_reflections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_semester_reflection_entries" ADD CONSTRAINT "team_semester_reflection_entries_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_semester_reflections" ADD CONSTRAINT "team_semester_reflections_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_semester_reflections" ADD CONSTRAINT "team_semester_reflections_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_semester_reflections" ADD CONSTRAINT "team_semester_reflections_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_semester_reflection_entries_reflection_topic_idx" ON "team_semester_reflection_entries" USING btree ("semester_reflection_id" uuid_ops,"topic" enum_ops);--> statement-breakpoint
CREATE INDEX "team_semester_reflection_entries_reflection_idx" ON "team_semester_reflection_entries" USING btree ("semester_reflection_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "team_semester_reflections_team_month_idx" ON "team_semester_reflections" USING btree ("team_id" uuid_ops,"semester_month" date_ops);--> statement-breakpoint
CREATE POLICY "Team members can view semester reflection entries" ON "team_semester_reflection_entries" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM team_semester_reflections tsr WHERE tsr.id = team_semester_reflection_entries.semester_reflection_id AND tsr.team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Team members can create semester reflection entries" ON "team_semester_reflection_entries" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (SELECT 1 FROM team_semester_reflections tsr WHERE tsr.id = team_semester_reflection_entries.semester_reflection_id AND tsr.team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Team members can update semester reflection entries" ON "team_semester_reflection_entries" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (SELECT 1 FROM team_semester_reflections tsr WHERE tsr.id = team_semester_reflection_entries.semester_reflection_id AND tsr.team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL))) WITH CHECK (EXISTS (SELECT 1 FROM team_semester_reflections tsr WHERE tsr.id = team_semester_reflection_entries.semester_reflection_id AND tsr.team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Team members can view semester reflections" ON "team_semester_reflections" AS PERMISSIVE FOR SELECT TO "authenticated" USING (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL));--> statement-breakpoint
CREATE POLICY "Team members can create semester reflections" ON "team_semester_reflections" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL));--> statement-breakpoint
CREATE POLICY "Team members can update semester reflections" ON "team_semester_reflections" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)) WITH CHECK (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL));--> statement-breakpoint
CREATE POLICY "Team members can delete semester reflections" ON "team_semester_reflections" AS PERMISSIVE FOR DELETE TO "authenticated" USING (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL));