-- ============================================================================
-- Snapshot the data that 20260718212747_noisy_medusa.sql destroys.
--
-- Run this BEFORE noisy-medusa-repair.sql. It copies every column and table the
-- migration drops into a `legacy` schema, so the drop stops being irreversible.
--
-- `legacy` is deliberately NOT `public`:
--   * drizzle.config.ts has schemaFilter: ["public"], so drizzle-kit never sees
--     these tables and `db:generate` will not try to drop them
--   * it is not in config.toml's exposed `schemas`, so PostgREST cannot read it
--
-- Drop the schema once you are satisfied nothing is needed:
--   DROP SCHEMA legacy CASCADE;
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS legacy;
REVOKE ALL ON SCHEMA legacy FROM anon, authenticated;

COMMENT ON SCHEMA legacy IS
  'Pre-20260718212747 snapshots of columns/tables dropped by noisy_medusa. Safe to DROP ... CASCADE once verified.';

-- ---------------------------------------------------------------------------
-- reservations: reservation_type / team_id / recurring_schedule_id /
-- is_cowork_open are dropped and have NO replacement in the new schema. Without
-- this snapshot you can no longer tell a personal reservation from a Training
-- Session or Houston Calling, nor link a reservation to the schedule that
-- generated it.
-- ---------------------------------------------------------------------------
DO $snap$
BEGIN
  IF to_regclass('legacy.reservations_dropped_fields') IS NULL THEN
    CREATE TABLE legacy.reservations_dropped_fields AS
    SELECT id AS reservation_id,
           team_id,
           recurring_schedule_id,
           reservation_type::text AS reservation_type,
           is_cowork_open
    FROM public.reservations;

    ALTER TABLE legacy.reservations_dropped_fields
      ADD PRIMARY KEY (reservation_id);
  END IF;
END
$snap$;

-- ---------------------------------------------------------------------------
-- schedule_breaks.break_type
-- ---------------------------------------------------------------------------
DO $snap$
BEGIN
  IF to_regclass('legacy.schedule_breaks_dropped_fields') IS NULL THEN
    CREATE TABLE legacy.schedule_breaks_dropped_fields AS
    SELECT id AS schedule_break_id, break_type::text AS break_type
    FROM public.schedule_breaks;

    ALTER TABLE legacy.schedule_breaks_dropped_fields
      ADD PRIMARY KEY (schedule_break_id);
  END IF;
END
$snap$;

-- ---------------------------------------------------------------------------
-- users.google_full_name / google_profile_picture
--
-- Belt and braces only. These are NOT a real loss: auth.users.raw_user_meta_data
-- is the source of truth, and 20260719161140_google_profile_defaults.sql reads it
-- directly to backfill profiles.name / profiles.picture. Snapshotted anyway
-- because it costs nothing.
-- ---------------------------------------------------------------------------
DO $snap$
BEGIN
  IF to_regclass('legacy.users_dropped_fields') IS NULL THEN
    CREATE TABLE legacy.users_dropped_fields AS
    SELECT id AS user_id, google_full_name, google_profile_picture
    FROM public.users;

    ALTER TABLE legacy.users_dropped_fields ADD PRIMARY KEY (user_id);
  END IF;
END
$snap$;

-- ---------------------------------------------------------------------------
-- essays: title / content_json / content_text are dropped while essay_revisions
-- is created EMPTY. The migration never copies the content across.
-- ---------------------------------------------------------------------------
DO $snap$
BEGIN
  IF to_regclass('legacy.essays_content') IS NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'essays'
         AND column_name = 'content_json'
     )
  THEN
    EXECUTE $sql$
      CREATE TABLE legacy.essays_content AS
      SELECT id AS essay_id, title, content_json, content_text,
             view_count, vote_count, is_pinned
      FROM public.essays
    $sql$;
    EXECUTE 'ALTER TABLE legacy.essays_content ADD PRIMARY KEY (essay_id)';
  END IF;
END
$snap$;

-- ---------------------------------------------------------------------------
-- books: columns dropped wholesale
-- ---------------------------------------------------------------------------
DO $snap$
BEGIN
  IF to_regclass('legacy.books_dropped_fields') IS NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'books'
         AND column_name = 'suggested_points'
     )
  THEN
    EXECUTE $sql$
      CREATE TABLE legacy.books_dropped_fields AS
      SELECT id AS book_id, tags, suggested_points, ai_book_points,
             legacy_book_points, ai_reason
      FROM public.books
    $sql$;
    EXECUTE 'ALTER TABLE legacy.books_dropped_fields ADD PRIMARY KEY (book_id)';
  END IF;
END
$snap$;

-- ---------------------------------------------------------------------------
-- feedback.admin_response*
-- ---------------------------------------------------------------------------
DO $snap$
BEGIN
  IF to_regclass('legacy.feedback_dropped_fields') IS NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'feedback'
         AND column_name = 'admin_response'
     )
  THEN
    EXECUTE $sql$
      CREATE TABLE legacy.feedback_dropped_fields AS
      SELECT id AS feedback_id, admin_response, admin_response_by, admin_response_at
      FROM public.feedback
    $sql$;
    EXECUTE 'ALTER TABLE legacy.feedback_dropped_fields ADD PRIMARY KEY (feedback_id)';
  END IF;
END
$snap$;

-- ---------------------------------------------------------------------------
-- Whole tables the migration drops.
-- ---------------------------------------------------------------------------
DO $snap$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'room_issues',
    'team_reading_lists',
    'team_reading_list_books',
    'cowork_participants'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL
       AND to_regclass('legacy.' || t) IS NULL
    THEN
      EXECUTE format('CREATE TABLE legacy.%I AS SELECT * FROM public.%I', t, t);
    END IF;
  END LOOP;
END
$snap$;

-- ---------------------------------------------------------------------------
-- What was captured.
-- ---------------------------------------------------------------------------
DO $snap$
DECLARE
  r record;
  n bigint;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'legacy' ORDER BY tablename
  LOOP
    EXECUTE format('SELECT count(*) FROM legacy.%I', r.tablename) INTO n;
    RAISE NOTICE 'legacy.% -> % row(s)', r.tablename, n;
  END LOOP;
END
$snap$;

COMMIT;
