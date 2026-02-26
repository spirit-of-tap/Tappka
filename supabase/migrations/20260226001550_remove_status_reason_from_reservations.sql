-- Remove deprecated reservations.status and reservations.reason columns.
-- Rebuild dependent constraints, indexes, and RLS policies.

drop policy if exists "Authenticated can read active reservations" on public.reservations;
drop policy if exists "Authenticated can read reservations" on public.reservations;
drop policy if exists "Users can join cowork" on public.cowork_participants;

alter table public.reservations
  drop constraint if exists no_overlap;

drop index if exists public.idx_reservations_room_time;
drop index if exists public.idx_reservations_user;
drop index if exists public.idx_reservations_team;
drop index if exists public.idx_reservations_type;
drop index if exists public.idx_reservations_start;

alter table public.reservations
  drop column if exists reason,
  drop column if exists status;

alter table public.reservations
  add constraint no_overlap
  exclude using gist (
    room_id with =,
    tstzrange(start_time, end_time) with &&
  );

create index idx_reservations_room_time
  on public.reservations using btree (room_id, start_time, end_time);

create index idx_reservations_user
  on public.reservations using btree (user_id);

create index idx_reservations_team
  on public.reservations using btree (team_id);

create index idx_reservations_type
  on public.reservations using btree (reservation_type);

create index idx_reservations_start
  on public.reservations using btree (start_time);

create policy "Authenticated can read reservations"
  on public.reservations
  for select
  to authenticated
  using (true);

create policy "Users can join cowork"
  on public.cowork_participants
  for insert
  to authenticated
  with check (
    user_id in (
      select profiles.id
      from public.profiles
      where profiles.user_id in (
        select users.id
        from public.users
        where users.auth_user_id = (select auth.uid())
      )
    )
    and exists (
      select 1
      from public.reservations
      where reservations.id = reservation_id
        and reservations.is_cowork_open = true
    )
  );
