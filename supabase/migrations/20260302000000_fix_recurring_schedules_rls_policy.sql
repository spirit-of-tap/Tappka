-- Fix recurring_schedules RLS policy: use auth.uid() not bare uid()
-- The old policy used uid() (pgcrypto) which never matched the authenticated user

drop policy if exists "Coaches can manage recurring_schedules" on public.recurring_schedules;

create policy "Coaches can manage recurring_schedules" on public.recurring_schedules
    for all to authenticated
    using (exists (
        select 1 from public.profiles
        where profiles.id = (select auth.uid())
          and profiles.role in ('coach', 'admin')
    ))
    with check (exists (
        select 1 from public.profiles
        where profiles.id = (select auth.uid())
          and profiles.role in ('coach', 'admin')
    ));
