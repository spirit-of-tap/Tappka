CREATE TABLE "training_session_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"training_session_id" uuid NOT NULL,
	"label" text NOT NULL,
	"file_path" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"content_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	CONSTRAINT "training_session_attachments_label_check" CHECK (char_length(trim(label)) >= 1 AND char_length(label) <= 120),
	CONSTRAINT "training_session_attachments_file_name_check" CHECK (char_length(file_name) >= 1 AND char_length(file_name) <= 255),
	CONSTRAINT "training_session_attachments_file_size_check" CHECK (file_size > 0)
);
--> statement-breakpoint
ALTER TABLE "training_session_attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "training_session_attachments" ADD CONSTRAINT "training_session_attachments_session_id_fkey" FOREIGN KEY ("training_session_id") REFERENCES "public"."training_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_attachments" ADD CONSTRAINT "training_session_attachments_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "training_session_attachments_session_idx" ON "training_session_attachments" USING btree ("training_session_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "training_session_attachments_file_path_idx" ON "training_session_attachments" USING btree ("file_path" text_ops);--> statement-breakpoint
CREATE POLICY "Attachments follow preparation visibility" ON "training_session_attachments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (training_session_id IN (SELECT training_session_id FROM training_session_preparations WHERE published_at IS NOT NULL) OR training_session_id IN (SELECT id FROM training_sessions WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));--> statement-breakpoint
CREATE POLICY "Facilitators can add attachments" ON "training_session_attachments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (created_by_profile_id = current_profile_id() AND training_session_id IN (SELECT id FROM training_sessions WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)) AND training_session_id IN (SELECT training_session_id FROM training_session_facilitators WHERE profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Facilitators can remove attachments" ON "training_session_attachments" AS PERMISSIVE FOR DELETE TO "authenticated" USING (training_session_id IN (SELECT id FROM training_sessions WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)) AND training_session_id IN (SELECT training_session_id FROM training_session_facilitators WHERE profile_id = current_profile_id()));