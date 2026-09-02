CREATE TYPE "public"."content_source_kind" AS ENUM('podcast', 'conference', 'program', 'other');--> statement-breakpoint
CREATE TYPE "public"."content_source_status" AS ENUM('pending_review', 'approved', 'archived');--> statement-breakpoint
CREATE TABLE "content_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "content_source_kind" NOT NULL,
	"title" text NOT NULL,
	"creator" text,
	"description" text,
	"external_url" text,
	"points" numeric(3, 2),
	"status" "content_source_status" DEFAULT 'pending_review' NOT NULL,
	"status_changed_at" timestamp with time zone,
	"status_changed_by_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "content_sources_points_check" CHECK ((points IS NULL) OR ((points >= (0)::numeric) AND (points <= (3)::numeric)))
);
--> statement-breakpoint
ALTER TABLE "content_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "essays" ADD COLUMN "content_source_id" uuid;--> statement-breakpoint
ALTER TABLE "content_sources" ADD CONSTRAINT "content_sources_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_sources" ADD CONSTRAINT "content_sources_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_sources" ADD CONSTRAINT "content_sources_status_changed_by_profile_id_fkey" FOREIGN KEY ("status_changed_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_sources_created_by_idx" ON "content_sources" USING btree ("created_by_profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "content_sources_status_idx" ON "content_sources" USING btree ("status" enum_ops);--> statement-breakpoint
ALTER TABLE "essays" ADD CONSTRAINT "essays_content_source_id_fkey" FOREIGN KEY ("content_source_id") REFERENCES "public"."content_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "essays_content_source_idx" ON "essays" USING btree ("content_source_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "essays" ADD CONSTRAINT "essays_source_exclusive_check" CHECK (NOT ((book_id IS NOT NULL) AND (content_source_id IS NOT NULL)));--> statement-breakpoint
CREATE POLICY "Authenticated users can view all content sources" ON "content_sources" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Authenticated users can add content sources" ON "content_sources" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((created_by_profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Coaches and admins can update content sources" ON "content_sources" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_coach_or_admin()) WITH CHECK (is_coach_or_admin());--> statement-breakpoint
CREATE POLICY "Coaches and admins can delete content sources" ON "content_sources" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_coach_or_admin());