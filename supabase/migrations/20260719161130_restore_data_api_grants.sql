-- Restore Data API table privileges stripped from the postgres-owned public schema.
--
-- Symptom: PostgREST returns 42501 "permission denied for table profiles"
--   with hint GRANT SELECT ON public.profiles TO authenticated.
--
-- Cause: migrations run as role `postgres`. That role's default privileges in
--   public only granted TRUNCATE/REFERENCES/TRIGGER/MAINTAIN (Dxtm) to
--   anon/authenticated/service_role — not SELECT/INSERT/UPDATE/DELETE.
--   Every table created or owned by postgres therefore had no Data API access.
--   RLS still controls row visibility; these grants only expose the tables.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables
  to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant usage, select on sequences
  to anon, authenticated, service_role;
