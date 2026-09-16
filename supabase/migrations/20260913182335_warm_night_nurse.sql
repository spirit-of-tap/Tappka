CREATE TABLE "rocket_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rocket_categories_code_key" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "rocket_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rocket_individual_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"is_checked" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rocket_individual_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rocket_individual_states" (
	"item_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"is_checked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rocket_individual_states_pkey" PRIMARY KEY("item_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "rocket_individual_states" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rocket_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"text_cs" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rocket_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rocket_team_checks" (
	"team_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"is_checked" boolean DEFAULT false NOT NULL,
	"checked_by_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rocket_team_checks_pkey" PRIMARY KEY("team_id","item_id")
);
--> statement-breakpoint
ALTER TABLE "rocket_team_checks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rocket_team_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"is_checked" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rocket_team_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rocket_individual_history" ADD CONSTRAINT "rocket_individual_history_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."rocket_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rocket_individual_history" ADD CONSTRAINT "rocket_individual_history_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rocket_individual_history" ADD CONSTRAINT "rocket_individual_history_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rocket_individual_states" ADD CONSTRAINT "rocket_individual_states_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."rocket_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rocket_individual_states" ADD CONSTRAINT "rocket_individual_states_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rocket_items" ADD CONSTRAINT "rocket_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."rocket_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rocket_team_checks" ADD CONSTRAINT "rocket_team_checks_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rocket_team_checks" ADD CONSTRAINT "rocket_team_checks_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."rocket_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rocket_team_checks" ADD CONSTRAINT "rocket_team_checks_checked_by_profile_id_fkey" FOREIGN KEY ("checked_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rocket_team_history" ADD CONSTRAINT "rocket_team_history_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rocket_team_history" ADD CONSTRAINT "rocket_team_history_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."rocket_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rocket_team_history" ADD CONSTRAINT "rocket_team_history_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rocket_individual_history_item_profile_idx" ON "rocket_individual_history" USING btree ("item_id" uuid_ops,"profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "rocket_individual_states_profile_idx" ON "rocket_individual_states" USING btree ("profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "rocket_items_category_idx" ON "rocket_items" USING btree ("category_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "rocket_team_history_team_item_idx" ON "rocket_team_history" USING btree ("team_id" uuid_ops,"item_id" uuid_ops);--> statement-breakpoint
CREATE POLICY "Authenticated users can view rocket categories" ON "rocket_categories" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Coaches and admins can add rocket categories" ON "rocket_categories" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_coach_or_admin());--> statement-breakpoint
CREATE POLICY "Coaches and admins can update rocket categories" ON "rocket_categories" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_coach_or_admin()) WITH CHECK (is_coach_or_admin());--> statement-breakpoint
CREATE POLICY "Coaches and admins can delete rocket categories" ON "rocket_categories" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_coach_or_admin());--> statement-breakpoint
CREATE POLICY "Teammates can view individual history" ON "rocket_individual_history" AS PERMISSIVE FOR SELECT TO "authenticated" USING (profile_id IN (SELECT id FROM profiles WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Users can log own individual history" ON "rocket_individual_history" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((profile_id = current_profile_id()) AND (created_by_profile_id = current_profile_id())));--> statement-breakpoint
CREATE POLICY "Teammates can view individual states" ON "rocket_individual_states" AS PERMISSIVE FOR SELECT TO "authenticated" USING (profile_id IN (SELECT id FROM profiles WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Users can insert own individual states" ON "rocket_individual_states" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Users can update own individual states" ON "rocket_individual_states" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((profile_id = current_profile_id())) WITH CHECK ((profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Users can delete own individual states" ON "rocket_individual_states" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Authenticated users can view rocket items" ON "rocket_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Coaches and admins can add rocket items" ON "rocket_items" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_coach_or_admin());--> statement-breakpoint
CREATE POLICY "Coaches and admins can update rocket items" ON "rocket_items" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_coach_or_admin()) WITH CHECK (is_coach_or_admin());--> statement-breakpoint
CREATE POLICY "Coaches and admins can delete rocket items" ON "rocket_items" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_coach_or_admin());--> statement-breakpoint
CREATE POLICY "Team members can view team checks" ON "rocket_team_checks" AS PERMISSIVE FOR SELECT TO "authenticated" USING (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL));--> statement-breakpoint
CREATE POLICY "Team members can create team checks" ON "rocket_team_checks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL));--> statement-breakpoint
CREATE POLICY "Team members can update team checks" ON "rocket_team_checks" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)) WITH CHECK (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL));--> statement-breakpoint
CREATE POLICY "Team members can delete team checks" ON "rocket_team_checks" AS PERMISSIVE FOR DELETE TO "authenticated" USING (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL));--> statement-breakpoint
CREATE POLICY "Team members can view team history" ON "rocket_team_history" AS PERMISSIVE FOR SELECT TO "authenticated" USING (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL));--> statement-breakpoint
CREATE POLICY "Team members can log team history" ON "rocket_team_history" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)) AND (created_by_profile_id = current_profile_id())));