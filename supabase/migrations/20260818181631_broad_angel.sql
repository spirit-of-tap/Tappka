CREATE TYPE "public"."personality_test_type" AS ENUM('gallup', 'mbti', 'disc', 'big_five', 'enneagram', 'belbin', 'other');--> statement-breakpoint
CREATE TABLE "personality_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"test_type" "personality_test_type" NOT NULL,
	"test_type_other" text,
	"tested_on" date NOT NULL,
	"file_path" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "personality_tests_other_type_required" CHECK ((test_type <> 'other' OR (test_type_other IS NOT NULL AND length(trim(test_type_other)) > 0)))
);
--> statement-breakpoint
ALTER TABLE "personality_tests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "personality_tests" ADD CONSTRAINT "personality_tests_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personality_tests" ADD CONSTRAINT "personality_tests_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personality_tests" ADD CONSTRAINT "personality_tests_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "personality_tests_profile_tested_on_idx" ON "personality_tests" USING btree ("profile_id" uuid_ops,"tested_on" date_ops);--> statement-breakpoint
CREATE POLICY "Verified users can view personality tests" ON "personality_tests" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((removed_at IS NULL) AND (EXISTS (SELECT 1 FROM users WHERE (users.auth_user_id = (SELECT auth.uid()) AND users.verified_work_email IS NOT NULL))));--> statement-breakpoint
CREATE POLICY "Users can create their own personality tests" ON "personality_tests" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Users can update their own personality tests" ON "personality_tests" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((profile_id = current_profile_id())) WITH CHECK ((profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Users can delete their own personality tests" ON "personality_tests" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((profile_id = current_profile_id()));