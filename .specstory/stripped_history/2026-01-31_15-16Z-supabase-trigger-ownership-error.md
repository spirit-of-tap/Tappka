
Fix

Problem summary
Error "ERROR: 42501: must be owner of relation users" means the role executing CREATE FUNCTION / CREATE TRIGGER does not own the target relation (public.users). In Postgres only the owner of a table (or a superuser) can create a trigger on it or create objects that implicitly require ownership checks.

You created a SECURITY DEFINER function in schema public that inserts into public.users and then attempted to create a trigger on auth.users. The failing statement is likely the CREATE TRIGGER on auth.users (or possibly the CREATE FUNCTION in public if ownership checks involve the target table). The DB is telling you the active role running the migration isn't owner of the relation "users" (public.users).

Why this happens on Supabase
Supabase's auth schema and many public objects are owned by different roles (e.g., supabase_admin / pg_database_owner / postgres). Your migration is likely running as a less-privileged role (the dashboard migration role or the project owner role that isn't table owner).
Creating a trigger on auth.users is allowed only to the owner of auth.users. Creating a trigger referencing a function in another schema may also require ownership or suitable privileges.
Fix options (pick one)
Run the migration as the owner (recommended for schema changes)
Connect and run the migration as the DB role that owns auth.users (likely supabase_admin or the original owner). On Supabase you can run SQL as the project owner using the SQL editor in the dashboard or using a service_role key that has permission to run DDL.
If you use the SQL editor in Supabase Dashboard it typically runs as the owner; try there.
Change ownership temporarily
Have the current owner (or an admin) run: ALTER TABLE public.users OWNER TO your_migration_role; -- run your migration ALTER TABLE public.users OWNER TO previous_owner; This requires admin access and is not recommended in production.
Create the trigger in the same schema as the table and ensure owner matches
Ensure the migration runs under the owner of auth.users if creating trigger on auth.users. For example, create the trigger function in the auth schema and then create trigger as the auth.users owner:
Create function auth.handle_new_auth_user() SECURITY DEFINER ...;
CREATE TRIGGER ... ON auth.users ... EXECUTE FUNCTION auth.handle_new_auth_user(); Note: moving the function into auth schema may be preferable because the owner of auth schema/tables will already be the owner. But you must ensure no security exposures; keep SECURITY DEFINER and revoke execute from anon/authenticated if appropriate.
Use a SECURITY DEFINER function owned by the table owner
Create the function as the owner of auth.users (or set its owner to that role). Only the owner can set an object owner. Example workflow:
As owner: CREATE FUNCTION auth.handle_new_auth_user() SECURITY DEFINER ...;
As owner: CREATE TRIGGER ... ON auth.users ...; This avoids the "must be owner" check.
Suggested minimal change (safe approach)
Move the function into the auth schema and run the migration as a privileged role (SQL editor). Example changes you'll need:
create function auth.handle_new_auth_user() ... (instead of public.handle_new_auth_user)
create trigger on auth.users AFTER INSERT ... execute function auth.handle_new_auth_user();
Keep SECURITY DEFINER on the function and, after creation, REVOKE EXECUTE FROM anon, authenticated if you don't want public to call it.
If you want, I can:

Provide the exact SQL adjusted to create the function in auth schema and with revokes (I will not run it; I'll generate it for you), or
Attempt to run a statement that checks ownership (who owns public.users and auth.users) so we confirm owners (I can run SQL now).


@supabase/migrations/20260131150159_create_user_on_auth_user_created.sql 

---

---


Still the same error. Use the suggested fixes

---

---


permission denied for auth. Use the other way

---