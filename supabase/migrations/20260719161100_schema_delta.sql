ALTER TABLE "profiles" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER POLICY "Authors can update their own book comments" ON "book_comments" TO authenticated USING ((author_profile_id = current_profile_id())) WITH CHECK ((author_profile_id = current_profile_id()));--> statement-breakpoint
ALTER POLICY "Authenticated users can add book comments" ON "book_comments" TO authenticated WITH CHECK ((author_profile_id = current_profile_id()));--> statement-breakpoint
ALTER POLICY "Authenticated users can view book comments" ON "book_comments" TO authenticated USING (true);--> statement-breakpoint
ALTER POLICY "Authenticated users can view book tags" ON "book_tags" TO authenticated USING (true);--> statement-breakpoint
ALTER POLICY "Authenticated users can assign book tags" ON "book_tags" TO authenticated WITH CHECK ((created_by_profile_id = current_profile_id()));--> statement-breakpoint
ALTER POLICY "Coaches and admins can update book tags" ON "book_tags" TO authenticated USING (is_coach_or_admin()) WITH CHECK (is_coach_or_admin());--> statement-breakpoint
ALTER POLICY "Coaches and admins can update books" ON "books" TO authenticated USING (is_coach_or_admin()) WITH CHECK (is_coach_or_admin());--> statement-breakpoint
ALTER POLICY "Authenticated users can add books" ON "books" TO authenticated WITH CHECK ((created_by_profile_id = current_profile_id()));--> statement-breakpoint
ALTER POLICY "Authenticated users can view all books" ON "books" TO authenticated USING (true);--> statement-breakpoint
ALTER POLICY "Authenticated users can view tags" ON "tags" TO authenticated USING (true);--> statement-breakpoint
ALTER POLICY "Coaches and admins can update tags" ON "tags" TO authenticated USING (is_coach_or_admin()) WITH CHECK (is_coach_or_admin());--> statement-breakpoint
ALTER POLICY "Users can update their own dashboard layout" ON "dashboard_layouts" TO public USING ((profile_id = current_profile_id())) WITH CHECK ((profile_id = current_profile_id()));--> statement-breakpoint
ALTER POLICY "Users can insert their own dashboard layout" ON "dashboard_layouts" TO public WITH CHECK ((profile_id = current_profile_id()));--> statement-breakpoint
ALTER POLICY "Users can view their own dashboard layout" ON "dashboard_layouts" TO public USING ((profile_id = current_profile_id()));--> statement-breakpoint
ALTER POLICY "Coaches mark own reads within their team" ON "essay_coach_reads" TO authenticated WITH CHECK (((coach_profile_id = current_profile_id()) AND coach_can_review_essay(essay_id)));--> statement-breakpoint
ALTER POLICY "Coach sees own reads; author sees reads of own essays" ON "essay_coach_reads" TO authenticated USING (((coach_profile_id = current_profile_id()) OR (EXISTS ( SELECT 1
   FROM essays e
  WHERE ((e.id = essay_coach_reads.essay_id) AND (e.author_profile_id = current_profile_id()))))));--> statement-breakpoint
ALTER POLICY "Authors can update their own essay comments" ON "essay_comments" TO authenticated USING ((author_profile_id = current_profile_id())) WITH CHECK ((author_profile_id = current_profile_id()));--> statement-breakpoint
ALTER POLICY "Authenticated users can add essay comments" ON "essay_comments" TO authenticated WITH CHECK ((author_profile_id = current_profile_id()));--> statement-breakpoint
ALTER POLICY "Authenticated users can view essay comments" ON "essay_comments" TO authenticated USING (true);--> statement-breakpoint
ALTER POLICY "Authors see all viewers; others see own row" ON "essay_views" TO authenticated USING (((viewer_profile_id = current_profile_id()) OR (EXISTS ( SELECT 1
   FROM essays e
  WHERE ((e.id = essay_views.essay_id) AND (e.author_profile_id = current_profile_id()))))));--> statement-breakpoint
ALTER POLICY "Authenticated users can view votes" ON "essay_votes" TO authenticated USING (true);--> statement-breakpoint
ALTER POLICY "Users can remove own votes" ON "essay_votes" TO authenticated USING ((voter_profile_id = current_profile_id()));--> statement-breakpoint
ALTER POLICY "Authenticated users can view all essays" ON "essays" TO authenticated USING (true);--> statement-breakpoint
ALTER POLICY "Authors and admins can delete essays" ON "essays" TO authenticated USING (((author_profile_id = current_profile_id()) OR is_admin()));--> statement-breakpoint
ALTER POLICY "Authors can update their own essays" ON "essays" TO authenticated USING ((author_profile_id = current_profile_id())) WITH CHECK ((author_profile_id = current_profile_id()));--> statement-breakpoint
ALTER POLICY "Users can update their own profile picture" ON "profiles" TO authenticated USING ((user_id IN ( SELECT users.id
   FROM users
  WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((user_id IN ( SELECT users.id
   FROM users
  WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))));--> statement-breakpoint
ALTER POLICY "Users can insert their own user record" ON "users" TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = auth_user_id));--> statement-breakpoint
ALTER POLICY "Users can view their own user record" ON "users" TO authenticated USING ((( SELECT auth.uid() AS uid) = auth_user_id));--> statement-breakpoint
ALTER POLICY "Authenticated can read recurring_schedules" ON "recurring_schedules" TO authenticated USING (true);--> statement-breakpoint
ALTER POLICY "Authenticated can read reservations" ON "reservations" TO authenticated USING (true);--> statement-breakpoint
ALTER POLICY "Users can delete own reservations" ON "reservations" TO authenticated USING ((owner_profile_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))))));--> statement-breakpoint
ALTER POLICY "Users can update own reservations" ON "reservations" TO authenticated USING ((owner_profile_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid))))))) WITH CHECK ((owner_profile_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))))));--> statement-breakpoint
ALTER POLICY "Users can create own reservations" ON "reservations" TO authenticated WITH CHECK ((owner_profile_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))))));--> statement-breakpoint
ALTER POLICY "Authenticated can read rooms" ON "rooms" TO authenticated USING (true);--> statement-breakpoint
ALTER POLICY "Authenticated can read schedule_breaks" ON "schedule_breaks" TO authenticated USING (true);