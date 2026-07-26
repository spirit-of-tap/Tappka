CREATE TABLE "notification_preferences" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"essay_coach_read_email" boolean DEFAULT true NOT NULL,
	"essay_comment_email" boolean DEFAULT true NOT NULL,
	"essay_vote_email" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "Users can view their own notification preferences" ON "notification_preferences" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Users can insert their own notification preferences" ON "notification_preferences" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Users can update their own notification preferences" ON "notification_preferences" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((profile_id = current_profile_id())) WITH CHECK ((profile_id = current_profile_id()));