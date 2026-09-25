-- One person's time entries never overlap. A running timer (ended_at is null)
-- occupies [started_at, infinity), so nothing can be logged after its start
-- until it is stopped. Rule 1 of the TS attendance sync relies on this constraint.
-- Design: docs/plans/2026-09-24-timetracking-design.md §3
create extension if not exists btree_gist;

alter table public.time_entries
  drop constraint if exists time_entries_no_overlap;

alter table public.time_entries
  add constraint time_entries_no_overlap
  exclude using gist (
    profile_id with =,
    tstzrange(started_at, coalesce(ended_at, 'infinity'::timestamptz), '[)') with &&
  );
