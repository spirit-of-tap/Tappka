CREATE TABLE "team_reflection_action_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_reflection_id" uuid NOT NULL,
	"description" text NOT NULL,
	"assignee_profile_id" uuid,
	"custom_assignee" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid
);
--> statement-breakpoint
ALTER TABLE "team_reflection_action_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_reflection_action_steps" ADD CONSTRAINT "team_reflection_action_steps_team_reflection_id_fkey" FOREIGN KEY ("team_reflection_id") REFERENCES "public"."team_reflections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_reflection_action_steps" ADD CONSTRAINT "team_reflection_action_steps_assignee_profile_id_fkey" FOREIGN KEY ("assignee_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_reflection_action_steps" ADD CONSTRAINT "team_reflection_action_steps_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_reflection_action_steps_reflection_idx" ON "team_reflection_action_steps" USING btree ("team_reflection_id" uuid_ops);--> statement-breakpoint
CREATE POLICY "Team members can view action steps" ON "team_reflection_action_steps" AS PERMISSIVE FOR SELECT TO "authenticated" USING (team_reflection_id IN (SELECT id FROM team_reflections WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Team members can create action steps" ON "team_reflection_action_steps" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (team_reflection_id IN (SELECT id FROM team_reflections WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Team members can update action steps" ON "team_reflection_action_steps" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (team_reflection_id IN (SELECT id FROM team_reflections WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL))) WITH CHECK (team_reflection_id IN (SELECT id FROM team_reflections WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Team members can delete action steps" ON "team_reflection_action_steps" AS PERMISSIVE FOR DELETE TO "authenticated" USING (team_reflection_id IN (SELECT id FROM team_reflections WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));