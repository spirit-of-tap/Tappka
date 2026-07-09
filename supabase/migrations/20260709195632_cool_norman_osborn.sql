CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_profile_id" uuid NOT NULL,
	"body" text NOT NULL,
	"archived_at" timestamp with time zone,
	"admin_response" text,
	"admin_response_by" uuid,
	"admin_response_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_body_check" CHECK ((char_length(body) >= 1) AND (char_length(body) <= 4000))
);
--> statement-breakpoint
ALTER TABLE "feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_author_profile_id_fkey" FOREIGN KEY ("author_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_admin_response_by_fkey" FOREIGN KEY ("admin_response_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_active_created_idx" ON "feedback" USING btree ("archived_at" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "feedback_author_idx" ON "feedback" USING btree ("author_profile_id" uuid_ops);--> statement-breakpoint
CREATE POLICY "Authenticated users can view feedback" ON "feedback" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Authenticated users can create feedback" ON "feedback" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((author_profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Admins can update feedback" ON "feedback" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_admin()) WITH CHECK (is_admin());--> statement-breakpoint
CREATE POLICY "Authors and admins can delete feedback" ON "feedback" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((author_profile_id = current_profile_id()) OR is_admin()));