CREATE TABLE "team_reflections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"month" date NOT NULL,
	"what_went_well" text,
	"what_didnt_go_well" text,
	"what_we_do_differently" text,
	"planned_action_steps" text,
	"responsible_person" text,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_reflections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_reflections" ADD CONSTRAINT "team_reflections_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_reflections" ADD CONSTRAINT "team_reflections_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_reflections" ADD CONSTRAINT "team_reflections_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_reflections_team_month_idx" ON "team_reflections" USING btree ("team_id" uuid_ops,"month" date_ops);--> statement-breakpoint
CREATE POLICY "Team members can view reflections" ON "team_reflections" AS PERMISSIVE FOR SELECT TO "authenticated" USING (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL));--> statement-breakpoint
CREATE POLICY "Team members can create reflections" ON "team_reflections" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL));--> statement-breakpoint
CREATE POLICY "Team members can update reflections" ON "team_reflections" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)) WITH CHECK (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL));--> statement-breakpoint
CREATE POLICY "Team members can delete reflections" ON "team_reflections" AS PERMISSIVE FOR DELETE TO "authenticated" USING (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL));