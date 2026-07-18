CREATE TYPE "public"."schedule_type" AS ENUM('training_session', 'houston_calling');--> statement-breakpoint
CREATE TABLE "book_tags" (
	"book_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "book_tags_pkey" PRIMARY KEY("book_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "book_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "tags_name_key" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "essay_revisions" (
	"essay_id" uuid NOT NULL,
	"revision_no" integer NOT NULL,
	"title" text NOT NULL,
	"content_json" jsonb NOT NULL,
	"invalid_since" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "essay_revisions_pkey" PRIMARY KEY("essay_id","revision_no")
);
--> statement-breakpoint
ALTER TABLE "essay_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "book_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "books" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "essay_coach_reads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "essay_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "essay_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "essay_votes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "essays" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reservations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "schedule_breaks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_reading_list_books" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_reading_lists" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cowork_participants" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "room_issues" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP VIEW "public"."books_with_essay_count";--> statement-breakpoint
DROP POLICY "Authenticated users can view list books" ON "team_reading_list_books" CASCADE;--> statement-breakpoint
DROP POLICY "Team members can remove list books" ON "team_reading_list_books" CASCADE;--> statement-breakpoint
DROP POLICY "Team members can manage list books" ON "team_reading_list_books" CASCADE;--> statement-breakpoint
DROP TABLE "team_reading_list_books" CASCADE;--> statement-breakpoint
DROP POLICY "Team members can delete their lists" ON "team_reading_lists" CASCADE;--> statement-breakpoint
DROP POLICY "Team members can create lists" ON "team_reading_lists" CASCADE;--> statement-breakpoint
DROP POLICY "Authenticated users can view team lists" ON "team_reading_lists" CASCADE;--> statement-breakpoint
DROP POLICY "Team members can update their lists" ON "team_reading_lists" CASCADE;--> statement-breakpoint
DROP TABLE "team_reading_lists" CASCADE;--> statement-breakpoint
DROP POLICY "Users can join cowork" ON "cowork_participants" CASCADE;--> statement-breakpoint
DROP POLICY "Users can leave cowork" ON "cowork_participants" CASCADE;--> statement-breakpoint
DROP POLICY "Authenticated can read cowork_participants" ON "cowork_participants" CASCADE;--> statement-breakpoint
DROP TABLE "cowork_participants" CASCADE;--> statement-breakpoint
DROP POLICY "Coaches can resolve issues" ON "room_issues" CASCADE;--> statement-breakpoint
DROP POLICY "Users can update own issues" ON "room_issues" CASCADE;--> statement-breakpoint
DROP POLICY "Users can report issues" ON "room_issues" CASCADE;--> statement-breakpoint
DROP POLICY "Authenticated can read room_issues" ON "room_issues" CASCADE;--> statement-breakpoint
DROP TABLE "room_issues" CASCADE;--> statement-breakpoint
ALTER TABLE "books" RENAME COLUMN "cover_path" TO "supabase_cover_img_url";--> statement-breakpoint
ALTER TABLE "books" RENAME COLUMN "approved_at" TO "status_changed_at";--> statement-breakpoint
ALTER TABLE "books" RENAME COLUMN "approved_by_profile_id" TO "status_changed_by_profile_id";--> statement-breakpoint
ALTER TABLE "books" RENAME COLUMN "rejection_reason" TO "status_reason";--> statement-breakpoint
ALTER TABLE "books" RENAME COLUMN "added_by_profile_id" TO "created_by_profile_id";--> statement-breakpoint
ALTER TABLE "essays" RENAME COLUMN "published" TO "published_at";--> statement-breakpoint
ALTER TABLE "feedback" RENAME COLUMN "archived_at" TO "resolved_at";--> statement-breakpoint
ALTER TABLE "profiles" RENAME COLUMN "removed_access" TO "access_removed_at";--> statement-breakpoint
ALTER TABLE "profiles" RENAME COLUMN "removed_access_by" TO "access_removed_by_profile_id";--> statement-breakpoint
ALTER TABLE "profiles" RENAME COLUMN "beta_access" TO "beta_access_granted_at";--> statement-breakpoint
ALTER TABLE "reservations" RENAME COLUMN "user_id" TO "owner_profile_id";--> statement-breakpoint
ALTER TABLE "reservations" RENAME COLUMN "start_time" TO "start_at";--> statement-breakpoint
ALTER TABLE "reservations" RENAME COLUMN "end_time" TO "end_at";--> statement-breakpoint
ALTER TABLE "schedule_breaks" RENAME COLUMN "created_by" TO "created_by_profile_id";--> statement-breakpoint
ALTER TABLE "teams" RENAME COLUMN "year" TO "onboardingYear";--> statement-breakpoint
ALTER TABLE "books" DROP CONSTRAINT "books_suggested_points_check";--> statement-breakpoint
ALTER TABLE "books" DROP CONSTRAINT "books_book_points_check";--> statement-breakpoint
ALTER TABLE "recurring_schedules" DROP CONSTRAINT "valid_schedule_dates";--> statement-breakpoint
ALTER TABLE "reservations" DROP CONSTRAINT "valid_reservation_time";--> statement-breakpoint
ALTER TABLE "books" DROP CONSTRAINT "books_added_by_profile_id_fkey";
--> statement-breakpoint
ALTER TABLE "books" DROP CONSTRAINT "books_approved_by_profile_id_fkey";
--> statement-breakpoint
ALTER TABLE "feedback" DROP CONSTRAINT "feedback_admin_response_by_fkey";
--> statement-breakpoint
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_removed_access_by_fkey";
--> statement-breakpoint
ALTER TABLE "recurring_schedules" DROP CONSTRAINT "recurring_schedules_created_by_fkey";
--> statement-breakpoint
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_team_id_fkey";
--> statement-breakpoint
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_recurring_schedule_id_fkey";
--> statement-breakpoint
ALTER TABLE "schedule_breaks" DROP CONSTRAINT "schedule_breaks_created_by_fkey";
--> statement-breakpoint
DROP INDEX "books_added_by_idx";--> statement-breakpoint
DROP INDEX "essays_content_text_tsv_idx";--> statement-breakpoint
DROP INDEX "essays_title_trgm_idx";--> statement-breakpoint
DROP INDEX "essays_vote_count_idx";--> statement-breakpoint
DROP INDEX "idx_reservations_recurring";--> statement-breakpoint
DROP INDEX "idx_reservations_team";--> statement-breakpoint
DROP INDEX "idx_reservations_type";--> statement-breakpoint
DROP INDEX "idx_reservations_user";--> statement-breakpoint
DROP INDEX "idx_schedule_breaks_type";--> statement-breakpoint
DROP INDEX "feedback_active_created_idx";--> statement-breakpoint
DROP INDEX "idx_recurring_schedules_day";--> statement-breakpoint
DROP INDEX "idx_reservations_room_time";--> statement-breakpoint
DROP INDEX "idx_reservations_start";--> statement-breakpoint
ALTER TABLE "books" ALTER COLUMN "book_points" SET DATA TYPE numeric(3, 2);--> statement-breakpoint
ALTER TABLE "books" ALTER COLUMN "book_points" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "books" ALTER COLUMN "book_points" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ALTER COLUMN "team_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ALTER COLUMN "day_of_week" SET DATA TYPE smallint;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ALTER COLUMN "valid_until" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "book_comments" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "book_comments" ADD COLUMN "created_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "book_comments" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ADD COLUMN "created_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "essay_coach_reads" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "essay_coach_reads" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "essay_coach_reads" ADD COLUMN "created_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "essay_coach_reads" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "essay_comments" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "essay_comments" ADD COLUMN "created_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "essay_comments" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "essay_views" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "essay_views" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "essay_views" ADD COLUMN "created_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "essay_views" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "essay_votes" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "essay_votes" ADD COLUMN "created_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "essay_votes" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "essays" ADD COLUMN "pinned_by_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "essays" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "essays" ADD COLUMN "created_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "essays" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "created_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "created_by_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "updated_by_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD COLUMN "schedule_type" "schedule_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD COLUMN "created_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "cancelled_by_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "created_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "created_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_breaks" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_breaks" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "created_by_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "updated_by_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_revisions" ADD CONSTRAINT "essay_revisions_essay_id_fkey" FOREIGN KEY ("essay_id") REFERENCES "public"."essays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_revisions" ADD CONSTRAINT "essay_revisions_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_revisions" ADD CONSTRAINT "essay_revisions_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_tags_tag_idx" ON "book_tags" USING btree ("tag_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "book_comments" ADD CONSTRAINT "book_comments_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_comments" ADD CONSTRAINT "book_comments_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_status_changed_by_profile_id_fkey" FOREIGN KEY ("status_changed_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_coach_reads" ADD CONSTRAINT "essay_coach_reads_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_coach_reads" ADD CONSTRAINT "essay_coach_reads_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_comments" ADD CONSTRAINT "essay_comments_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_comments" ADD CONSTRAINT "essay_comments_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_views" ADD CONSTRAINT "essay_views_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_views" ADD CONSTRAINT "essay_views_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_votes" ADD CONSTRAINT "essay_votes_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_votes" ADD CONSTRAINT "essay_votes_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essays" ADD CONSTRAINT "essays_pinned_by_profile_id_fkey" FOREIGN KEY ("pinned_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essays" ADD CONSTRAINT "essays_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essays" ADD CONSTRAINT "essays_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_access_removed_by_profile_id_fkey" FOREIGN KEY ("access_removed_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_owner_profile_id_fkey" FOREIGN KEY ("owner_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_cancelled_by_profile_id_fkey" FOREIGN KEY ("cancelled_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_breaks" ADD CONSTRAINT "schedule_breaks_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_breaks" ADD CONSTRAINT "schedule_breaks_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "books_created_by_idx" ON "books" USING btree ("created_by_profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_recurring_schedules_type" ON "recurring_schedules" USING btree ("schedule_type" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_reservations_owner" ON "reservations" USING btree ("owner_profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "feedback_active_created_idx" ON "feedback" USING btree ("resolved_at" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_recurring_schedules_day" ON "recurring_schedules" USING btree ("day_of_week" int2_ops);--> statement-breakpoint
CREATE INDEX "idx_reservations_room_time" ON "reservations" USING btree ("room_id" uuid_ops,"start_at" timestamptz_ops,"end_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_reservations_start" ON "reservations" USING btree ("start_at" timestamptz_ops);--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "tags";--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "suggested_points";--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "ai_book_points";--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "legacy_book_points";--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "ai_reason";--> statement-breakpoint
ALTER TABLE "essays" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "essays" DROP COLUMN "content_json";--> statement-breakpoint
ALTER TABLE "essays" DROP COLUMN "content_text";--> statement-breakpoint
ALTER TABLE "essays" DROP COLUMN "view_count";--> statement-breakpoint
ALTER TABLE "essays" DROP COLUMN "vote_count";--> statement-breakpoint
ALTER TABLE "essays" DROP COLUMN "is_pinned";--> statement-breakpoint
ALTER TABLE "feedback" DROP COLUMN "admin_response";--> statement-breakpoint
ALTER TABLE "feedback" DROP COLUMN "admin_response_by";--> statement-breakpoint
ALTER TABLE "feedback" DROP COLUMN "admin_response_at";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "google_profile_picture";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "google_full_name";--> statement-breakpoint
ALTER TABLE "recurring_schedules" DROP COLUMN "created_by";--> statement-breakpoint
ALTER TABLE "reservations" DROP COLUMN "team_id";--> statement-breakpoint
ALTER TABLE "reservations" DROP COLUMN "recurring_schedule_id";--> statement-breakpoint
ALTER TABLE "reservations" DROP COLUMN "reservation_type";--> statement-breakpoint
ALTER TABLE "reservations" DROP COLUMN "is_cowork_open";--> statement-breakpoint
ALTER TABLE "schedule_breaks" DROP COLUMN "break_type";--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_book_points_check" CHECK ((book_points IS NULL) OR ((book_points >= (0)::numeric) AND (book_points <= (3)::numeric)));--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_team_for_ts" CHECK ((schedule_type <> 'training_session'::schedule_type) OR (team_id IS NOT NULL));--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "valid_schedule_dates" CHECK ((valid_until IS NULL) OR (valid_until >= valid_from));--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "valid_reservation_time" CHECK (end_at > start_at);--> statement-breakpoint
CREATE VIEW "public"."books_with_essay_count" AS (SELECT b.id, b.title, b.author, b.isbn_13, b.description, b.supabase_cover_img_url, b.book_points, b.page_count, b.preview_link, b.source, b.external_id, b.status, b.status_changed_at, b.status_changed_by_profile_id, b.status_reason, b.created_at, b.updated_at, b.created_by_profile_id, b.updated_by_profile_id, COALESCE(ec.essay_count, 0) AS essay_count FROM books b LEFT JOIN ( SELECT essays.book_id, count(*)::integer AS essay_count FROM essays WHERE essays.book_id IS NOT NULL GROUP BY essays.book_id) ec ON ec.book_id = b.id);--> statement-breakpoint
CREATE POLICY "Users can create own reservations" ON "reservations" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Authenticated users can view book tags" ON "book_tags" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Authenticated users can assign book tags" ON "book_tags" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Coaches and admins can update book tags" ON "book_tags" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Coaches and admins can remove book tags" ON "book_tags" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_coach_or_admin());--> statement-breakpoint
CREATE POLICY "Authenticated users can view tags" ON "tags" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "Coaches and admins can add tags" ON "tags" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_coach_or_admin());--> statement-breakpoint
CREATE POLICY "Coaches and admins can update tags" ON "tags" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "Coaches and admins can delete tags" ON "tags" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_coach_or_admin());--> statement-breakpoint
CREATE POLICY "Authenticated users can view essay revisions" ON "essay_revisions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Authors can create essay revisions" ON "essay_revisions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((created_by_profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Essay revisions cannot be updated" ON "essay_revisions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "Essay revisions cannot be deleted" ON "essay_revisions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);--> statement-breakpoint
ALTER POLICY "Verified users can view all profiles" ON "profiles" TO authenticated USING (((access_removed_at IS NULL) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_user_id = ( SELECT auth.uid() AS uid)) AND (users.verified_work_email IS NOT NULL))))));--> statement-breakpoint
DROP TYPE "public"."issue_status";--> statement-breakpoint
DROP TYPE "public"."issue_type";--> statement-breakpoint
DROP TYPE "public"."reservation_type";--> statement-breakpoint
DROP TYPE "public"."schedule_break_type";