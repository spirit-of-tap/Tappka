ALTER TABLE "team_annual_reflection_entries" DROP CONSTRAINT "team_annual_reflection_entries_updated_by_profile_id_fkey";
--> statement-breakpoint
ALTER TABLE "team_annual_reflection_entries" ALTER COLUMN "updated_by_profile_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "team_annual_reflection_entries" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "team_annual_reflection_entries" ADD CONSTRAINT "team_annual_reflection_entries_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;