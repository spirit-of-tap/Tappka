ALTER TABLE "profiles" ADD COLUMN "former_team_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "team_left_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "team_removed_by_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_former_team_id_fkey" FOREIGN KEY ("former_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_team_removed_by_profile_id_fkey" FOREIGN KEY ("team_removed_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profiles_former_team_id_idx" ON "profiles" USING btree ("former_team_id" uuid_ops);