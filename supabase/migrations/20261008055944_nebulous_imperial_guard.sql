-- Custom SQL migration file, put your code below! --
-- Fix no_overlap to ignore soft-cancelled reservations.
-- Previously unconditional, so cancelled rows still blocked new bookings
-- (e.g. recurring-schedule PATCH cancels then re-inserts same slot).
alter table public.reservations drop constraint if exists no_overlap;
alter table public.reservations
  add constraint no_overlap
  exclude using gist (
    room_id with =,
    tstzrange(start_at, end_at) with &&
  ) where (cancelled_at is null);