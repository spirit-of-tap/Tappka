-- Drizzle cannot model Postgres EXCLUDE constraints; db/schema represents
-- no_overlap as a GiST index. Enforce the real exclusion constraint here.
-- Idempotent: the constraint (and its backing index) already exist from
-- earlier reservation migrations.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'no_overlap'
      and conrelid = 'public.reservations'::regclass
  ) then
    alter table public.reservations
      add constraint no_overlap
      exclude using gist (
        room_id with =,
        tstzrange(start_at, end_at) with &&
      );
  end if;
end $$;
