-- Fix all RLS policies that incorrectly use profiles.id = auth.uid()
-- profiles.id is its own UUID; auth.uid() links via users.auth_user_id → users.id = profiles.user_id
-- Correct pattern: profiles.user_id IN (SELECT users.id FROM users WHERE users.auth_user_id = (SELECT auth.uid()))

-- recurring_schedules
drop policy if exists "Coaches can manage recurring_schedules" on public.recurring_schedules;
create policy "Coaches can manage recurring_schedules" on public.recurring_schedules
    for all to authenticated
    using (exists (
        select 1 from public.profiles
        where profiles.user_id in (
            select users.id from public.users where users.auth_user_id = (select auth.uid())
        )
        and profiles.role in ('coach', 'admin')
    ))
    with check (exists (
        select 1 from public.profiles
        where profiles.user_id in (
            select users.id from public.users where users.auth_user_id = (select auth.uid())
        )
        and profiles.role in ('coach', 'admin')
    ));

-- schedule_breaks
drop policy if exists "Coaches can manage schedule_breaks" on public.schedule_breaks;
create policy "Coaches can manage schedule_breaks" on public.schedule_breaks
    for all to authenticated
    using (exists (
        select 1 from public.profiles
        where profiles.user_id in (
            select users.id from public.users where users.auth_user_id = (select auth.uid())
        )
        and profiles.role in ('coach', 'admin')
    ))
    with check (exists (
        select 1 from public.profiles
        where profiles.user_id in (
            select users.id from public.users where users.auth_user_id = (select auth.uid())
        )
        and profiles.role in ('coach', 'admin')
    ));

-- reservations: Coaches can manage TS reservations
drop policy if exists "Coaches can manage TS reservations" on public.reservations;
create policy "Coaches can manage TS reservations" on public.reservations
    for all to authenticated
    using (
        reservation_type in ('training_session', 'houston_calling')
        and exists (
            select 1 from public.profiles
            where profiles.user_id in (
                select users.id from public.users where users.auth_user_id = (select auth.uid())
            )
            and profiles.role in ('coach', 'admin')
        )
    )
    with check (
        reservation_type in ('training_session', 'houston_calling')
        and exists (
            select 1 from public.profiles
            where profiles.user_id in (
                select users.id from public.users where users.auth_user_id = (select auth.uid())
            )
            and profiles.role in ('coach', 'admin')
        )
    );

-- room_issues: Coaches can resolve issues
drop policy if exists "Coaches can resolve issues" on public.room_issues;
create policy "Coaches can resolve issues" on public.room_issues
    for update to authenticated
    using (exists (
        select 1 from public.profiles
        where profiles.user_id in (
            select users.id from public.users where users.auth_user_id = (select auth.uid())
        )
        and profiles.role in ('coach', 'admin')
    ));

-- rooms: Admins can manage rooms
drop policy if exists "Admins can manage rooms" on public.rooms;
create policy "Admins can manage rooms" on public.rooms
    for all to authenticated
    using (exists (
        select 1 from public.profiles
        where profiles.user_id in (
            select users.id from public.users where users.auth_user_id = (select auth.uid())
        )
        and profiles.role = 'admin'
    ))
    with check (exists (
        select 1 from public.profiles
        where profiles.user_id in (
            select users.id from public.users where users.auth_user_id = (select auth.uid())
        )
        and profiles.role = 'admin'
    ));
