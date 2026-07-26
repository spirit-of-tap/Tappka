-- ============================================================================
-- One-off production repair for 20260718212747_noisy_medusa.sql
--
-- GENERATED from that migration -- do NOT put this file in supabase/migrations/.
--
-- Why this exists: the migration contains 25 `ADD COLUMN ... NOT NULL` with no
-- DEFAULT. Those are no-ops on the empty local/preview DB they were generated
-- against, and hard 23502 errors on populated production tables. Because the CLI
-- runs each migration file in one transaction, the first such failure
-- (recurring_schedules.schedule_type) rolled back the whole file -- including the
-- `profiles.removed_access -> access_removed_at` rename, which is why the app
-- throws 42703.
--
-- This script applies the same end state safely (add nullable -> backfill ->
-- SET NOT NULL), then records the migration as applied so the next
-- `supabase migration up` skips it and proceeds to the 6 migrations after it.
--
-- RUN scripts/repair/noisy-medusa-preflight.sql FIRST and read its output.
-- It reports the rows that the DROP COLUMN / DROP TABLE statements will destroy.
-- ============================================================================

-- Prefer psql over the Supabase SQL editor for this:
--   psql "$PRODUCTION_DB_URL" -v ON_ERROR_STOP=1 -f noisy-medusa-repair.sql
-- The editor runs statements inside its own transaction and applies a statement
-- timeout, so the BEGIN/COMMIT below cannot guarantee all-or-nothing there.
BEGIN;

-- NOT NULL creator columns are backfilled from an existing owner/author column
-- where one exists, and otherwise from a fallback actor: the oldest admin
-- profile. rooms has no creator column at all, and
-- recurring_schedules.created_by / reservations.owner_profile_id /
-- schedule_breaks.created_by are all nullable.
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles) THEN
    RAISE EXCEPTION 'public.profiles is empty -- no fallback actor for NOT NULL creator columns';
  END IF;
END
$repair$;

-- ----------------------------------------------------------------------------
-- Guard: unrecoverable data loss.
--
-- The migration drops essays.title/content_json/content_text while creating
-- essay_revisions EMPTY -- it never copies the content across -- and it drops
-- four tables outright. Refuse to run while that data is only in public.
--
-- Each check passes when the table is empty OR the rows have been captured by
-- scripts/repair/noisy-medusa-snapshot.sql into the `legacy` schema. Run that
-- script first; it makes these drops reversible.
-- ----------------------------------------------------------------------------
DO $repair$
DECLARE
  n bigint;
  snap bigint;
  t text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'essays' AND column_name = 'content_json'
  ) THEN
    EXECUTE 'SELECT count(*) FROM public.essays' INTO n;
    IF n > 0 THEN
      IF to_regclass('legacy.essays_content') IS NULL THEN
        RAISE EXCEPTION
          'ABORTED: % row(s) in public.essays hold title/content_json/content_text, which this script drops, and essay_revisions is created empty -- the content is NOT migrated. Run scripts/repair/noisy-medusa-snapshot.sql first.', n;
      END IF;
      EXECUTE 'SELECT count(*) FROM legacy.essays_content' INTO snap;
      IF snap < n THEN
        RAISE EXCEPTION
          'ABORTED: legacy.essays_content holds % row(s) but public.essays has % -- the snapshot is stale. Re-run scripts/repair/noisy-medusa-snapshot.sql.', snap, n;
      END IF;
    END IF;
  END IF;

  FOREACH t IN ARRAY ARRAY['team_reading_lists', 'team_reading_list_books', 'cowork_participants', 'room_issues']
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      IF n > 0 THEN
        IF to_regclass('legacy.' || t) IS NULL THEN
          RAISE EXCEPTION
            'ABORTED: table public.% holds % row(s) and this script drops it. Run scripts/repair/noisy-medusa-snapshot.sql first.', t, n;
        END IF;
        EXECUTE format('SELECT count(*) FROM legacy.%I', t) INTO snap;
        IF snap < n THEN
          RAISE EXCEPTION
            'ABORTED: legacy.% holds % row(s) but public.% has % -- the snapshot is stale. Re-run scripts/repair/noisy-medusa-snapshot.sql.', t, snap, t, n;
        END IF;
      END IF;
    END IF;
  END LOOP;
END
$repair$;

DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'schedule_type') THEN
    EXECUTE 'CREATE TYPE "public"."schedule_type" AS ENUM(''training_session'', ''houston_calling'')';
  END IF;
END
$repair$;
CREATE TABLE IF NOT EXISTS "book_tags" (
	"book_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "book_tags_pkey" PRIMARY KEY("book_id","tag_id")
);
ALTER TABLE "book_tags" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "tags_name_key" UNIQUE("name")
);
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS "essay_revisions" (
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
ALTER TABLE "essay_revisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "book_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "books" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dashboard_layouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "essay_coach_reads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "essay_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "essay_views" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "essay_votes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "essays" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recurring_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "schedule_breaks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;
DO $repair$
BEGIN
  IF to_regclass('public.team_reading_list_books') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "team_reading_list_books" DISABLE ROW LEVEL SECURITY';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF to_regclass('public.team_reading_lists') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "team_reading_lists" DISABLE ROW LEVEL SECURITY';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF to_regclass('public.cowork_participants') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "cowork_participants" DISABLE ROW LEVEL SECURITY';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF to_regclass('public.room_issues') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "room_issues" DISABLE ROW LEVEL SECURITY';
  END IF;
END
$repair$;
DROP VIEW IF EXISTS "public"."books_with_essay_count";
DO $repair$
BEGIN
  IF to_regclass('public.team_reading_list_books') IS NOT NULL THEN
    EXECUTE 'DROP POLICY "Authenticated users can view list books" ON "team_reading_list_books" CASCADE';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF to_regclass('public.team_reading_list_books') IS NOT NULL THEN
    EXECUTE 'DROP POLICY "Team members can remove list books" ON "team_reading_list_books" CASCADE';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF to_regclass('public.team_reading_list_books') IS NOT NULL THEN
    EXECUTE 'DROP POLICY "Team members can manage list books" ON "team_reading_list_books" CASCADE';
  END IF;
END
$repair$;
DROP TABLE IF EXISTS "team_reading_list_books" CASCADE;
DO $repair$
BEGIN
  IF to_regclass('public.team_reading_lists') IS NOT NULL THEN
    EXECUTE 'DROP POLICY "Team members can delete their lists" ON "team_reading_lists" CASCADE';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF to_regclass('public.team_reading_lists') IS NOT NULL THEN
    EXECUTE 'DROP POLICY "Team members can create lists" ON "team_reading_lists" CASCADE';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF to_regclass('public.team_reading_lists') IS NOT NULL THEN
    EXECUTE 'DROP POLICY "Authenticated users can view team lists" ON "team_reading_lists" CASCADE';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF to_regclass('public.team_reading_lists') IS NOT NULL THEN
    EXECUTE 'DROP POLICY "Team members can update their lists" ON "team_reading_lists" CASCADE';
  END IF;
END
$repair$;
DROP TABLE IF EXISTS "team_reading_lists" CASCADE;
DO $repair$
BEGIN
  IF to_regclass('public.cowork_participants') IS NOT NULL THEN
    EXECUTE 'DROP POLICY "Users can join cowork" ON "cowork_participants" CASCADE';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF to_regclass('public.cowork_participants') IS NOT NULL THEN
    EXECUTE 'DROP POLICY "Users can leave cowork" ON "cowork_participants" CASCADE';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF to_regclass('public.cowork_participants') IS NOT NULL THEN
    EXECUTE 'DROP POLICY "Authenticated can read cowork_participants" ON "cowork_participants" CASCADE';
  END IF;
END
$repair$;
DROP TABLE IF EXISTS "cowork_participants" CASCADE;
DO $repair$
BEGIN
  IF to_regclass('public.room_issues') IS NOT NULL THEN
    EXECUTE 'DROP POLICY "Coaches can resolve issues" ON "room_issues" CASCADE';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF to_regclass('public.room_issues') IS NOT NULL THEN
    EXECUTE 'DROP POLICY "Users can update own issues" ON "room_issues" CASCADE';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF to_regclass('public.room_issues') IS NOT NULL THEN
    EXECUTE 'DROP POLICY "Users can report issues" ON "room_issues" CASCADE';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF to_regclass('public.room_issues') IS NOT NULL THEN
    EXECUTE 'DROP POLICY "Authenticated can read room_issues" ON "room_issues" CASCADE';
  END IF;
END
$repair$;
DROP TABLE IF EXISTS "room_issues" CASCADE;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'cover_path') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'supabase_cover_img_url') THEN
    EXECUTE 'ALTER TABLE "books" RENAME COLUMN "cover_path" TO "supabase_cover_img_url"';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'approved_at') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'status_changed_at') THEN
    EXECUTE 'ALTER TABLE "books" RENAME COLUMN "approved_at" TO "status_changed_at"';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'approved_by_profile_id') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'status_changed_by_profile_id') THEN
    EXECUTE 'ALTER TABLE "books" RENAME COLUMN "approved_by_profile_id" TO "status_changed_by_profile_id"';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'rejection_reason') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'status_reason') THEN
    EXECUTE 'ALTER TABLE "books" RENAME COLUMN "rejection_reason" TO "status_reason"';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'added_by_profile_id') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'created_by_profile_id') THEN
    EXECUTE 'ALTER TABLE "books" RENAME COLUMN "added_by_profile_id" TO "created_by_profile_id"';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'essays' AND column_name = 'published') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'essays' AND column_name = 'published_at') THEN
    EXECUTE 'ALTER TABLE "essays" RENAME COLUMN "published" TO "published_at"';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'feedback' AND column_name = 'archived_at') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'feedback' AND column_name = 'resolved_at') THEN
    EXECUTE 'ALTER TABLE "feedback" RENAME COLUMN "archived_at" TO "resolved_at"';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'removed_access') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'access_removed_at') THEN
    EXECUTE 'ALTER TABLE "profiles" RENAME COLUMN "removed_access" TO "access_removed_at"';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'removed_access_by') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'access_removed_by_profile_id') THEN
    EXECUTE 'ALTER TABLE "profiles" RENAME COLUMN "removed_access_by" TO "access_removed_by_profile_id"';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'beta_access') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'beta_access_granted_at') THEN
    EXECUTE 'ALTER TABLE "profiles" RENAME COLUMN "beta_access" TO "beta_access_granted_at"';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reservations' AND column_name = 'user_id') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reservations' AND column_name = 'owner_profile_id') THEN
    EXECUTE 'ALTER TABLE "reservations" RENAME COLUMN "user_id" TO "owner_profile_id"';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reservations' AND column_name = 'start_time') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reservations' AND column_name = 'start_at') THEN
    EXECUTE 'ALTER TABLE "reservations" RENAME COLUMN "start_time" TO "start_at"';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reservations' AND column_name = 'end_time') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reservations' AND column_name = 'end_at') THEN
    EXECUTE 'ALTER TABLE "reservations" RENAME COLUMN "end_time" TO "end_at"';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedule_breaks' AND column_name = 'created_by') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedule_breaks' AND column_name = 'created_by_profile_id') THEN
    EXECUTE 'ALTER TABLE "schedule_breaks" RENAME COLUMN "created_by" TO "created_by_profile_id"';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'year') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'onboardingYear') THEN
    EXECUTE 'ALTER TABLE "teams" RENAME COLUMN "year" TO "onboardingYear"';
  END IF;
END
$repair$;
ALTER TABLE "books" DROP CONSTRAINT IF EXISTS "books_suggested_points_check";
ALTER TABLE "books" DROP CONSTRAINT IF EXISTS "books_book_points_check";
ALTER TABLE "recurring_schedules" DROP CONSTRAINT IF EXISTS "valid_schedule_dates";
ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "valid_reservation_time";
ALTER TABLE "books" DROP CONSTRAINT IF EXISTS "books_added_by_profile_id_fkey";
ALTER TABLE "books" DROP CONSTRAINT IF EXISTS "books_approved_by_profile_id_fkey";
ALTER TABLE "feedback" DROP CONSTRAINT IF EXISTS "feedback_admin_response_by_fkey";
ALTER TABLE "profiles" DROP CONSTRAINT IF EXISTS "profiles_removed_access_by_fkey";
ALTER TABLE "recurring_schedules" DROP CONSTRAINT IF EXISTS "recurring_schedules_created_by_fkey";
ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "reservations_user_id_fkey";
ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "reservations_team_id_fkey";
ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "reservations_recurring_schedule_id_fkey";
ALTER TABLE "schedule_breaks" DROP CONSTRAINT IF EXISTS "schedule_breaks_created_by_fkey";
DROP INDEX IF EXISTS "books_added_by_idx";
DROP INDEX IF EXISTS "essays_content_text_tsv_idx";
DROP INDEX IF EXISTS "essays_title_trgm_idx";
DROP INDEX IF EXISTS "essays_vote_count_idx";
DROP INDEX IF EXISTS "idx_reservations_recurring";
DROP INDEX IF EXISTS "idx_reservations_team";
DROP INDEX IF EXISTS "idx_reservations_type";
DROP INDEX IF EXISTS "idx_reservations_user";
DROP INDEX IF EXISTS "idx_schedule_breaks_type";
DROP INDEX IF EXISTS "feedback_active_created_idx";
DROP INDEX IF EXISTS "idx_recurring_schedules_day";
DROP INDEX IF EXISTS "idx_reservations_room_time";
DROP INDEX IF EXISTS "idx_reservations_start";
ALTER TABLE "books" ALTER COLUMN "book_points" SET DATA TYPE numeric(3, 2);
ALTER TABLE "books" ALTER COLUMN "book_points" DROP DEFAULT;
ALTER TABLE "books" ALTER COLUMN "book_points" DROP NOT NULL;
ALTER TABLE "recurring_schedules" ALTER COLUMN "team_id" DROP NOT NULL;
ALTER TABLE "recurring_schedules" ALTER COLUMN "day_of_week" SET DATA TYPE smallint;
ALTER TABLE "recurring_schedules" ALTER COLUMN "valid_until" DROP NOT NULL;
ALTER TABLE "book_comments" ADD COLUMN IF NOT EXISTS "removed_at" timestamp with time zone;
-- was: ALTER TABLE "book_comments" ADD COLUMN "created_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "book_comments" ADD COLUMN IF NOT EXISTS "created_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'book_comments' AND column_name = 'author_profile_id') THEN
    EXECUTE 'UPDATE "book_comments" SET "created_by_profile_id" = COALESCE("author_profile_id", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "created_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "book_comments" SET "created_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "created_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "book_comments" ALTER COLUMN "created_by_profile_id" SET NOT NULL;
-- was: ALTER TABLE "book_comments" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "book_comments" ADD COLUMN IF NOT EXISTS "updated_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'book_comments' AND column_name = 'author_profile_id') THEN
    EXECUTE 'UPDATE "book_comments" SET "updated_by_profile_id" = COALESCE("author_profile_id", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "updated_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "book_comments" SET "updated_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "updated_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "book_comments" ALTER COLUMN "updated_by_profile_id" SET NOT NULL;
-- was: ALTER TABLE "books" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "updated_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'created_by_profile_id') THEN
    EXECUTE 'UPDATE "books" SET "updated_by_profile_id" = COALESCE("created_by_profile_id", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "updated_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "books" SET "updated_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "updated_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "books" ALTER COLUMN "updated_by_profile_id" SET NOT NULL;
ALTER TABLE "dashboard_layouts" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
-- was: ALTER TABLE "dashboard_layouts" ADD COLUMN "created_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "dashboard_layouts" ADD COLUMN IF NOT EXISTS "created_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dashboard_layouts' AND column_name = 'profile_id') THEN
    EXECUTE 'UPDATE "dashboard_layouts" SET "created_by_profile_id" = COALESCE("profile_id", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "created_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "dashboard_layouts" SET "created_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "created_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "dashboard_layouts" ALTER COLUMN "created_by_profile_id" SET NOT NULL;
-- was: ALTER TABLE "dashboard_layouts" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "dashboard_layouts" ADD COLUMN IF NOT EXISTS "updated_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dashboard_layouts' AND column_name = 'profile_id') THEN
    EXECUTE 'UPDATE "dashboard_layouts" SET "updated_by_profile_id" = COALESCE("profile_id", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "updated_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "dashboard_layouts" SET "updated_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "updated_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "dashboard_layouts" ALTER COLUMN "updated_by_profile_id" SET NOT NULL;
ALTER TABLE "essay_coach_reads" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "essay_coach_reads" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
-- was: ALTER TABLE "essay_coach_reads" ADD COLUMN "created_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "essay_coach_reads" ADD COLUMN IF NOT EXISTS "created_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'essay_coach_reads' AND column_name = 'coach_profile_id') THEN
    EXECUTE 'UPDATE "essay_coach_reads" SET "created_by_profile_id" = COALESCE("coach_profile_id", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "created_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "essay_coach_reads" SET "created_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "created_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "essay_coach_reads" ALTER COLUMN "created_by_profile_id" SET NOT NULL;
-- was: ALTER TABLE "essay_coach_reads" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "essay_coach_reads" ADD COLUMN IF NOT EXISTS "updated_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'essay_coach_reads' AND column_name = 'coach_profile_id') THEN
    EXECUTE 'UPDATE "essay_coach_reads" SET "updated_by_profile_id" = COALESCE("coach_profile_id", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "updated_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "essay_coach_reads" SET "updated_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "updated_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "essay_coach_reads" ALTER COLUMN "updated_by_profile_id" SET NOT NULL;
ALTER TABLE "essay_comments" ADD COLUMN IF NOT EXISTS "removed_at" timestamp with time zone;
-- was: ALTER TABLE "essay_comments" ADD COLUMN "created_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "essay_comments" ADD COLUMN IF NOT EXISTS "created_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'essay_comments' AND column_name = 'author_profile_id') THEN
    EXECUTE 'UPDATE "essay_comments" SET "created_by_profile_id" = COALESCE("author_profile_id", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "created_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "essay_comments" SET "created_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "created_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "essay_comments" ALTER COLUMN "created_by_profile_id" SET NOT NULL;
-- was: ALTER TABLE "essay_comments" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "essay_comments" ADD COLUMN IF NOT EXISTS "updated_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'essay_comments' AND column_name = 'author_profile_id') THEN
    EXECUTE 'UPDATE "essay_comments" SET "updated_by_profile_id" = COALESCE("author_profile_id", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "updated_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "essay_comments" SET "updated_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "updated_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "essay_comments" ALTER COLUMN "updated_by_profile_id" SET NOT NULL;
ALTER TABLE "essay_views" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "essay_views" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
-- was: ALTER TABLE "essay_views" ADD COLUMN "created_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "essay_views" ADD COLUMN IF NOT EXISTS "created_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'essay_views' AND column_name = 'viewer_profile_id') THEN
    EXECUTE 'UPDATE "essay_views" SET "created_by_profile_id" = COALESCE("viewer_profile_id", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "created_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "essay_views" SET "created_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "created_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "essay_views" ALTER COLUMN "created_by_profile_id" SET NOT NULL;
-- was: ALTER TABLE "essay_views" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "essay_views" ADD COLUMN IF NOT EXISTS "updated_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'essay_views' AND column_name = 'viewer_profile_id') THEN
    EXECUTE 'UPDATE "essay_views" SET "updated_by_profile_id" = COALESCE("viewer_profile_id", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "updated_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "essay_views" SET "updated_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "updated_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "essay_views" ALTER COLUMN "updated_by_profile_id" SET NOT NULL;
ALTER TABLE "essay_votes" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
-- was: ALTER TABLE "essay_votes" ADD COLUMN "created_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "essay_votes" ADD COLUMN IF NOT EXISTS "created_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'essay_votes' AND column_name = 'voter_profile_id') THEN
    EXECUTE 'UPDATE "essay_votes" SET "created_by_profile_id" = COALESCE("voter_profile_id", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "created_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "essay_votes" SET "created_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "created_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "essay_votes" ALTER COLUMN "created_by_profile_id" SET NOT NULL;
-- was: ALTER TABLE "essay_votes" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "essay_votes" ADD COLUMN IF NOT EXISTS "updated_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'essay_votes' AND column_name = 'voter_profile_id') THEN
    EXECUTE 'UPDATE "essay_votes" SET "updated_by_profile_id" = COALESCE("voter_profile_id", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "updated_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "essay_votes" SET "updated_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "updated_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "essay_votes" ALTER COLUMN "updated_by_profile_id" SET NOT NULL;
ALTER TABLE "essays" ADD COLUMN IF NOT EXISTS "pinned_by_profile_id" uuid;
ALTER TABLE "essays" ADD COLUMN IF NOT EXISTS "removed_at" timestamp with time zone;
-- was: ALTER TABLE "essays" ADD COLUMN "created_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "essays" ADD COLUMN IF NOT EXISTS "created_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'essays' AND column_name = 'author_profile_id') THEN
    EXECUTE 'UPDATE "essays" SET "created_by_profile_id" = COALESCE("author_profile_id", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "created_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "essays" SET "created_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "created_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "essays" ALTER COLUMN "created_by_profile_id" SET NOT NULL;
-- was: ALTER TABLE "essays" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "essays" ADD COLUMN IF NOT EXISTS "updated_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'essays' AND column_name = 'author_profile_id') THEN
    EXECUTE 'UPDATE "essays" SET "updated_by_profile_id" = COALESCE("author_profile_id", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "updated_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "essays" SET "updated_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "updated_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "essays" ALTER COLUMN "updated_by_profile_id" SET NOT NULL;
-- was: ALTER TABLE "feedback" ADD COLUMN "created_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "created_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'feedback' AND column_name = 'author_profile_id') THEN
    EXECUTE 'UPDATE "feedback" SET "created_by_profile_id" = COALESCE("author_profile_id", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "created_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "feedback" SET "created_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "created_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "feedback" ALTER COLUMN "created_by_profile_id" SET NOT NULL;
-- was: ALTER TABLE "feedback" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "updated_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'feedback' AND column_name = 'author_profile_id') THEN
    EXECUTE 'UPDATE "feedback" SET "updated_by_profile_id" = COALESCE("author_profile_id", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "updated_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "feedback" SET "updated_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "updated_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "feedback" ALTER COLUMN "updated_by_profile_id" SET NOT NULL;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "created_by_profile_id" uuid;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "updated_by_profile_id" uuid;
-- was: ALTER TABLE "recurring_schedules" ADD COLUMN "schedule_type" "schedule_type" NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "recurring_schedules" ADD COLUMN IF NOT EXISTS "schedule_type" "schedule_type";
UPDATE "recurring_schedules" SET "schedule_type" = 'training_session'::public.schedule_type WHERE "schedule_type" IS NULL;
ALTER TABLE "recurring_schedules" ALTER COLUMN "schedule_type" SET NOT NULL;
ALTER TABLE "recurring_schedules" ADD COLUMN IF NOT EXISTS "removed_at" timestamp with time zone;
ALTER TABLE "recurring_schedules" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
-- was: ALTER TABLE "recurring_schedules" ADD COLUMN "created_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "recurring_schedules" ADD COLUMN IF NOT EXISTS "created_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'recurring_schedules' AND column_name = 'created_by') THEN
    EXECUTE 'UPDATE "recurring_schedules" SET "created_by_profile_id" = COALESCE("created_by", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "created_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "recurring_schedules" SET "created_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "created_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "recurring_schedules" ALTER COLUMN "created_by_profile_id" SET NOT NULL;
-- was: ALTER TABLE "recurring_schedules" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "recurring_schedules" ADD COLUMN IF NOT EXISTS "updated_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'recurring_schedules' AND column_name = 'created_by') THEN
    EXECUTE 'UPDATE "recurring_schedules" SET "updated_by_profile_id" = COALESCE("created_by", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "updated_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "recurring_schedules" SET "updated_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "updated_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "recurring_schedules" ALTER COLUMN "updated_by_profile_id" SET NOT NULL;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "cancelled_by_profile_id" uuid;
-- was: ALTER TABLE "reservations" ADD COLUMN "created_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "created_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reservations' AND column_name = 'owner_profile_id') THEN
    EXECUTE 'UPDATE "reservations" SET "created_by_profile_id" = COALESCE("owner_profile_id", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "created_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "reservations" SET "created_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "created_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "reservations" ALTER COLUMN "created_by_profile_id" SET NOT NULL;
-- was: ALTER TABLE "reservations" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "updated_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reservations' AND column_name = 'owner_profile_id') THEN
    EXECUTE 'UPDATE "reservations" SET "updated_by_profile_id" = COALESCE("owner_profile_id", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "updated_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "reservations" SET "updated_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "updated_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "reservations" ALTER COLUMN "updated_by_profile_id" SET NOT NULL;
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "removed_at" timestamp with time zone;
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
-- was: ALTER TABLE "rooms" ADD COLUMN "created_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "created_by_profile_id" uuid;
UPDATE "rooms" SET "created_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = 'admin') DESC, created_at, id LIMIT 1) WHERE "created_by_profile_id" IS NULL;
ALTER TABLE "rooms" ALTER COLUMN "created_by_profile_id" SET NOT NULL;
-- was: ALTER TABLE "rooms" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "updated_by_profile_id" uuid;
UPDATE "rooms" SET "updated_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = 'admin') DESC, created_at, id LIMIT 1) WHERE "updated_by_profile_id" IS NULL;
ALTER TABLE "rooms" ALTER COLUMN "updated_by_profile_id" SET NOT NULL;
ALTER TABLE "schedule_breaks" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
-- was: ALTER TABLE "schedule_breaks" ADD COLUMN "updated_by_profile_id" uuid NOT NULL;  (NOT NULL, no DEFAULT -> unsafe on populated table)
ALTER TABLE "schedule_breaks" ADD COLUMN IF NOT EXISTS "updated_by_profile_id" uuid;
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedule_breaks' AND column_name = 'created_by_profile_id') THEN
    EXECUTE 'UPDATE "schedule_breaks" SET "updated_by_profile_id" = COALESCE("created_by_profile_id", (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1)) WHERE "updated_by_profile_id" IS NULL';
  ELSE
    EXECUTE 'UPDATE "schedule_breaks" SET "updated_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = ''admin'') DESC, created_at, id LIMIT 1) WHERE "updated_by_profile_id" IS NULL';
  END IF;
END
$repair$;
ALTER TABLE "schedule_breaks" ALTER COLUMN "updated_by_profile_id" SET NOT NULL;
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "removed_at" timestamp with time zone;
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "created_by_profile_id" uuid;
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "updated_by_profile_id" uuid;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'book_tags' AND c.conname = 'book_tags_book_id_fkey') THEN
    EXECUTE 'ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'book_tags' AND c.conname = 'book_tags_tag_id_fkey') THEN
    EXECUTE 'ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'book_tags' AND c.conname = 'book_tags_created_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'book_tags' AND c.conname = 'book_tags_updated_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'tags' AND c.conname = 'tags_created_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "tags" ADD CONSTRAINT "tags_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'tags' AND c.conname = 'tags_updated_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "tags" ADD CONSTRAINT "tags_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'essay_revisions' AND c.conname = 'essay_revisions_essay_id_fkey') THEN
    EXECUTE 'ALTER TABLE "essay_revisions" ADD CONSTRAINT "essay_revisions_essay_id_fkey" FOREIGN KEY ("essay_id") REFERENCES "public"."essays"("id") ON DELETE cascade ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'essay_revisions' AND c.conname = 'essay_revisions_created_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "essay_revisions" ADD CONSTRAINT "essay_revisions_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'essay_revisions' AND c.conname = 'essay_revisions_updated_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "essay_revisions" ADD CONSTRAINT "essay_revisions_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
CREATE INDEX IF NOT EXISTS "book_tags_tag_idx" ON "book_tags" USING btree ("tag_id" uuid_ops);
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'book_comments' AND c.conname = 'book_comments_created_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "book_comments" ADD CONSTRAINT "book_comments_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'book_comments' AND c.conname = 'book_comments_updated_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "book_comments" ADD CONSTRAINT "book_comments_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'books' AND c.conname = 'books_created_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "books" ADD CONSTRAINT "books_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'books' AND c.conname = 'books_updated_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "books" ADD CONSTRAINT "books_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'books' AND c.conname = 'books_status_changed_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "books" ADD CONSTRAINT "books_status_changed_by_profile_id_fkey" FOREIGN KEY ("status_changed_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'dashboard_layouts' AND c.conname = 'dashboard_layouts_created_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'dashboard_layouts' AND c.conname = 'dashboard_layouts_updated_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'essay_coach_reads' AND c.conname = 'essay_coach_reads_created_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "essay_coach_reads" ADD CONSTRAINT "essay_coach_reads_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'essay_coach_reads' AND c.conname = 'essay_coach_reads_updated_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "essay_coach_reads" ADD CONSTRAINT "essay_coach_reads_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'essay_comments' AND c.conname = 'essay_comments_created_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "essay_comments" ADD CONSTRAINT "essay_comments_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'essay_comments' AND c.conname = 'essay_comments_updated_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "essay_comments" ADD CONSTRAINT "essay_comments_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'essay_views' AND c.conname = 'essay_views_created_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "essay_views" ADD CONSTRAINT "essay_views_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'essay_views' AND c.conname = 'essay_views_updated_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "essay_views" ADD CONSTRAINT "essay_views_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'essay_votes' AND c.conname = 'essay_votes_created_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "essay_votes" ADD CONSTRAINT "essay_votes_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'essay_votes' AND c.conname = 'essay_votes_updated_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "essay_votes" ADD CONSTRAINT "essay_votes_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'essays' AND c.conname = 'essays_pinned_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "essays" ADD CONSTRAINT "essays_pinned_by_profile_id_fkey" FOREIGN KEY ("pinned_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'essays' AND c.conname = 'essays_created_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "essays" ADD CONSTRAINT "essays_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'essays' AND c.conname = 'essays_updated_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "essays" ADD CONSTRAINT "essays_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'feedback' AND c.conname = 'feedback_created_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "feedback" ADD CONSTRAINT "feedback_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'feedback' AND c.conname = 'feedback_updated_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "feedback" ADD CONSTRAINT "feedback_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'profiles' AND c.conname = 'profiles_access_removed_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "profiles" ADD CONSTRAINT "profiles_access_removed_by_profile_id_fkey" FOREIGN KEY ("access_removed_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'profiles' AND c.conname = 'profiles_created_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "profiles" ADD CONSTRAINT "profiles_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'profiles' AND c.conname = 'profiles_updated_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "profiles" ADD CONSTRAINT "profiles_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'recurring_schedules' AND c.conname = 'recurring_schedules_created_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'recurring_schedules' AND c.conname = 'recurring_schedules_updated_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'reservations' AND c.conname = 'reservations_owner_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "reservations" ADD CONSTRAINT "reservations_owner_profile_id_fkey" FOREIGN KEY ("owner_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'reservations' AND c.conname = 'reservations_cancelled_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "reservations" ADD CONSTRAINT "reservations_cancelled_by_profile_id_fkey" FOREIGN KEY ("cancelled_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'reservations' AND c.conname = 'reservations_created_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "reservations" ADD CONSTRAINT "reservations_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'reservations' AND c.conname = 'reservations_updated_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "reservations" ADD CONSTRAINT "reservations_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'rooms' AND c.conname = 'rooms_created_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "rooms" ADD CONSTRAINT "rooms_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'rooms' AND c.conname = 'rooms_updated_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "rooms" ADD CONSTRAINT "rooms_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'schedule_breaks' AND c.conname = 'schedule_breaks_created_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "schedule_breaks" ADD CONSTRAINT "schedule_breaks_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'schedule_breaks' AND c.conname = 'schedule_breaks_updated_by_profile_id_fkey') THEN
    EXECUTE 'ALTER TABLE "schedule_breaks" ADD CONSTRAINT "schedule_breaks_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action';
  END IF;
END
$repair$;
CREATE INDEX IF NOT EXISTS "books_created_by_idx" ON "books" USING btree ("created_by_profile_id" uuid_ops);
CREATE INDEX IF NOT EXISTS "idx_recurring_schedules_type" ON "recurring_schedules" USING btree ("schedule_type" enum_ops);
CREATE INDEX IF NOT EXISTS "idx_reservations_owner" ON "reservations" USING btree ("owner_profile_id" uuid_ops);
CREATE INDEX IF NOT EXISTS "feedback_active_created_idx" ON "feedback" USING btree ("resolved_at" timestamptz_ops,"created_at" timestamptz_ops);
CREATE INDEX IF NOT EXISTS "idx_recurring_schedules_day" ON "recurring_schedules" USING btree ("day_of_week" int2_ops);
CREATE INDEX IF NOT EXISTS "idx_reservations_room_time" ON "reservations" USING btree ("room_id" uuid_ops,"start_at" timestamptz_ops,"end_at" timestamptz_ops);
CREATE INDEX IF NOT EXISTS "idx_reservations_start" ON "reservations" USING btree ("start_at" timestamptz_ops);
ALTER TABLE "books" DROP COLUMN IF EXISTS "tags";
ALTER TABLE "books" DROP COLUMN IF EXISTS "suggested_points";
ALTER TABLE "books" DROP COLUMN IF EXISTS "ai_book_points";
ALTER TABLE "books" DROP COLUMN IF EXISTS "legacy_book_points";
ALTER TABLE "books" DROP COLUMN IF EXISTS "ai_reason";
ALTER TABLE "essays" DROP COLUMN IF EXISTS "title";
ALTER TABLE "essays" DROP COLUMN IF EXISTS "content_json";
ALTER TABLE "essays" DROP COLUMN IF EXISTS "content_text";
ALTER TABLE "essays" DROP COLUMN IF EXISTS "view_count";
ALTER TABLE "essays" DROP COLUMN IF EXISTS "vote_count";
ALTER TABLE "essays" DROP COLUMN IF EXISTS "is_pinned";
ALTER TABLE "feedback" DROP COLUMN IF EXISTS "admin_response";
ALTER TABLE "feedback" DROP COLUMN IF EXISTS "admin_response_by";
ALTER TABLE "feedback" DROP COLUMN IF EXISTS "admin_response_at";
ALTER TABLE "users" DROP COLUMN IF EXISTS "google_profile_picture";
ALTER TABLE "users" DROP COLUMN IF EXISTS "google_full_name";
ALTER TABLE "recurring_schedules" DROP COLUMN IF EXISTS "created_by";
DROP POLICY IF EXISTS "Coaches can manage TS reservations" ON "reservations" CASCADE;
DROP POLICY IF EXISTS "Users can create own reservations" ON "reservations" CASCADE;
ALTER TABLE "reservations" DROP COLUMN IF EXISTS "team_id";
ALTER TABLE "reservations" DROP COLUMN IF EXISTS "recurring_schedule_id";
ALTER TABLE "reservations" DROP COLUMN IF EXISTS "reservation_type";
ALTER TABLE "reservations" DROP COLUMN IF EXISTS "is_cowork_open";
ALTER TABLE "schedule_breaks" DROP COLUMN IF EXISTS "break_type";
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'books' AND c.conname = 'books_book_points_check') THEN
    EXECUTE 'ALTER TABLE "books" ADD CONSTRAINT "books_book_points_check" CHECK ((book_points IS NULL) OR ((book_points >= (0)::numeric) AND (book_points <= (3)::numeric)))';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'recurring_schedules' AND c.conname = 'recurring_schedules_team_for_ts') THEN
    EXECUTE 'ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_team_for_ts" CHECK ((schedule_type <> ''training_session''::schedule_type) OR (team_id IS NOT NULL))';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'recurring_schedules' AND c.conname = 'valid_schedule_dates') THEN
    EXECUTE 'ALTER TABLE "recurring_schedules" ADD CONSTRAINT "valid_schedule_dates" CHECK ((valid_until IS NULL) OR (valid_until >= valid_from))';
  END IF;
END
$repair$;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = 'reservations' AND c.conname = 'valid_reservation_time') THEN
    EXECUTE 'ALTER TABLE "reservations" ADD CONSTRAINT "valid_reservation_time" CHECK (end_at > start_at)';
  END IF;
END
$repair$;
CREATE VIEW "public"."books_with_essay_count" AS (SELECT b.id, b.title, b.author, b.isbn_13, b.description, b.supabase_cover_img_url, b.book_points, b.page_count, b.preview_link, b.source, b.external_id, b.status, b.status_changed_at, b.status_changed_by_profile_id, b.status_reason, b.created_at, b.updated_at, b.created_by_profile_id, b.updated_by_profile_id, COALESCE(ec.essay_count, 0) AS essay_count FROM books b LEFT JOIN ( SELECT essays.book_id, count(*)::integer AS essay_count FROM essays WHERE essays.book_id IS NOT NULL GROUP BY essays.book_id) ec ON ec.book_id = b.id);
DROP POLICY IF EXISTS "Users can create own reservations" ON "reservations";
CREATE POLICY "Users can create own reservations" ON "reservations" AS PERMISSIVE FOR INSERT TO "authenticated";
DROP POLICY IF EXISTS "Authenticated users can view book tags" ON "book_tags";
CREATE POLICY "Authenticated users can view book tags" ON "book_tags" AS PERMISSIVE FOR SELECT TO "authenticated";
DROP POLICY IF EXISTS "Authenticated users can assign book tags" ON "book_tags";
CREATE POLICY "Authenticated users can assign book tags" ON "book_tags" AS PERMISSIVE FOR INSERT TO "authenticated";
DROP POLICY IF EXISTS "Coaches and admins can update book tags" ON "book_tags";
CREATE POLICY "Coaches and admins can update book tags" ON "book_tags" AS PERMISSIVE FOR UPDATE TO "authenticated";
DROP POLICY IF EXISTS "Coaches and admins can remove book tags" ON "book_tags";
CREATE POLICY "Coaches and admins can remove book tags" ON "book_tags" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_coach_or_admin());
DROP POLICY IF EXISTS "Authenticated users can view tags" ON "tags";
CREATE POLICY "Authenticated users can view tags" ON "tags" AS PERMISSIVE FOR SELECT TO "authenticated";
DROP POLICY IF EXISTS "Coaches and admins can add tags" ON "tags";
CREATE POLICY "Coaches and admins can add tags" ON "tags" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_coach_or_admin());
DROP POLICY IF EXISTS "Coaches and admins can update tags" ON "tags";
CREATE POLICY "Coaches and admins can update tags" ON "tags" AS PERMISSIVE FOR UPDATE TO "authenticated";
DROP POLICY IF EXISTS "Coaches and admins can delete tags" ON "tags";
CREATE POLICY "Coaches and admins can delete tags" ON "tags" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_coach_or_admin());
DROP POLICY IF EXISTS "Authenticated users can view essay revisions" ON "essay_revisions";
CREATE POLICY "Authenticated users can view essay revisions" ON "essay_revisions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
DROP POLICY IF EXISTS "Authors can create essay revisions" ON "essay_revisions";
CREATE POLICY "Authors can create essay revisions" ON "essay_revisions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((created_by_profile_id = current_profile_id()));
DROP POLICY IF EXISTS "Essay revisions cannot be updated" ON "essay_revisions";
CREATE POLICY "Essay revisions cannot be updated" ON "essay_revisions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false);
DROP POLICY IF EXISTS "Essay revisions cannot be deleted" ON "essay_revisions";
CREATE POLICY "Essay revisions cannot be deleted" ON "essay_revisions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);
DO $repair$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Verified users can view all profiles') THEN
    EXECUTE 'ALTER POLICY "Verified users can view all profiles" ON "profiles" TO authenticated USING (((access_removed_at IS NULL) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_user_id = ( SELECT auth.uid() AS uid)) AND (users.verified_work_email IS NOT NULL))))))';
  END IF;
END
$repair$;
DROP TYPE IF EXISTS "public"."issue_status";
DROP TYPE IF EXISTS "public"."issue_type";
DROP TYPE IF EXISTS "public"."reservation_type";
DROP TYPE IF EXISTS "public"."schedule_break_type";
-- ----------------------------------------------------------------------------
-- Prepare for 20260719161010_fix_rename_casts.sql, the next migration the CLI
-- will run. It does `alter column created_by_profile_id set not null` on
-- schedule_breaks (line 87) and recurring_schedules (line 71). noisy_medusa only
-- RENAMES schedule_breaks.created_by -> created_by_profile_id and never
-- backfills it, and the old column was nullable -- so that migration is the next
-- 23502 waiting to happen. Backfill it here.
-- ----------------------------------------------------------------------------
UPDATE "schedule_breaks"
SET "created_by_profile_id" = (SELECT id FROM public.profiles ORDER BY (role = 'admin') DESC, created_at, id LIMIT 1)
WHERE "created_by_profile_id" IS NULL;

ALTER TABLE "schedule_breaks" ALTER COLUMN "created_by_profile_id" SET NOT NULL;

-- ----------------------------------------------------------------------------
-- Record the migration as applied so the CLI skips it next run.
-- (Equivalent to: supabase migration repair --status applied 20260718212747)
-- ----------------------------------------------------------------------------
DO $repair$
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('20260718212747')
    ON CONFLICT DO NOTHING;
  END IF;
END
$repair$;

COMMIT;
