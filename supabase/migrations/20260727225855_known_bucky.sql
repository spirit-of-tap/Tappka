CREATE TABLE "individual_coaching_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"session_at" timestamp with time zone,
	"coach_profile_id" uuid,
	"external_coach_name" text,
	"key_takeaways" text,
	"action_steps" text,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "individual_coaching_sessions_coach_xor" CHECK ((coach_profile_id IS NOT NULL) <> (external_coach_name IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "individual_coaching_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "individual_coaching_sessions" ADD CONSTRAINT "individual_coaching_sessions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "individual_coaching_sessions" ADD CONSTRAINT "individual_coaching_sessions_coach_profile_id_fkey" FOREIGN KEY ("coach_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "individual_coaching_sessions" ADD CONSTRAINT "individual_coaching_sessions_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "individual_coaching_sessions" ADD CONSTRAINT "individual_coaching_sessions_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "individual_coaching_sessions_profile_idx" ON "individual_coaching_sessions" USING btree ("profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "individual_coaching_sessions_coach_idx" ON "individual_coaching_sessions" USING btree ("coach_profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "individual_coaching_sessions_created_desc_idx" ON "individual_coaching_sessions" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE POLICY "Users can view their own coaching sessions" ON "individual_coaching_sessions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Users can create their own coaching sessions" ON "individual_coaching_sessions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Users can update their own coaching sessions" ON "individual_coaching_sessions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((profile_id = current_profile_id())) WITH CHECK ((profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Users can delete their own coaching sessions" ON "individual_coaching_sessions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((profile_id = current_profile_id()));