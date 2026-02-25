-- Fix the DELETE policy to use (select auth.uid()) for performance
-- per AGENTS.md: use (select auth.uid()) not bare auth.uid() in RLS policies

drop policy if exists "Users can delete own reservations" on public.reservations;

create policy "Users can delete own reservations"
  on public.reservations
  for delete
  to authenticated
  using (
    user_id in (
      select profiles.id
      from public.profiles
      where profiles.user_id in (
        select users.id
        from public.users
        where users.auth_user_id = (select auth.uid())
      )
    )
  );
