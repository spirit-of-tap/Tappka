CREATE TYPE "public"."birth_giving_assignment_state" AS ENUM('present', 'missing');--> statement-breakpoint
CREATE TYPE "public"."birth_giving_delivery_status" AS ENUM('pending', 'processing', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."birth_giving_duration" AS ENUM('8h', '24h');--> statement-breakpoint
CREATE TYPE "public"."birth_giving_email_message_type" AS ENUM('assignment_release', 'assignment_replacement');--> statement-breakpoint
CREATE TYPE "public"."birth_giving_event_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."birth_giving_proposal_direction" AS ENUM('join_request', 'invitation');--> statement-breakpoint
CREATE TYPE "public"."birth_giving_proposal_state" AS ENUM('pending', 'accepted', 'rejected', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."birth_giving_team_result_state" AS ENUM('pending', 'present', 'missing');--> statement-breakpoint
CREATE TYPE "public"."birth_giving_team_status" AS ENUM('forming', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TABLE "birth_giving_assignments" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"state" "birth_giving_assignment_state" NOT NULL,
	"replacement_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"storage_path" text,
	"original_file_name" text,
	"mime_type" text,
	"file_size" bigint,
	"uploaded_by_profile_id" uuid,
	"uploaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "birth_giving_assignments_metadata_check" CHECK ((state = 'present' AND storage_path IS NOT NULL AND length(trim(storage_path)) > 0 AND original_file_name IS NOT NULL AND length(trim(original_file_name)) > 0 AND mime_type IS NOT NULL AND length(trim(mime_type)) > 0 AND file_size > 0 AND uploaded_by_profile_id IS NOT NULL AND uploaded_at IS NOT NULL) OR (state = 'missing' AND storage_path IS NULL AND original_file_name IS NULL AND mime_type IS NULL AND file_size IS NULL AND uploaded_by_profile_id IS NULL AND uploaded_at IS NULL))
);
--> statement-breakpoint
ALTER TABLE "birth_giving_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "birth_giving_email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"message_type" "birth_giving_email_message_type" NOT NULL,
	"replacement_id" uuid,
	"recipient_email" text NOT NULL,
	"status" "birth_giving_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processing_started_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"provider_message_id" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "birth_giving_email_deliveries_dedupe_key" UNIQUE NULLS NOT DISTINCT("event_id","profile_id","message_type","replacement_id"),
	CONSTRAINT "birth_giving_email_deliveries_message_check" CHECK ((message_type = 'assignment_release' AND replacement_id IS NULL) OR (message_type = 'assignment_replacement' AND replacement_id IS NOT NULL)),
	CONSTRAINT "birth_giving_email_deliveries_attempt_count_check" CHECK (attempt_count >= 0),
	CONSTRAINT "birth_giving_email_deliveries_recipient_check" CHECK (length(trim(recipient_email)) > 0)
);
--> statement-breakpoint
ALTER TABLE "birth_giving_email_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "birth_giving_event_organizers" (
	"event_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "birth_giving_event_organizers_pkey" PRIMARY KEY("event_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "birth_giving_event_organizers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "birth_giving_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"customer" text NOT NULL,
	"normalized_customer" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration" "birth_giving_duration" NOT NULL,
	"minimum_team_size" integer NOT NULL,
	"maximum_team_size" integer NOT NULL,
	"joining_open" boolean NOT NULL,
	"status" "birth_giving_event_status" DEFAULT 'draft' NOT NULL,
	"start_processed_at" timestamp with time zone,
	"start_emails_queued_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"removed_by_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "birth_giving_events_identity_key" UNIQUE("normalized_name","normalized_customer","starts_at"),
	CONSTRAINT "birth_giving_events_name_check" CHECK (length(trim(name)) > 0 AND length(trim(normalized_name)) > 0),
	CONSTRAINT "birth_giving_events_customer_check" CHECK (length(trim(customer)) > 0 AND length(trim(normalized_customer)) > 0),
	CONSTRAINT "birth_giving_events_team_sizes_check" CHECK (minimum_team_size >= 1 AND maximum_team_size >= minimum_team_size),
	CONSTRAINT "birth_giving_events_removed_check" CHECK ((removed_at IS NULL) = (removed_by_profile_id IS NULL))
);
--> statement-breakpoint
ALTER TABLE "birth_giving_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "birth_giving_looking_for_team" (
	"event_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "birth_giving_looking_for_team_pkey" PRIMARY KEY("event_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "birth_giving_looking_for_team" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "birth_giving_reflections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"contribution" text NOT NULL,
	"learning" text NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "birth_giving_reflections_event_profile_key" UNIQUE("event_id","profile_id"),
	CONSTRAINT "birth_giving_reflections_content_check" CHECK (length(trim(contribution)) > 0 AND length(trim(learning)) > 0)
);
--> statement-breakpoint
ALTER TABLE "birth_giving_reflections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "birth_giving_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"frozen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "birth_giving_team_members_event_profile_key" UNIQUE("event_id","profile_id"),
	CONSTRAINT "birth_giving_team_members_event_team_profile_key" UNIQUE("event_id","team_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "birth_giving_team_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "birth_giving_team_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"candidate_profile_id" uuid NOT NULL,
	"initiated_by_profile_id" uuid NOT NULL,
	"direction" "birth_giving_proposal_direction" NOT NULL,
	"state" "birth_giving_proposal_state" DEFAULT 'pending' NOT NULL,
	"resolved_by_profile_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "birth_giving_team_proposals_direction_check" CHECK ((direction = 'join_request' AND candidate_profile_id = initiated_by_profile_id) OR (direction = 'invitation' AND candidate_profile_id <> initiated_by_profile_id)),
	CONSTRAINT "birth_giving_team_proposals_resolution_check" CHECK ((state = 'pending' AND resolved_by_profile_id IS NULL AND resolved_at IS NULL) OR (state <> 'pending' AND resolved_at IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "birth_giving_team_proposals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "birth_giving_team_result_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"original_file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" bigint NOT NULL,
	"uploaded_by_profile_id" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "birth_giving_team_result_files_storage_path_key" UNIQUE("storage_path"),
	CONSTRAINT "birth_giving_team_result_files_metadata_check" CHECK (length(trim(storage_path)) > 0 AND length(trim(original_file_name)) > 0 AND length(trim(mime_type)) > 0 AND file_size > 0),
	CONSTRAINT "birth_giving_team_result_files_removed_check" CHECK ((removed_at IS NULL) = (removed_by_profile_id IS NULL))
);
--> statement-breakpoint
ALTER TABLE "birth_giving_team_result_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "birth_giving_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "birth_giving_team_status" DEFAULT 'forming' NOT NULL,
	"result_state" "birth_giving_team_result_state" DEFAULT 'pending' NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "birth_giving_teams_event_id_id_key" UNIQUE("event_id","id"),
	CONSTRAINT "birth_giving_teams_name_check" CHECK (length(trim(name)) > 0),
	CONSTRAINT "birth_giving_teams_cancellation_check" CHECK ((status = 'cancelled' AND cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL AND length(trim(cancellation_reason)) > 0) OR (status <> 'cancelled' AND cancelled_at IS NULL AND cancellation_reason IS NULL))
);
--> statement-breakpoint
ALTER TABLE "birth_giving_teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "birth_giving_assignments" ADD CONSTRAINT "birth_giving_assignments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."birth_giving_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_assignments" ADD CONSTRAINT "birth_giving_assignments_uploaded_by_profile_id_fkey" FOREIGN KEY ("uploaded_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_assignments" ADD CONSTRAINT "birth_giving_assignments_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_assignments" ADD CONSTRAINT "birth_giving_assignments_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_email_deliveries" ADD CONSTRAINT "birth_giving_email_deliveries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."birth_giving_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_email_deliveries" ADD CONSTRAINT "birth_giving_email_deliveries_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_email_deliveries" ADD CONSTRAINT "birth_giving_email_deliveries_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_email_deliveries" ADD CONSTRAINT "birth_giving_email_deliveries_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_event_organizers" ADD CONSTRAINT "birth_giving_event_organizers_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."birth_giving_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_event_organizers" ADD CONSTRAINT "birth_giving_event_organizers_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_event_organizers" ADD CONSTRAINT "birth_giving_event_organizers_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_event_organizers" ADD CONSTRAINT "birth_giving_event_organizers_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_events" ADD CONSTRAINT "birth_giving_events_removed_by_profile_id_fkey" FOREIGN KEY ("removed_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_events" ADD CONSTRAINT "birth_giving_events_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_events" ADD CONSTRAINT "birth_giving_events_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_looking_for_team" ADD CONSTRAINT "birth_giving_looking_for_team_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."birth_giving_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_looking_for_team" ADD CONSTRAINT "birth_giving_looking_for_team_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_looking_for_team" ADD CONSTRAINT "birth_giving_looking_for_team_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_looking_for_team" ADD CONSTRAINT "birth_giving_looking_for_team_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_reflections" ADD CONSTRAINT "birth_giving_reflections_participant_fkey" FOREIGN KEY ("event_id","profile_id") REFERENCES "public"."birth_giving_team_members"("event_id","profile_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_reflections" ADD CONSTRAINT "birth_giving_reflections_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_reflections" ADD CONSTRAINT "birth_giving_reflections_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_team_members" ADD CONSTRAINT "birth_giving_team_members_event_team_fkey" FOREIGN KEY ("event_id","team_id") REFERENCES "public"."birth_giving_teams"("event_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_team_members" ADD CONSTRAINT "birth_giving_team_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_team_members" ADD CONSTRAINT "birth_giving_team_members_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_team_members" ADD CONSTRAINT "birth_giving_team_members_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_team_proposals" ADD CONSTRAINT "birth_giving_team_proposals_event_team_fkey" FOREIGN KEY ("event_id","team_id") REFERENCES "public"."birth_giving_teams"("event_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_team_proposals" ADD CONSTRAINT "birth_giving_team_proposals_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_team_proposals" ADD CONSTRAINT "birth_giving_team_proposals_initiated_by_profile_id_fkey" FOREIGN KEY ("initiated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_team_proposals" ADD CONSTRAINT "birth_giving_team_proposals_resolved_by_profile_id_fkey" FOREIGN KEY ("resolved_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_team_proposals" ADD CONSTRAINT "birth_giving_team_proposals_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_team_proposals" ADD CONSTRAINT "birth_giving_team_proposals_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_team_result_files" ADD CONSTRAINT "birth_giving_team_result_files_event_team_fkey" FOREIGN KEY ("event_id","team_id") REFERENCES "public"."birth_giving_teams"("event_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_team_result_files" ADD CONSTRAINT "birth_giving_team_result_files_uploaded_by_profile_id_fkey" FOREIGN KEY ("uploaded_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_team_result_files" ADD CONSTRAINT "birth_giving_team_result_files_removed_by_profile_id_fkey" FOREIGN KEY ("removed_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_team_result_files" ADD CONSTRAINT "birth_giving_team_result_files_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_team_result_files" ADD CONSTRAINT "birth_giving_team_result_files_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_teams" ADD CONSTRAINT "birth_giving_teams_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."birth_giving_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_teams" ADD CONSTRAINT "birth_giving_teams_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_teams" ADD CONSTRAINT "birth_giving_teams_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "birth_giving_email_deliveries_pending_idx" ON "birth_giving_email_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "birth_giving_event_organizers_profile_idx" ON "birth_giving_event_organizers" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "birth_giving_events_status_starts_at_idx" ON "birth_giving_events" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "birth_giving_looking_for_team_profile_idx" ON "birth_giving_looking_for_team" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "birth_giving_reflections_profile_idx" ON "birth_giving_reflections" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "birth_giving_team_members_team_idx" ON "birth_giving_team_members" USING btree ("event_id","team_id");--> statement-breakpoint
CREATE INDEX "birth_giving_team_proposals_event_candidate_idx" ON "birth_giving_team_proposals" USING btree ("event_id","candidate_profile_id");--> statement-breakpoint
CREATE INDEX "birth_giving_team_proposals_team_state_idx" ON "birth_giving_team_proposals" USING btree ("event_id","team_id","state");--> statement-breakpoint
CREATE INDEX "birth_giving_team_result_files_team_idx" ON "birth_giving_team_result_files" USING btree ("event_id","team_id");--> statement-breakpoint
CREATE INDEX "birth_giving_teams_event_idx" ON "birth_giving_teams" USING btree ("event_id");--> statement-breakpoint
CREATE POLICY "Community can view released BG assignments" ON "birth_giving_assignments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = event_id AND e.removed_at IS NULL AND ((e.status = 'published' AND e.starts_at <= now() AND EXISTS (
  SELECT 1 FROM users
  WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
)) OR EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = e.id AND o.profile_id = current_profile_id()))));--> statement-breakpoint
CREATE POLICY "BG organizers can insert assignments" ON "birth_giving_assignments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = event_id AND o.profile_id = current_profile_id()) AND created_by_profile_id = current_profile_id() AND updated_by_profile_id = current_profile_id());--> statement-breakpoint
CREATE POLICY "BG organizers can update assignments" ON "birth_giving_assignments" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = event_id AND o.profile_id = current_profile_id())) WITH CHECK (EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = event_id AND o.profile_id = current_profile_id()) AND updated_by_profile_id = current_profile_id());--> statement-breakpoint
CREATE POLICY "BG assignments cannot be directly deleted" ON "birth_giving_assignments" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "BG delivery outbox is private" ON "birth_giving_email_deliveries" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "BG organizers can view their organizer rows" ON "birth_giving_event_organizers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (profile_id = current_profile_id());--> statement-breakpoint
CREATE POLICY "BG organizer changes use lifecycle RPCs" ON "birth_giving_event_organizers" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "Verified community can view published BG events" ON "birth_giving_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING (removed_at IS NULL AND ((EXISTS (
  SELECT 1 FROM users
  WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
) AND status = 'published') OR EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = id AND o.profile_id = current_profile_id())));--> statement-breakpoint
CREATE POLICY "Profiles can create BG event drafts" ON "birth_giving_events" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (status = 'draft' AND created_by_profile_id = current_profile_id() AND updated_by_profile_id = current_profile_id());--> statement-breakpoint
CREATE POLICY "BG organizers can update events" ON "birth_giving_events" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = id AND o.profile_id = current_profile_id())) WITH CHECK (EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = id AND o.profile_id = current_profile_id()) AND updated_by_profile_id = current_profile_id());--> statement-breakpoint
CREATE POLICY "BG events cannot be directly deleted" ON "birth_giving_events" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "Community can view BG team searches" ON "birth_giving_looking_for_team" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
  SELECT 1 FROM users
  WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
) AND EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = event_id AND e.status = 'published' AND e.removed_at IS NULL));--> statement-breakpoint
CREATE POLICY "Profiles can start their own BG team search" ON "birth_giving_looking_for_team" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (profile_id = current_profile_id() AND created_by_profile_id = current_profile_id() AND updated_by_profile_id = current_profile_id() AND EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = event_id AND e.status = 'published' AND e.joining_open AND e.starts_at > now() AND e.removed_at IS NULL));--> statement-breakpoint
CREATE POLICY "Profiles can stop their own BG team search" ON "birth_giving_looking_for_team" AS PERMISSIVE FOR DELETE TO "authenticated" USING (profile_id = current_profile_id());--> statement-breakpoint
CREATE POLICY "Community can view published BG reflections" ON "birth_giving_reflections" AS PERMISSIVE FOR SELECT TO "authenticated" USING (removed_at IS NULL AND EXISTS (
  SELECT 1 FROM users
  WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
) AND EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = event_id AND e.status = 'published' AND e.removed_at IS NULL));--> statement-breakpoint
CREATE POLICY "Participants can create their BG reflections" ON "birth_giving_reflections" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (profile_id = current_profile_id() AND created_by_profile_id = current_profile_id() AND updated_by_profile_id = current_profile_id());--> statement-breakpoint
CREATE POLICY "Participants can update their BG reflections" ON "birth_giving_reflections" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (profile_id = current_profile_id()) WITH CHECK (profile_id = current_profile_id() AND updated_by_profile_id = current_profile_id());--> statement-breakpoint
CREATE POLICY "BG reflections cannot be directly deleted" ON "birth_giving_reflections" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "Community can view published BG memberships" ON "birth_giving_team_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = event_id AND e.removed_at IS NULL AND ((e.status = 'published' AND EXISTS (
  SELECT 1 FROM users
  WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
)) OR EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = e.id AND o.profile_id = current_profile_id()))));--> statement-breakpoint
CREATE POLICY "BG membership changes use lifecycle RPCs" ON "birth_giving_team_members" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "Profiles can view relevant BG proposals" ON "birth_giving_team_proposals" AS PERMISSIVE FOR SELECT TO "authenticated" USING (candidate_profile_id = current_profile_id() OR initiated_by_profile_id = current_profile_id() OR EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = event_id AND o.profile_id = current_profile_id()) OR EXISTS (SELECT 1 FROM birth_giving_team_members m WHERE m.event_id = event_id AND m.team_id = team_id AND m.profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "BG proposal changes use lifecycle RPCs" ON "birth_giving_team_proposals" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "Community can view published BG result files" ON "birth_giving_team_result_files" AS PERMISSIVE FOR SELECT TO "authenticated" USING (removed_at IS NULL AND EXISTS (
  SELECT 1 FROM users
  WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
) AND EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = event_id AND e.status = 'published' AND e.removed_at IS NULL));--> statement-breakpoint
CREATE POLICY "BG members and organizers can insert result files" ON "birth_giving_team_result_files" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (uploaded_by_profile_id = current_profile_id() AND created_by_profile_id = current_profile_id() AND updated_by_profile_id = current_profile_id() AND (EXISTS (SELECT 1 FROM birth_giving_team_members m WHERE m.event_id = event_id AND m.team_id = team_id AND m.profile_id = current_profile_id()) OR EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = event_id AND o.profile_id = current_profile_id())));--> statement-breakpoint
CREATE POLICY "BG members and organizers can update result files" ON "birth_giving_team_result_files" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (SELECT 1 FROM birth_giving_team_members m WHERE m.event_id = event_id AND m.team_id = team_id AND m.profile_id = current_profile_id()) OR EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = event_id AND o.profile_id = current_profile_id())) WITH CHECK (updated_by_profile_id = current_profile_id() AND (EXISTS (SELECT 1 FROM birth_giving_team_members m WHERE m.event_id = event_id AND m.team_id = team_id AND m.profile_id = current_profile_id()) OR EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = event_id AND o.profile_id = current_profile_id())));--> statement-breakpoint
CREATE POLICY "BG result files cannot be directly deleted" ON "birth_giving_team_result_files" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "Community can view published BG teams" ON "birth_giving_teams" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = event_id AND e.removed_at IS NULL AND ((e.status = 'published' AND EXISTS (
  SELECT 1 FROM users
  WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
)) OR EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = e.id AND o.profile_id = current_profile_id()))));--> statement-breakpoint
CREATE POLICY "BG organizers can insert teams" ON "birth_giving_teams" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = event_id AND o.profile_id = current_profile_id()) AND created_by_profile_id = current_profile_id() AND updated_by_profile_id = current_profile_id());--> statement-breakpoint
CREATE POLICY "BG organizers can update teams" ON "birth_giving_teams" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = event_id AND o.profile_id = current_profile_id())) WITH CHECK (EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = event_id AND o.profile_id = current_profile_id()) AND updated_by_profile_id = current_profile_id());--> statement-breakpoint
CREATE POLICY "BG teams cannot be directly deleted" ON "birth_giving_teams" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);