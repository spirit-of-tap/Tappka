
In `@supabase/migrations/20260131000000_initial_schema.sql` around lines 88 - 127,
The INSERT in function public.handle_new_auth_user can raise duplicate-key
errors; modify the INSERT into public.users (performed in handle_new_auth_user)
to include an ON CONFLICT clause targeting the unique key(s) (at minimum
auth_user_id, and optionally google_email) and handle conflicts by either DO
NOTHING or DO UPDATE to upsert the profile fields; for example, use ON CONFLICT
(auth_user_id) DO UPDATE SET google_email = COALESCE(EXCLUDED.google_email,
public.users.google_email), google_full_name =
COALESCE(EXCLUDED.google_full_name, public.users.google_full_name),
google_profile_picture = COALESCE(EXCLUDED.google_profile_picture,
public.users.google_profile_picture) so the trigger is idempotent and avoids
duplicate-key failures.

---