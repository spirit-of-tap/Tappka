-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."book_source" AS ENUM('manual', 'google_books', 'open_library');--> statement-breakpoint
CREATE TYPE "public"."book_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."issue_type" AS ENUM('locked', 'mess', 'technical', 'other');--> statement-breakpoint
CREATE TYPE "public"."profile_role" AS ENUM('student', 'mentor', 'coach', 'admin');--> statement-breakpoint
CREATE TYPE "public"."reservation_type" AS ENUM('personal', 'training_session', 'houston_calling');--> statement-breakpoint
CREATE TYPE "public"."schedule_break_type" AS ENUM('days_of_joy', 'holiday', 'other');--> statement-breakpoint
CREATE TABLE "dashboard_layouts" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"widgets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "essay_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"essay_id" uuid NOT NULL,
	"author_profile_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_linda_nudge" boolean DEFAULT false NOT NULL,
	"nudge_status" text,
	CONSTRAINT "essay_comments_body_check" CHECK ((char_length(body) >= 1) AND (char_length(body) <= 4000)),
	CONSTRAINT "essay_comments_nudge_status_check" CHECK ((nudge_status IS NULL) OR (nudge_status = ANY (ARRAY['open'::text, 'resolved'::text])))
);
--> statement-breakpoint
ALTER TABLE "essay_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "book_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"author_profile_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "book_comments_body_check" CHECK ((char_length(body) >= 1) AND (char_length(body) <= 4000))
);
--> statement-breakpoint
ALTER TABLE "book_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "essays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_profile_id" uuid NOT NULL,
	"book_id" uuid,
	"title" text NOT NULL,
	"content_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_text" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "essays" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"author" text NOT NULL,
	"isbn_13" text,
	"description" text,
	"cover_path" text,
	"tags" text[] DEFAULT '{""}' NOT NULL,
	"suggested_points" smallint DEFAULT 1 NOT NULL,
	"book_points" numeric(5, 2) DEFAULT '0' NOT NULL,
	"status" "book_status" DEFAULT 'pending' NOT NULL,
	"added_by_profile_id" uuid NOT NULL,
	"approved_by_profile_id" uuid,
	"approved_at" timestamp with time zone,
	"rejection_reason" text,
	"source" "book_source" DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"page_count" integer,
	"preview_link" text,
	"ai_book_points" smallint,
	"legacy_book_points" numeric(5, 2),
	"ai_reason" text,
	CONSTRAINT "books_isbn_13_key" UNIQUE("isbn_13"),
	CONSTRAINT "books_suggested_points_check" CHECK ((suggested_points >= 0) AND (suggested_points <= 3)),
	CONSTRAINT "books_book_points_check" CHECK ((book_points >= (0)::numeric) AND (book_points <= (3)::numeric))
);
--> statement-breakpoint
ALTER TABLE "books" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "essay_votes" (
	"essay_id" uuid NOT NULL,
	"voter_profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "essay_votes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "team_reading_lists" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"title" text NOT NULL,
	"month" text,
	"created_by_profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_reading_lists" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "team_reading_list_books" (
	"list_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "team_reading_list_books" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "essay_coach_reads" (
	"essay_id" uuid NOT NULL,
	"coach_profile_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "essay_coach_reads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid,
	"google_email" text NOT NULL,
	"suggested_work_email" text,
	"verified_work_email" text,
	"verified_work_email_at" timestamp with time zone,
	"google_profile_picture" text,
	"google_full_name" text,
	"last_otp_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth_user_id_key" UNIQUE("auth_user_id"),
	CONSTRAINT "users_google_email_key" UNIQUE("google_email")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"available_days" integer[],
	"can_have_ts" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_code_key" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "recurring_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"created_by" uuid,
	"day_of_week" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"valid_from" date NOT NULL,
	"valid_until" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_schedules_day_of_week_check" CHECK ((day_of_week >= 0) AND (day_of_week <= 6)),
	CONSTRAINT "valid_time_range" CHECK (end_time > start_time),
	CONSTRAINT "valid_schedule_dates" CHECK (valid_until >= valid_from)
);
--> statement-breakpoint
ALTER TABLE "recurring_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cowork_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cowork_participants_reservation_id_user_id_key" UNIQUE("reservation_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "cowork_participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "room_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"reported_by" uuid,
	"issue_type" "issue_type" NOT NULL,
	"description" text,
	"status" "issue_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid
);
--> statement-breakpoint
ALTER TABLE "room_issues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "schedule_breaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"break_type" "schedule_break_type" NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valid_break_date_range" CHECK (end_date >= start_date)
);
--> statement-breakpoint
ALTER TABLE "schedule_breaks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"picture" text,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"year" integer
);
--> statement-breakpoint
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid,
	"team_id" uuid,
	"recurring_schedule_id" uuid,
	"reservation_type" "reservation_type" DEFAULT 'personal' NOT NULL,
	"title" text NOT NULL,
	"person_count" integer,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"is_cowork_open" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valid_reservation_time" CHECK (end_time > start_time)
);
--> statement-breakpoint
ALTER TABLE "reservations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"picture" text,
	"user_id" uuid,
	"work_email" text NOT NULL,
	"role" "profile_role" DEFAULT 'student' NOT NULL,
	"team_id" uuid,
	"phone_number" text,
	"personal_email" text,
	"date_of_birth" date,
	"removed_access" timestamp with time zone,
	"removed_access_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_user_id_key" UNIQUE("user_id"),
	CONSTRAINT "profiles_work_email_key" UNIQUE("work_email"),
	CONSTRAINT "valid_czu_domain" CHECK ((work_email ~~ '%@studenti.czu.cz'::text) OR (work_email ~~ '%@pef.czu.cz'::text))
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "essay_views" (
	"essay_id" uuid NOT NULL,
	"viewer_profile_id" uuid NOT NULL,
	"first_viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "essay_views_pkey" PRIMARY KEY("essay_id","viewer_profile_id")
);
--> statement-breakpoint
ALTER TABLE "essay_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_comments" ADD CONSTRAINT "essay_comments_essay_id_fkey" FOREIGN KEY ("essay_id") REFERENCES "public"."essays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_comments" ADD CONSTRAINT "essay_comments_author_profile_id_fkey" FOREIGN KEY ("author_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_comments" ADD CONSTRAINT "book_comments_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_comments" ADD CONSTRAINT "book_comments_author_profile_id_fkey" FOREIGN KEY ("author_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essays" ADD CONSTRAINT "essays_author_profile_id_fkey" FOREIGN KEY ("author_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essays" ADD CONSTRAINT "essays_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_added_by_profile_id_fkey" FOREIGN KEY ("added_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_approved_by_profile_id_fkey" FOREIGN KEY ("approved_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_votes" ADD CONSTRAINT "essay_votes_essay_id_fkey" FOREIGN KEY ("essay_id") REFERENCES "public"."essays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_votes" ADD CONSTRAINT "essay_votes_voter_profile_id_fkey" FOREIGN KEY ("voter_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_reading_lists" ADD CONSTRAINT "team_reading_lists_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_reading_lists" ADD CONSTRAINT "team_reading_lists_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_reading_list_books" ADD CONSTRAINT "team_reading_list_books_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."team_reading_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_reading_list_books" ADD CONSTRAINT "team_reading_list_books_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_coach_reads" ADD CONSTRAINT "essay_coach_reads_essay_id_fkey" FOREIGN KEY ("essay_id") REFERENCES "public"."essays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_coach_reads" ADD CONSTRAINT "essay_coach_reads_coach_profile_id_fkey" FOREIGN KEY ("coach_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cowork_participants" ADD CONSTRAINT "cowork_participants_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cowork_participants" ADD CONSTRAINT "cowork_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_issues" ADD CONSTRAINT "room_issues_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_issues" ADD CONSTRAINT "room_issues_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_issues" ADD CONSTRAINT "room_issues_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_breaks" ADD CONSTRAINT "schedule_breaks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_recurring_schedule_id_fkey" FOREIGN KEY ("recurring_schedule_id") REFERENCES "public"."recurring_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_removed_access_by_fkey" FOREIGN KEY ("removed_access_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_views" ADD CONSTRAINT "essay_views_essay_id_fkey" FOREIGN KEY ("essay_id") REFERENCES "public"."essays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_views" ADD CONSTRAINT "essay_views_viewer_profile_id_fkey" FOREIGN KEY ("viewer_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "essay_comments_author_idx" ON "essay_comments" USING btree ("author_profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "essay_comments_essay_idx" ON "essay_comments" USING btree ("essay_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "essay_comments_open_linda_nudge_idx" ON "essay_comments" USING btree ("essay_id" uuid_ops) WHERE (is_linda_nudge AND (nudge_status = 'open'::text));--> statement-breakpoint
CREATE INDEX "book_comments_author_idx" ON "book_comments" USING btree ("author_profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "book_comments_book_idx" ON "book_comments" USING btree ("book_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "essays_author_idx" ON "essays" USING btree ("author_profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "essays_book_idx" ON "essays" USING btree ("book_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "essays_content_text_tsv_idx" ON "essays" USING gin (to_tsvector('simple'::regconfig, content_text) tsvector_ops);--> statement-breakpoint
CREATE INDEX "essays_created_desc_idx" ON "essays" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "essays_title_trgm_idx" ON "essays" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "essays_vote_count_idx" ON "essays" USING btree ("vote_count" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "books_added_by_idx" ON "books" USING btree ("added_by_profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "books_author_trgm_idx" ON "books" USING gin ("author" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "books_created_desc_idx" ON "books" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "books_isbn_13_idx" ON "books" USING btree ("isbn_13" text_ops) WHERE (isbn_13 IS NOT NULL);--> statement-breakpoint
CREATE INDEX "books_status_idx" ON "books" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "books_title_trgm_idx" ON "books" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "essay_votes_voter_idx" ON "essay_votes" USING btree ("voter_profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "team_reading_lists_team_idx" ON "team_reading_lists" USING btree ("team_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "team_reading_list_books_list_idx" ON "team_reading_list_books" USING btree ("list_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "essay_coach_reads_coach_idx" ON "essay_coach_reads" USING btree ("coach_profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "users_google_email_idx" ON "users" USING btree ("google_email" text_ops);--> statement-breakpoint
CREATE INDEX "users_suggested_work_email_idx" ON "users" USING btree ("suggested_work_email" text_ops);--> statement-breakpoint
CREATE INDEX "idx_rooms_code" ON "rooms" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "idx_recurring_schedules_day" ON "recurring_schedules" USING btree ("day_of_week" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_recurring_schedules_room" ON "recurring_schedules" USING btree ("room_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_recurring_schedules_team" ON "recurring_schedules" USING btree ("team_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_recurring_schedules_valid" ON "recurring_schedules" USING btree ("valid_from" date_ops,"valid_until" date_ops);--> statement-breakpoint
CREATE INDEX "idx_cowork_reservation" ON "cowork_participants" USING btree ("reservation_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_cowork_user" ON "cowork_participants" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_room_issues_room_status" ON "room_issues" USING btree ("room_id" uuid_ops,"status" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_room_issues_type" ON "room_issues" USING btree ("issue_type" enum_ops) WHERE (status = 'open'::issue_status);--> statement-breakpoint
CREATE INDEX "idx_schedule_breaks_dates" ON "schedule_breaks" USING btree ("start_date" date_ops,"end_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_schedule_breaks_type" ON "schedule_breaks" USING btree ("break_type" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_reservations_recurring" ON "reservations" USING btree ("recurring_schedule_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_reservations_room_time" ON "reservations" USING btree ("room_id" timestamptz_ops,"start_time" timestamptz_ops,"end_time" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_reservations_start" ON "reservations" USING btree ("start_time" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_reservations_team" ON "reservations" USING btree ("team_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_reservations_type" ON "reservations" USING btree ("reservation_type" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_reservations_user" ON "reservations" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "profiles_team_id_idx" ON "profiles" USING btree ("team_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "profiles_team_id_user_id_idx" ON "profiles" USING btree ("team_id" uuid_ops,"user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "profiles_user_id_idx" ON "profiles" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "profiles_work_email_idx" ON "profiles" USING btree ("work_email" text_ops);--> statement-breakpoint
CREATE INDEX "essay_views_viewer_idx" ON "essay_views" USING btree ("viewer_profile_id" uuid_ops);--> statement-breakpoint
CREATE VIEW "public"."books_with_essay_count" AS (SELECT b.id, b.title, b.author, b.isbn_13, b.description, b.cover_path, b.tags, b.suggested_points, b.book_points, b.status, b.added_by_profile_id, b.approved_by_profile_id, b.approved_at, b.rejection_reason, b.source, b.external_id, b.created_at, b.updated_at, b.page_count, b.preview_link, b.ai_book_points, b.legacy_book_points, b.ai_reason, COALESCE(ec.essay_count, 0) AS essay_count FROM books b LEFT JOIN ( SELECT essays.book_id, count(*)::integer AS essay_count FROM essays WHERE essays.book_id IS NOT NULL GROUP BY essays.book_id) ec ON ec.book_id = b.id);--> statement-breakpoint
CREATE POLICY "Users can delete their own dashboard layout" ON "dashboard_layouts" AS PERMISSIVE FOR DELETE TO public USING ((profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Users can update their own dashboard layout" ON "dashboard_layouts" AS PERMISSIVE FOR UPDATE TO public;--> statement-breakpoint
CREATE POLICY "Users can insert their own dashboard layout" ON "dashboard_layouts" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Users can view their own dashboard layout" ON "dashboard_layouts" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Authors and admins can delete essay comments" ON "essay_comments" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((author_profile_id = current_profile_id()) OR is_admin()));--> statement-breakpoint
CREATE POLICY "Authors can update their own essay comments" ON "essay_comments" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Authenticated users can add essay comments" ON "essay_comments" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Authenticated users can view essay comments" ON "essay_comments" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Authors and admins can delete book comments" ON "book_comments" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((author_profile_id = current_profile_id()) OR is_admin()));--> statement-breakpoint
CREATE POLICY "Authors can update their own book comments" ON "book_comments" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Authenticated users can add book comments" ON "book_comments" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Authenticated users can view book comments" ON "book_comments" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Authors can create their own essays" ON "essays" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((author_profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Authenticated users can view all essays" ON "essays" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Authors and admins can delete essays" ON "essays" AS PERMISSIVE FOR DELETE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Authors can update their own essays" ON "essays" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Coaches and admins can delete books" ON "books" AS PERMISSIVE FOR DELETE TO public USING (is_coach_or_admin());--> statement-breakpoint
CREATE POLICY "Coaches and admins can update books" ON "books" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Authenticated users can add books" ON "books" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Authenticated users can view all books" ON "books" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Users can vote (not own essays)" ON "essay_votes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((voter_profile_id = current_profile_id()) AND (NOT (essay_id IN ( SELECT essays.id
   FROM essays
  WHERE (essays.author_profile_id = current_profile_id()))))));--> statement-breakpoint
CREATE POLICY "Authenticated users can view votes" ON "essay_votes" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Users can remove own votes" ON "essay_votes" AS PERMISSIVE FOR DELETE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Team members can delete their lists" ON "team_reading_lists" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((team_id = ( SELECT profiles.team_id
   FROM profiles
  WHERE (profiles.id = current_profile_id()))));--> statement-breakpoint
CREATE POLICY "Team members can create lists" ON "team_reading_lists" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Authenticated users can view team lists" ON "team_reading_lists" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Team members can update their lists" ON "team_reading_lists" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Authenticated users can view list books" ON "team_reading_list_books" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Team members can remove list books" ON "team_reading_list_books" AS PERMISSIVE FOR DELETE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Team members can manage list books" ON "team_reading_list_books" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Coaches remove own reads" ON "essay_coach_reads" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((coach_profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Coaches mark own reads within their team" ON "essay_coach_reads" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Coach sees own reads; author sees reads of own essays" ON "essay_coach_reads" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Users can update only suggested_work_email" ON "users" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = auth_user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = auth_user_id));--> statement-breakpoint
CREATE POLICY "Users can insert their own user record" ON "users" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Users can view their own user record" ON "users" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Admins can manage rooms" ON "rooms" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = 'admin'::profile_role))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = 'admin'::profile_role)))));--> statement-breakpoint
CREATE POLICY "Authenticated can read rooms" ON "rooms" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Coaches can manage recurring_schedules" ON "recurring_schedules" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = ANY (ARRAY['coach'::profile_role, 'admin'::profile_role])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = ANY (ARRAY['coach'::profile_role, 'admin'::profile_role]))))));--> statement-breakpoint
CREATE POLICY "Authenticated can read recurring_schedules" ON "recurring_schedules" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Users can join cowork" ON "cowork_participants" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((user_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))))) AND (EXISTS ( SELECT 1
   FROM reservations
  WHERE ((reservations.id = cowork_participants.reservation_id) AND (reservations.is_cowork_open = true))))));--> statement-breakpoint
CREATE POLICY "Users can leave cowork" ON "cowork_participants" AS PERMISSIVE FOR DELETE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Authenticated can read cowork_participants" ON "cowork_participants" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Coaches can resolve issues" ON "room_issues" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = ANY (ARRAY['coach'::profile_role, 'admin'::profile_role]))))));--> statement-breakpoint
CREATE POLICY "Users can update own issues" ON "room_issues" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Users can report issues" ON "room_issues" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Authenticated can read room_issues" ON "room_issues" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Coaches can manage schedule_breaks" ON "schedule_breaks" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = ANY (ARRAY['coach'::profile_role, 'admin'::profile_role])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = ANY (ARRAY['coach'::profile_role, 'admin'::profile_role]))))));--> statement-breakpoint
CREATE POLICY "Authenticated can read schedule_breaks" ON "schedule_breaks" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Authenticated users can read teams" ON "teams" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Coaches can manage TS reservations" ON "reservations" AS PERMISSIVE FOR ALL TO "authenticated" USING (((reservation_type = ANY (ARRAY['training_session'::reservation_type, 'houston_calling'::reservation_type])) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = ANY (ARRAY['coach'::profile_role, 'admin'::profile_role]))))))) WITH CHECK (((reservation_type = ANY (ARRAY['training_session'::reservation_type, 'houston_calling'::reservation_type])) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = ANY (ARRAY['coach'::profile_role, 'admin'::profile_role])))))));--> statement-breakpoint
CREATE POLICY "Authenticated can read reservations" ON "reservations" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Users can delete own reservations" ON "reservations" AS PERMISSIVE FOR DELETE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Users can update own reservations" ON "reservations" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Users can create own reservations" ON "reservations" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Verified users can view all profiles" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((removed_access IS NULL) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_user_id = ( SELECT auth.uid() AS uid)) AND (users.verified_work_email IS NOT NULL))))));--> statement-breakpoint
CREATE POLICY "Users can update their own profile picture" ON "profiles" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "No direct inserts to essay_views" ON "essay_views" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "Authors see all viewers; others see own row" ON "essay_views" AS PERMISSIVE FOR SELECT TO "authenticated";
*/