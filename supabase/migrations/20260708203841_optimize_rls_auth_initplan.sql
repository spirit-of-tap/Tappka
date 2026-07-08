-- Custom SQL migration file, put your code below! --

-- Optimize RLS policies flagged by the Supabase linter
-- (0003_auth_rls_initplan): auth.uid() was re-evaluated per row. Wrapping it
-- in (select auth.uid()) lets Postgres evaluate it once per statement.
--
-- Each policy below is recreated from its exact live definition (dumped from
-- pg_policies); the ONLY change is auth.uid() -> (select auth.uid()). All
-- other logic is byte-for-byte identical, so access semantics are unchanged.

-- reservations: Users can create own reservations (INSERT)
DROP POLICY "Users can create own reservations" ON public.reservations;
CREATE POLICY "Users can create own reservations" ON public.reservations
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id IN ( SELECT profiles.id FROM profiles
      WHERE (profiles.user_id IN ( SELECT users.id FROM users
        WHERE (users.auth_user_id = (select auth.uid()))))))
    AND (reservation_type = 'personal'::reservation_type)
  );

-- reservations: Users can update own reservations (UPDATE)
DROP POLICY "Users can update own reservations" ON public.reservations;
CREATE POLICY "Users can update own reservations" ON public.reservations
  FOR UPDATE TO authenticated
  USING (
    user_id IN ( SELECT profiles.id FROM profiles
      WHERE (profiles.user_id IN ( SELECT users.id FROM users
        WHERE (users.auth_user_id = (select auth.uid())))))
  )
  WITH CHECK (
    user_id IN ( SELECT profiles.id FROM profiles
      WHERE (profiles.user_id IN ( SELECT users.id FROM users
        WHERE (users.auth_user_id = (select auth.uid())))))
  );

-- cowork_participants: Users can leave cowork (DELETE)
DROP POLICY "Users can leave cowork" ON public.cowork_participants;
CREATE POLICY "Users can leave cowork" ON public.cowork_participants
  FOR DELETE TO authenticated
  USING (
    user_id IN ( SELECT profiles.id FROM profiles
      WHERE (profiles.user_id IN ( SELECT users.id FROM users
        WHERE (users.auth_user_id = (select auth.uid())))))
  );

-- room_issues: Users can report issues (INSERT)
DROP POLICY "Users can report issues" ON public.room_issues;
CREATE POLICY "Users can report issues" ON public.room_issues
  FOR INSERT TO authenticated
  WITH CHECK (
    reported_by IN ( SELECT profiles.id FROM profiles
      WHERE (profiles.user_id IN ( SELECT users.id FROM users
        WHERE (users.auth_user_id = (select auth.uid())))))
  );

-- room_issues: Users can update own issues (UPDATE)
DROP POLICY "Users can update own issues" ON public.room_issues;
CREATE POLICY "Users can update own issues" ON public.room_issues
  FOR UPDATE TO authenticated
  USING (
    (reported_by IN ( SELECT profiles.id FROM profiles
      WHERE (profiles.user_id IN ( SELECT users.id FROM users
        WHERE (users.auth_user_id = (select auth.uid()))))))
    AND (status = 'open'::issue_status)
  )
  WITH CHECK (
    reported_by IN ( SELECT profiles.id FROM profiles
      WHERE (profiles.user_id IN ( SELECT users.id FROM users
        WHERE (users.auth_user_id = (select auth.uid())))))
  );

-- profiles: Users can update their own profile picture (UPDATE)
DROP POLICY "Users can update their own profile picture" ON public.profiles;
CREATE POLICY "Users can update their own profile picture" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    user_id IN ( SELECT users.id FROM users
      WHERE (users.auth_user_id = (select auth.uid())))
  )
  WITH CHECK (
    user_id IN ( SELECT users.id FROM users
      WHERE (users.auth_user_id = (select auth.uid())))
  );
