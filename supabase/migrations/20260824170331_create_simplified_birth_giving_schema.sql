CREATE TABLE "birth_giving_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"customer" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration" "birth_giving_duration" NOT NULL,
	"status" "birth_giving_event_status" DEFAULT 'draft' NOT NULL,
	"organizer_profile_ids" uuid[] NOT NULL,
	"assignment_state" "birth_giving_assignment_state" DEFAULT 'none' NOT NULL,
	"assignment_storage_path" text,
	"assignment_file_name" text,
	"assignment_mime_type" text,
	"assignment_file_size" bigint,
	"assignment_uploaded_at" timestamp with time zone,
	"assignment_uploaded_by_profile_id" uuid,
	"removed_at" timestamp with time zone,
	"removed_by_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "birth_giving_events_name_check" CHECK (length(trim("birth_giving_events"."name")) > 0),
	CONSTRAINT "birth_giving_events_customer_check" CHECK (length(trim("birth_giving_events"."customer")) > 0),
	CONSTRAINT "birth_giving_events_organizers_check" CHECK (cardinality("birth_giving_events"."organizer_profile_ids") > 0),
	CONSTRAINT "birth_giving_events_assignment_check" CHECK ((
    "birth_giving_events"."assignment_state" = 'present'
    AND "birth_giving_events"."assignment_storage_path" IS NOT NULL
    AND length(trim("birth_giving_events"."assignment_storage_path")) > 0
    AND "birth_giving_events"."assignment_storage_path" LIKE 'birth-giving/assignments/' || "birth_giving_events"."id"::text || '/%'
    AND "birth_giving_events"."assignment_file_name" IS NOT NULL
    AND length(trim("birth_giving_events"."assignment_file_name")) > 0
    AND "birth_giving_events"."assignment_mime_type" IS NOT NULL
    AND length(trim("birth_giving_events"."assignment_mime_type")) > 0
    AND "birth_giving_events"."assignment_file_size" > 0
    AND "birth_giving_events"."assignment_uploaded_at" IS NOT NULL
    AND "birth_giving_events"."assignment_uploaded_by_profile_id" IS NOT NULL
  ) OR (
    "birth_giving_events"."assignment_state" IN ('none', 'missing')
    AND "birth_giving_events"."assignment_storage_path" IS NULL
    AND "birth_giving_events"."assignment_file_name" IS NULL
    AND "birth_giving_events"."assignment_mime_type" IS NULL
    AND "birth_giving_events"."assignment_file_size" IS NULL
    AND "birth_giving_events"."assignment_uploaded_at" IS NULL
    AND "birth_giving_events"."assignment_uploaded_by_profile_id" IS NULL
  )),
	CONSTRAINT "birth_giving_events_removed_check" CHECK (("birth_giving_events"."removed_at" IS NULL) = ("birth_giving_events"."removed_by_profile_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "birth_giving_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "birth_giving_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reflection_contribution" text,
	"reflection_learning" text,
	"reflection_submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "birth_giving_team_members_event_profile_key" UNIQUE("event_id","profile_id"),
	CONSTRAINT "birth_giving_team_members_event_team_profile_key" UNIQUE("event_id","team_id","profile_id"),
	CONSTRAINT "birth_giving_team_members_reflection_check" CHECK ((
    "birth_giving_team_members"."reflection_contribution" IS NULL
    AND "birth_giving_team_members"."reflection_learning" IS NULL
    AND "birth_giving_team_members"."reflection_submitted_at" IS NULL
  ) OR (
    "birth_giving_team_members"."reflection_contribution" IS NOT NULL
    AND length(trim("birth_giving_team_members"."reflection_contribution")) > 0
    AND "birth_giving_team_members"."reflection_learning" IS NOT NULL
    AND length(trim("birth_giving_team_members"."reflection_learning")) > 0
    AND "birth_giving_team_members"."reflection_submitted_at" IS NOT NULL
  ))
);
--> statement-breakpoint
ALTER TABLE "birth_giving_team_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "birth_giving_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_winner" boolean DEFAULT false NOT NULL,
	"result_state" "birth_giving_team_result_state" DEFAULT 'pending' NOT NULL,
	"result_files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "birth_giving_teams_event_id_id_key" UNIQUE("event_id","id"),
	CONSTRAINT "birth_giving_teams_name_check" CHECK (length(trim("birth_giving_teams"."name")) > 0),
	CONSTRAINT "birth_giving_teams_cancellation_check" CHECK ((
    "birth_giving_teams"."cancelled_at" IS NULL AND "birth_giving_teams"."cancellation_reason" IS NULL
  ) OR (
    "birth_giving_teams"."cancelled_at" IS NOT NULL
    AND "birth_giving_teams"."cancellation_reason" IS NOT NULL
    AND length(trim("birth_giving_teams"."cancellation_reason")) > 0
  )),
	CONSTRAINT "birth_giving_teams_result_check" CHECK (jsonb_typeof("birth_giving_teams"."result_files") = 'array' AND (
    ("birth_giving_teams"."result_state" = 'present' AND jsonb_array_length("birth_giving_teams"."result_files") > 0)
    OR ("birth_giving_teams"."result_state" IN ('pending', 'missing') AND jsonb_array_length("birth_giving_teams"."result_files") = 0)
  ))
);
--> statement-breakpoint
ALTER TABLE "birth_giving_teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "birth_giving_events" ADD CONSTRAINT "birth_giving_events_removed_by_profile_id_fkey" FOREIGN KEY ("removed_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_events" ADD CONSTRAINT "birth_giving_events_assignment_uploaded_by_fkey" FOREIGN KEY ("assignment_uploaded_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_events" ADD CONSTRAINT "birth_giving_events_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_events" ADD CONSTRAINT "birth_giving_events_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_team_members" ADD CONSTRAINT "birth_giving_team_members_event_team_fkey" FOREIGN KEY ("event_id","team_id") REFERENCES "public"."birth_giving_teams"("event_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_team_members" ADD CONSTRAINT "birth_giving_team_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_team_members" ADD CONSTRAINT "birth_giving_team_members_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_team_members" ADD CONSTRAINT "birth_giving_team_members_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_teams" ADD CONSTRAINT "birth_giving_teams_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."birth_giving_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_teams" ADD CONSTRAINT "birth_giving_teams_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_giving_teams" ADD CONSTRAINT "birth_giving_teams_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "birth_giving_events_identity_idx" ON "birth_giving_events" USING btree (lower(regexp_replace(trim(normalize("name", NFKC)), '[[:space:]]+', ' ', 'g')),lower(regexp_replace(trim(normalize("customer", NFKC)), '[[:space:]]+', ' ', 'g')),"starts_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "birth_giving_events_status_starts_at_idx" ON "birth_giving_events" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "birth_giving_team_members_team_idx" ON "birth_giving_team_members" USING btree ("event_id","team_id");--> statement-breakpoint
CREATE INDEX "birth_giving_team_members_profile_idx" ON "birth_giving_team_members" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "birth_giving_teams_event_winner_idx" ON "birth_giving_teams" USING btree ("event_id") WHERE "birth_giving_teams"."is_winner" AND "birth_giving_teams"."cancelled_at" IS NULL;--> statement-breakpoint
CREATE INDEX "birth_giving_teams_event_idx" ON "birth_giving_teams" USING btree ("event_id");--> statement-breakpoint
CREATE POLICY "Community can view published BG events, organizers view drafts" ON "birth_giving_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
  SELECT 1
  FROM profiles caller_profile
  JOIN users caller_user ON caller_user.id = caller_profile.user_id
  WHERE caller_profile.id = current_profile_id()
    AND caller_profile.access_removed_at IS NULL
    AND caller_profile.beta_access_granted_at IS NOT NULL
    AND caller_user.verified_work_email IS NOT NULL
) AND "birth_giving_events"."removed_at" IS NULL AND ("birth_giving_events"."status" = 'published' OR current_profile_id() = ANY("birth_giving_events"."organizer_profile_ids")));--> statement-breakpoint
CREATE POLICY "Community can view BG memberships for accessible events" ON "birth_giving_team_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
  SELECT 1
  FROM profiles caller_profile
  JOIN users caller_user ON caller_user.id = caller_profile.user_id
  WHERE caller_profile.id = current_profile_id()
    AND caller_profile.access_removed_at IS NULL
    AND caller_profile.beta_access_granted_at IS NOT NULL
    AND caller_user.verified_work_email IS NOT NULL
) AND EXISTS (
      SELECT 1 FROM birth_giving_events event
      WHERE event.id = "birth_giving_team_members"."event_id"
        AND event.removed_at IS NULL
        AND (event.status = 'published' OR current_profile_id() = ANY(event.organizer_profile_ids))
    ));--> statement-breakpoint
CREATE POLICY "Community can view BG teams for accessible events" ON "birth_giving_teams" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
  SELECT 1
  FROM profiles caller_profile
  JOIN users caller_user ON caller_user.id = caller_profile.user_id
  WHERE caller_profile.id = current_profile_id()
    AND caller_profile.access_removed_at IS NULL
    AND caller_profile.beta_access_granted_at IS NOT NULL
    AND caller_user.verified_work_email IS NOT NULL
) AND EXISTS (
      SELECT 1 FROM birth_giving_events event
      WHERE event.id = "birth_giving_teams"."event_id"
        AND event.removed_at IS NULL
        AND (event.status = 'published' OR current_profile_id() = ANY(event.organizer_profile_ids))
    ));