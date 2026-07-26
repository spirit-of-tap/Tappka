-- ============================================================================
-- READ-ONLY preflight for the 20260718212747_noisy_medusa.sql repair.
--
-- Run this against production FIRST and read every section. Nothing here
-- writes. Section 3 is the one that matters: it lists data the migration
-- destroys outright.
-- ============================================================================

\echo '=== 1. Migration state (is noisy_medusa really unapplied?) ==='
SELECT version
FROM supabase_migrations.schema_migrations
WHERE version >= '20260713040708'
ORDER BY version;
-- Expect: 20260713040708 and 20260713040325 present, nothing >= 20260718212747.

\echo '=== 2. Did the rename roll back? (confirms the 42703 diagnosis) ==='
SELECT
  bool_or(column_name = 'removed_access')    AS has_old_removed_access,
  bool_or(column_name = 'access_removed_at') AS has_new_access_removed_at
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles';
-- Expect: t / f. That is the 42703 the app is throwing.

\echo '=== 3. DATA THAT THE MIGRATION DESTROYS (decide before running) ==='
SELECT 'reservations.reservation_type' AS losing, count(*) AS rows_with_data
  FROM reservations WHERE reservation_type IS NOT NULL
UNION ALL SELECT 'reservations.team_id',              count(*) FROM reservations WHERE team_id IS NOT NULL
UNION ALL SELECT 'reservations.recurring_schedule_id',count(*) FROM reservations WHERE recurring_schedule_id IS NOT NULL
UNION ALL SELECT 'reservations.is_cowork_open',       count(*) FROM reservations WHERE is_cowork_open
UNION ALL SELECT 'schedule_breaks.break_type',        count(*) FROM schedule_breaks WHERE break_type IS NOT NULL
UNION ALL SELECT 'users.google_profile_picture',      count(*) FROM users WHERE google_profile_picture IS NOT NULL
UNION ALL SELECT 'users.google_full_name',            count(*) FROM users WHERE google_full_name IS NOT NULL
UNION ALL SELECT 'essays.title / content_json',       count(*) FROM essays
UNION ALL SELECT 'books.tags / ai_book_points / ...', count(*) FROM books
UNION ALL SELECT 'feedback.admin_response*',          count(*) FROM feedback WHERE admin_response IS NOT NULL
UNION ALL SELECT 'TABLE team_reading_lists',          count(*) FROM team_reading_lists
UNION ALL SELECT 'TABLE team_reading_list_books',     count(*) FROM team_reading_list_books
UNION ALL SELECT 'TABLE cowork_participants',         count(*) FROM cowork_participants
UNION ALL SELECT 'TABLE room_issues',                 count(*) FROM room_issues
ORDER BY rows_with_data DESC;
-- Any non-zero row here is data the migration deletes with no way back.
-- essays.title/content_json is the sharpest edge: the migration creates
-- essay_revisions EMPTY and then drops essays.title/content_json/content_text.
-- It never copies the content across. Non-zero essays => STOP and migrate that
-- content into essay_revisions first.

\echo '=== 3b. The SECOND landmine, in the migration right after noisy_medusa ==='
SELECT count(*) AS schedule_breaks_with_null_creator
FROM schedule_breaks
WHERE created_by IS NOT NULL IS NOT TRUE;
-- 20260719161010_fix_rename_casts.sql:87 runs
--   alter table schedule_breaks alter column created_by_profile_id set not null
-- and noisy_medusa only RENAMES the nullable created_by into it -- it never
-- backfills. Any count > 0 here means that migration is the next 23502 after
-- noisy_medusa is fixed. The repair script backfills this too.

\echo '=== 4. Rows that will be attributed to the fallback actor ==='
SELECT 'rooms (no source column)' AS backfill, count(*) AS rows
  FROM rooms
UNION ALL SELECT 'recurring_schedules (created_by IS NULL)', count(*)
  FROM recurring_schedules WHERE created_by IS NULL
UNION ALL SELECT 'reservations (user_id IS NULL)', count(*)
  FROM reservations WHERE user_id IS NULL
UNION ALL SELECT 'schedule_breaks (created_by IS NULL)', count(*)
  FROM schedule_breaks WHERE created_by IS NULL;

\echo '=== 5. Which profile becomes the fallback actor ==='
SELECT id, role, created_at
FROM profiles
ORDER BY (role = 'admin') DESC, created_at
LIMIT 1;

\echo '=== 6. recurring_schedules rows -> schedule_type = training_session ==='
SELECT count(*) AS total, count(*) FILTER (WHERE team_id IS NULL) AS null_team_id
FROM recurring_schedules;
-- null_team_id MUST be 0, otherwise the recurring_schedules_team_for_ts CHECK
-- fails once every row is backfilled to 'training_session'.
