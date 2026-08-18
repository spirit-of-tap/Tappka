CREATE TYPE "public"."tool_type" AS ENUM('model', 'technique', 'tool');--> statement-breakpoint
CREATE TABLE "tools_techniques" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"tool_type" "tool_type" NOT NULL,
	"name" text NOT NULL,
	"reflection" text NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tools_techniques" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tools_techniques" ADD CONSTRAINT "tools_techniques_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools_techniques" ADD CONSTRAINT "tools_techniques_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools_techniques" ADD CONSTRAINT "tools_techniques_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tools_techniques_profile_idx" ON "tools_techniques" USING btree ("profile_id" uuid_ops);--> statement-breakpoint
CREATE POLICY "Users can view their own tools and techniques" ON "tools_techniques" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Users can create their own tools and techniques" ON "tools_techniques" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Users can update their own tools and techniques" ON "tools_techniques" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((profile_id = current_profile_id())) WITH CHECK ((profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Users can delete their own tools and techniques" ON "tools_techniques" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((profile_id = current_profile_id()));