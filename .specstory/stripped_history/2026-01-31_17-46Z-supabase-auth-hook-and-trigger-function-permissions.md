
In `@supabase/migrations/20260131000000_initial_schema.sql` around lines 348 -
354, Remove the unnecessary EXECUTE grants for trigger functions and fix the
Supabase Auth hook permissions: revoke or delete the lines granting EXECUTE on
public.handle_new_auth_user() and public.validate_czu_email_domain_trigger() to
anon/authenticated (trigger functions are invoked by triggers, not directly),
and update public.before_user_created_hook(jsonb) so it GRANTS EXECUTE to
supabase_auth_admin and GRANTS USAGE on schema public to supabase_auth_admin,
then REVOKE EXECUTE on public.before_user_created_hook(jsonb) from anon,
authenticated, and public; use the function names handle_new_auth_user,
validate_czu_email_domain_trigger, and before_user_created_hook(jsonb) to locate
the statements to change.

---