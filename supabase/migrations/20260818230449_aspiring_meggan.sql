CREATE TYPE "public"."team_document_type" AS ENUM('team_contract', 'financial_policy', 'other');--> statement-breakpoint
CREATE TABLE "team_document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"file_path" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"effective_from" date,
	"change_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	CONSTRAINT "team_document_versions_version_positive" CHECK (version_no > 0),
	CONSTRAINT "team_document_versions_file_size_positive" CHECK (file_size > 0)
);
--> statement-breakpoint
ALTER TABLE "team_document_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "team_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"doc_type" "team_document_type" NOT NULL,
	"title" text,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "team_documents_title_matches_type" CHECK ((
		(doc_type = 'other' AND title IS NOT NULL AND length(trim(title)) > 0)
		OR (doc_type <> 'other' AND title IS NULL)
	))
);
--> statement-breakpoint
ALTER TABLE "team_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_document_versions" ADD CONSTRAINT "team_document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."team_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_document_versions" ADD CONSTRAINT "team_document_versions_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_documents" ADD CONSTRAINT "team_documents_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_documents" ADD CONSTRAINT "team_documents_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_documents" ADD CONSTRAINT "team_documents_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_document_versions_document_version_idx" ON "team_document_versions" USING btree ("document_id" uuid_ops,"version_no" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "team_documents_featured_team_type_idx" ON "team_documents" USING btree ("team_id" uuid_ops,"doc_type" enum_ops) WHERE doc_type IN ('team_contract', 'financial_policy') AND removed_at IS NULL;--> statement-breakpoint
CREATE POLICY "Team members can view document versions" ON "team_document_versions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (document_id IN (
			SELECT team_documents.id
			FROM team_documents
			WHERE team_documents.team_id IN (
				SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL
			)
		));--> statement-breakpoint
CREATE POLICY "Team members can create document versions" ON "team_document_versions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (created_by_profile_id = current_profile_id() AND document_id IN (
			SELECT team_documents.id
			FROM team_documents
			WHERE team_documents.removed_at IS NULL
				AND team_documents.team_id IN (
					SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL
				)
		));--> statement-breakpoint
CREATE POLICY "Team members can view documents" ON "team_documents" AS PERMISSIVE FOR SELECT TO "authenticated" USING (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL));--> statement-breakpoint
CREATE POLICY "Team members can create documents" ON "team_documents" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL) AND created_by_profile_id = current_profile_id() AND updated_by_profile_id = current_profile_id());--> statement-breakpoint
CREATE POLICY "Team members can update custom documents" ON "team_documents" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (doc_type = 'other' AND team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)) WITH CHECK (doc_type = 'other' AND team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL) AND updated_by_profile_id = current_profile_id());