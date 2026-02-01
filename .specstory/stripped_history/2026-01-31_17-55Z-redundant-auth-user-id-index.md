
supabase/migrations/20260131000000_initial_schema.sql (1)
263-270: Consider removing redundant index on auth_user_id.

Line 269 creates users_auth_user_id_idx, but auth_user_id already has a UNIQUE constraint (Line 21) which automatically creates an index in PostgreSQL. This index is redundant.



---