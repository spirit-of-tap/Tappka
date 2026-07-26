#!/usr/bin/env bash
# Verifies scripts/repair/noisy-medusa-repair.sql against BOTH states production
# could be in after the failed deploy:
#
#   A) transactional runner (what the Supabase CLI does) -> nothing applied
#   B) autocommit runner                                 -> statements 1..122 applied
#
# Plus C) the repair run twice, to prove it is re-runnable.
set -euo pipefail

REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
CT=noisy-medusa-verify
PSQL="docker exec -i $CT psql -v ON_ERROR_STOP=1 -U postgres -d postgres"
PSQLQ="$PSQL -q"

cleanup() { docker rm -f "$CT" >/dev/null 2>&1 || true; }
trap cleanup EXIT

fail() { echo "!!! $1"; exit 1; }

boot() {
  cleanup
  docker run -d --name "$CT" -e POSTGRES_PASSWORD=postgres postgres:16 >/dev/null
  for _ in $(seq 1 60); do docker exec "$CT" pg_isready -U postgres -q && break; sleep 1; done
  $PSQLQ < "$REPO/tests/setup/bootstrap.sql" 2>/dev/null
  $PSQLQ <<'SQL'
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key, statements text[], name text);
SQL
  for f in "$REPO"/supabase/migrations/*.sql; do
    base=$(basename "$f"); ver=${base:0:14}
    [[ "$ver" > "20260713040708" ]] && continue
    $PSQLQ < "$f" >/dev/null 2>/tmp/nm_err || { cat /tmp/nm_err; fail "pre-migration $base"; }
    $PSQLQ -c "insert into supabase_migrations.schema_migrations(version,name) values ('$ver','$base') on conflict do nothing;" >/dev/null
  done
  $PSQLQ < /tmp/nm_seed.sql >/dev/null 2>/tmp/nm_err || { cat /tmp/nm_err; fail "seed"; }
}

cat > /tmp/nm_seed.sql <<'SQL'
alter table auth.users disable trigger user;
alter table users disable trigger user;
alter table profiles disable trigger user;
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@pef.czu.cz'),
  ('22222222-2222-2222-2222-222222222222', 'student@studenti.czu.cz');
insert into users (id, auth_user_id, google_email, verified_work_email, google_full_name, google_profile_picture) values
  ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','admin@gmail.com','admin@pef.czu.cz','Admin Person','https://example.test/a.png'),
  ('aaaaaaaa-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','student@gmail.com','student@studenti.czu.cz','Student Person','https://example.test/s.png');
insert into profiles (id, user_id, name, work_email, role) values
  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Admin','admin@pef.czu.cz','admin'),
  ('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000002','Student','student@studenti.czu.cz','student');
insert into teams (id, name) values ('cccccccc-0000-0000-0000-000000000001','Team A');
insert into rooms (id, code, name) values
  ('dddddddd-0000-0000-0000-000000000001','d126','D126'),
  ('dddddddd-0000-0000-0000-000000000002','d132','D132');
insert into recurring_schedules (id, room_id, team_id, created_by, day_of_week, start_time, end_time, valid_from, valid_until) values
  ('eeeeeeee-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001',1,'10:00','12:00','2026-01-01','2026-12-31'),
  ('eeeeeeee-0000-0000-0000-000000000002','dddddddd-0000-0000-0000-000000000002','cccccccc-0000-0000-0000-000000000001',null,3,'14:00','16:00','2026-01-01','2026-12-31');
insert into reservations (id, room_id, user_id, team_id, reservation_type, title, start_time, end_time, is_cowork_open) values
  ('ffffffff-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002',null,'personal','Study','2026-08-01 10:00+00','2026-08-01 11:00+00',true),
  ('ffffffff-0000-0000-0000-000000000002','dddddddd-0000-0000-0000-000000000002',null,'cccccccc-0000-0000-0000-000000000001','training_session','TS','2026-08-02 14:00+00','2026-08-02 16:00+00',false);
insert into schedule_breaks (id, break_type, name, start_date, end_date, created_by) values
  ('99999999-0000-0000-0000-000000000001','holiday','Vanoce','2026-12-23','2027-01-02',null);
alter table auth.users enable trigger user;
alter table users enable trigger user;
alter table profiles enable trigger user;
SQL

apply_tail() {
  for f in "$REPO"/supabase/migrations/*.sql; do
    base=$(basename "$f"); ver=${base:0:14}
    [[ "$ver" > "20260718212747" ]] || continue
    $PSQLQ < "$f" >/dev/null 2>/tmp/nm_err || { cat /tmp/nm_err; fail "post-migration $base"; }
    $PSQLQ -c "insert into supabase_migrations.schema_migrations(version,name) values ('$ver','$base') on conflict do nothing;" >/dev/null
  done
}

post_checks() {
  local label="$1"
  echo "--- post-checks ($label) ---"
  $PSQL -t -c "select case when count(*)=1 then 'PASS' else 'FAIL' end || ': profiles.access_removed_at exists' from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='access_removed_at';"
  $PSQL -t -c "select case when count(*)=0 then 'PASS' else 'FAIL' end || ': profiles.removed_access gone' from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='removed_access';"
  # profiles.* and teams.* creator columns are nullable by design (db/schema/profiles.ts:51,
  # db/schema/teams.ts:17 -- no .notNull()). Views always report nullable, so restrict to base tables.
  $PSQL -t -c "select case when count(*)=0 then 'PASS' else 'FAIL (' || count(*) || ' nullable: ' || string_agg(c.table_name||'.'||c.column_name, ', ') || ')' end || ': creator/schedule_type columns are NOT NULL where required' from information_schema.columns c join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name and t.table_type='BASE TABLE' where c.table_schema='public' and c.column_name in ('created_by_profile_id','updated_by_profile_id','schedule_type') and c.is_nullable='YES' and c.table_name not in ('profiles','teams');"
  $PSQL -t -c "select case when count(*)=2 then 'PASS' else 'FAIL' end || ': recurring_schedules backfilled to training_session' from recurring_schedules where schedule_type='training_session';"
  $PSQL -t -c "select case when count(*)=1 then 'PASS' else 'FAIL' end || ': schedule with created_by kept its author' from recurring_schedules where id='eeeeeeee-0000-0000-0000-000000000001' and created_by_profile_id='bbbbbbbb-0000-0000-0000-000000000001';"
  $PSQL -t -c "select case when count(*)=1 then 'PASS' else 'FAIL' end || ': schedule with NULL created_by got fallback admin' from recurring_schedules where id='eeeeeeee-0000-0000-0000-000000000002' and created_by_profile_id='bbbbbbbb-0000-0000-0000-000000000001';"
  $PSQL -t -c "select case when count(*)=1 then 'PASS' else 'FAIL' end || ': reservation kept its owner as creator' from reservations where id='ffffffff-0000-0000-0000-000000000001' and created_by_profile_id='bbbbbbbb-0000-0000-0000-000000000002';"
  $PSQL -t -c "select case when count(*)=1 then 'PASS' else 'FAIL' end || ': system reservation got fallback admin' from reservations where id='ffffffff-0000-0000-0000-000000000002' and created_by_profile_id='bbbbbbbb-0000-0000-0000-000000000001';"
  $PSQL -t -c "select case when count(*)=2 then 'PASS' else 'FAIL' end || ': rooms got fallback admin' from rooms where created_by_profile_id='bbbbbbbb-0000-0000-0000-000000000001';"
  $PSQL -t -c "select case when count(*)=1 then 'PASS' else 'FAIL' end || ': schedule_break creator backfilled' from schedule_breaks where created_by_profile_id is not null;"
  $PSQL -t -c "select case when count(*)=7 then 'PASS' else 'FAIL (' || count(*) || ')' end || ': all 7 migrations recorded as applied' from supabase_migrations.schema_migrations where version >= '20260718212747';"
  $PSQL -t -c "select case when count(*)=1 then 'PASS' else 'FAIL' end || ': books_with_essay_count view exists' from information_schema.views where table_schema='public' and table_name='books_with_essay_count';"
  $PSQL -t -c "select case when count(*)=0 then 'PASS' else 'FAIL' end || ': dropped tables are gone' from information_schema.tables where table_schema='public' and table_name in ('team_reading_lists','team_reading_list_books','cowork_participants','room_issues');"
  $PSQL -t -c "select case when count(*)=3 then 'PASS' else 'FAIL (' || count(*) || ')' end || ': new tables created (tags, book_tags, essay_revisions)' from information_schema.tables where table_schema='public' and table_name in ('tags','book_tags','essay_revisions');"
}

schema_fingerprint() {
  $PSQL -t -A -c "select string_agg(table_name||'.'||column_name||':'||data_type||':'||is_nullable, ',' order by table_name, column_name) from information_schema.columns where table_schema='public';"
}

echo "############ STATE A: transactional runner (Supabase CLI behaviour) ############"
boot
echo -n "control -- migration inside a transaction: "
if $PSQL --single-transaction < "$REPO/supabase/migrations/20260718212747_noisy_medusa.sql" >/dev/null 2>/tmp/nm_ctrl; then
  fail "migration succeeded; seed did not reproduce production"
fi
grep -oE 'ERROR:.*' /tmp/nm_ctrl | head -1
$PSQL -t -c "select case when count(*)=1 then 'confirmed: rename rolled back, profiles.removed_access still present (this is the 42703)' else 'unexpected' end from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='removed_access';"
echo -n "repair: "
$PSQL < "$REPO/scripts/repair/noisy-medusa-repair.sql" >/dev/null 2>/tmp/nm_rep || { cat /tmp/nm_rep; fail "repair failed in state A"; }
echo "OK"
apply_tail
post_checks "state A"
FP_A=$(schema_fingerprint)

echo
echo "############ STATE B: autocommit runner (partial apply) ############"
boot
echo -n "control -- migration statement-by-statement: "
if $PSQL < "$REPO/supabase/migrations/20260718212747_noisy_medusa.sql" >/dev/null 2>/tmp/nm_ctrl; then
  fail "migration succeeded; seed did not reproduce production"
fi
grep -oE 'ERROR:.*' /tmp/nm_ctrl | head -1
$PSQL -t -c "select case when count(*)=1 then 'confirmed: partial apply, rename already committed' else 'unexpected' end from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='access_removed_at';"
echo -n "repair: "
$PSQL < "$REPO/scripts/repair/noisy-medusa-repair.sql" >/dev/null 2>/tmp/nm_rep || { cat /tmp/nm_rep; fail "repair failed in state B"; }
echo "OK"
echo -n "repair again (idempotency): "
$PSQL < "$REPO/scripts/repair/noisy-medusa-repair.sql" >/dev/null 2>/tmp/nm_rep || { cat /tmp/nm_rep; fail "repair not re-runnable"; }
echo "OK"
apply_tail
post_checks "state B"
FP_B=$(schema_fingerprint)

echo
echo "############ CONVERGENCE ############"
if [[ "$FP_A" == "$FP_B" ]]; then
  echo "PASS: state A and state B converge on an identical public schema"
else
  echo "FAIL: schemas differ"
  diff <(tr ',' '\n' <<<"$FP_A") <(tr ',' '\n' <<<"$FP_B") | head -40
  exit 1
fi

echo
echo "############ STATE D: guard against unrecoverable data loss ############"
boot
$PSQLQ -c "insert into essays (id, author_profile_id, title, content_json) values ('77777777-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','My essay','{}'::jsonb);" >/dev/null \
  || fail "could not seed an essay"
echo -n "repair with 1 essay present (must ABORT): "
if $PSQL < "$REPO/scripts/repair/noisy-medusa-repair.sql" >/dev/null 2>/tmp/nm_guard; then
  fail "repair proceeded and destroyed essay content -- guard did not fire"
fi
grep -oE 'ABORTED:[^"]*' /tmp/nm_guard | head -1 | cut -c1-140
$PSQL -t -c "select case when count(*)=1 then 'PASS' else 'FAIL' end || ': essay content still intact after the abort' from essays where title='My essay';"

echo
echo "############ STATE C: clean install (what local/preview have) ############"
cleanup
docker run -d --name "$CT" -e POSTGRES_PASSWORD=postgres postgres:16 >/dev/null
for _ in $(seq 1 60); do docker exec "$CT" pg_isready -U postgres -q && break; sleep 1; done
$PSQLQ < "$REPO/tests/setup/bootstrap.sql" >/dev/null 2>&1
$PSQLQ <<'SQL' >/dev/null
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key, statements text[], name text);
SQL
# every migration, in order, against empty tables -- exactly the local/preview path
for f in "$REPO"/supabase/migrations/*.sql; do
  base=$(basename "$f")
  $PSQLQ < "$f" >/dev/null 2>/tmp/nm_err || { cat /tmp/nm_err; fail "clean install $base"; }
done
echo "all 52 migrations applied clean against empty tables (this is why CI/preview passed)"
FP_C=$(schema_fingerprint)

echo
echo "############ EQUIVALENCE: repaired production == clean install? ############"
if [[ "$FP_A" == "$FP_C" ]]; then
  echo "PASS: the repaired schema is byte-identical to a clean install of all 52 migrations"
else
  echo "FAIL: repaired schema differs from clean install"
  diff <(tr ',' '\n' <<<"$FP_C") <(tr ',' '\n' <<<"$FP_A") | head -60
  exit 1
fi
