-- Allow users to toggle their own beta_access column
CREATE OR REPLACE FUNCTION public.validate_picture_only_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_db_role text := current_setting('role', true);
  v_jwt_role text := current_setting('request.jwt.claim.role', true);
begin
  -- bypass restriction for trusted database/system sessions (sql editor, migrations, admin flows)
  if
    session_user in ('postgres', 'supabase_admin', 'supabase_auth_admin')
    or current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin')
    or v_db_role in ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin')
    or v_jwt_role = 'service_role'
  then
    return new;
  end if;

  -- allow user_id-only changes that are performed by trusted database workflows
  -- (for example profile linking or fk cascade to null)
  if old.user_id is distinct from new.user_id then
    if (
      old.id is not distinct from new.id
      and old.name is not distinct from new.name
      and old.work_email is not distinct from new.work_email
      and old.role is not distinct from new.role
      and old.team_id is not distinct from new.team_id
      and old.phone_number is not distinct from new.phone_number
      and old.personal_email is not distinct from new.personal_email
      and old.date_of_birth is not distinct from new.date_of_birth
      and old.beta_access is not distinct from new.beta_access
      and old.removed_access is not distinct from new.removed_access
      and old.removed_access_by is not distinct from new.removed_access_by
      and old.created_at is not distinct from new.created_at
    ) then
      return new;
    end if;
  end if;

  -- for regular users, block changes to every field except picture and beta_access (and updated_at handled elsewhere)
  if (
    old.id is distinct from new.id
    or old.name is distinct from new.name
    or old.user_id is distinct from new.user_id
    or old.work_email is distinct from new.work_email
    or old.role is distinct from new.role
    or old.team_id is distinct from new.team_id
    or old.phone_number is distinct from new.phone_number
    or old.personal_email is distinct from new.personal_email
    or old.date_of_birth is distinct from new.date_of_birth
    or old.removed_access is distinct from new.removed_access
    or old.removed_access_by is distinct from new.removed_access_by
    or old.created_at is distinct from new.created_at
  ) then
    raise exception 'Only picture and beta_access can be updated by users';
  end if;

  return new;
end;
$function$
;
