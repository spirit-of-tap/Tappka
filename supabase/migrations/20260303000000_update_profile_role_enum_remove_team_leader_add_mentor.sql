-- Replace team_leader with mentor in profile_role enum
-- Mentor has student-level permissions (no elevated access)

-- Step 1: Remove column default so enum type is not referenced by default
alter table public.profiles
  alter column role drop default;

-- Step 2: Drop policies that cast to the enum type
drop policy if exists "Coaches can manage recurring_schedules" on public.recurring_schedules;
drop policy if exists "Coaches can manage TS reservations" on public.reservations;
drop policy if exists "Coaches can resolve issues" on public.room_issues;
drop policy if exists "Admins can manage rooms" on public.rooms;
drop policy if exists "Coaches can manage schedule_breaks" on public.schedule_breaks;

-- Step 3: Change column to text
alter table public.profiles
  alter column role type text;

-- Step 4: Migrate any existing team_leader rows to student (safety net)
update public.profiles set role = 'student' where role = 'team_leader';

-- Step 5: Drop old enum (cascade removes any remaining dependents)
drop type public.profile_role cascade;

-- Step 6: Create new enum
create type public.profile_role as enum ('student', 'mentor', 'coach', 'admin');

-- Step 7: Restore column with new enum and default
alter table public.profiles
  alter column role type public.profile_role
  using role::public.profile_role;

alter table public.profiles
  alter column role set default 'student'::public.profile_role;

-- Step 8: Restore RLS policies (mentor is not elevated — same as student)
create policy "Coaches can manage recurring_schedules"
  on public.recurring_schedules
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.user_id in (
        select users.id from public.users
        where users.auth_user_id = (select auth.uid())
      )
      and profiles.role = any(array['coach'::public.profile_role, 'admin'::public.profile_role])
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.user_id in (
        select users.id from public.users
        where users.auth_user_id = (select auth.uid())
      )
      and profiles.role = any(array['coach'::public.profile_role, 'admin'::public.profile_role])
    )
  );

create policy "Coaches can manage TS reservations"
  on public.reservations
  for all
  to authenticated
  using (
    (reservation_type = any(array['training_session'::reservation_type, 'houston_calling'::reservation_type]))
    and exists (
      select 1 from public.profiles
      where profiles.user_id in (
        select users.id from public.users
        where users.auth_user_id = (select auth.uid())
      )
      and profiles.role = any(array['coach'::public.profile_role, 'admin'::public.profile_role])
    )
  )
  with check (
    (reservation_type = any(array['training_session'::reservation_type, 'houston_calling'::reservation_type]))
    and exists (
      select 1 from public.profiles
      where profiles.user_id in (
        select users.id from public.users
        where users.auth_user_id = (select auth.uid())
      )
      and profiles.role = any(array['coach'::public.profile_role, 'admin'::public.profile_role])
    )
  );

create policy "Coaches can resolve issues"
  on public.room_issues
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.user_id in (
        select users.id from public.users
        where users.auth_user_id = (select auth.uid())
      )
      and profiles.role = any(array['coach'::public.profile_role, 'admin'::public.profile_role])
    )
  );

create policy "Admins can manage rooms"
  on public.rooms
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.user_id in (
        select users.id from public.users
        where users.auth_user_id = (select auth.uid())
      )
      and profiles.role = 'admin'::public.profile_role
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.user_id in (
        select users.id from public.users
        where users.auth_user_id = (select auth.uid())
      )
      and profiles.role = 'admin'::public.profile_role
    )
  );

create policy "Coaches can manage schedule_breaks"
  on public.schedule_breaks
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.user_id in (
        select users.id from public.users
        where users.auth_user_id = (select auth.uid())
      )
      and profiles.role = any(array['coach'::public.profile_role, 'admin'::public.profile_role])
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.user_id in (
        select users.id from public.users
        where users.auth_user_id = (select auth.uid())
      )
      and profiles.role = any(array['coach'::public.profile_role, 'admin'::public.profile_role])
    )
  );
