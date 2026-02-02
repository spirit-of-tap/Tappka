
supabase/migrations/20260131161556_link_users_to_profiles.sql-43-46 (1)
43-46: ⚠️ Potential issue | 🟡 Minor

Email normalization mismatch could prevent profile linking.

The trigger normalizes v_auth_email with lower(trim(...)) but compares against profiles.work_email directly. If work_email values are stored without normalization (e.g., with uppercase letters or whitespace), matches will fail silently.

Consider normalizing work_email in the comparison:

  update public.profiles
  set user_id = v_user_id
- where work_email = lower(trim(v_auth_email))
+ where lower(trim(work_email)) = lower(trim(v_auth_email))
    and (user_id is null or user_id = v_user_id);
Alternatively, ensure work_email is always stored normalized via a CHECK constraint or BEFORE INSERT/UPDATE trigger on profiles.

---