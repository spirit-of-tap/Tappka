CREATE TABLE "customer_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"meeting_at" timestamp with time zone,
	"company" text NOT NULL,
	"contact_person" text NOT NULL,
	"position" text NOT NULL,
	"objective" text NOT NULL,
	"post_mortem" text,
	"team_share" text,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_meetings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_meetings" ADD CONSTRAINT "customer_meetings_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_meetings" ADD CONSTRAINT "customer_meetings_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_meetings" ADD CONSTRAINT "customer_meetings_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_meetings_profile_idx" ON "customer_meetings" USING btree ("profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "customer_meetings_created_desc_idx" ON "customer_meetings" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE POLICY "Users can view their own customer meetings" ON "customer_meetings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Users can create their own customer meetings" ON "customer_meetings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Users can update their own customer meetings" ON "customer_meetings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((profile_id = current_profile_id())) WITH CHECK ((profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Users can delete their own customer meetings" ON "customer_meetings" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((profile_id = current_profile_id()));