-- Fix: Set search_path for validate_picture_only_update function to address security warning

CREATE OR REPLACE FUNCTION public.validate_picture_only_update()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip validation for service_role and admin operations (FK cascades, admin updates)
  -- Check both the role and JWT claim for service_role
  IF current_setting('role', true) IN ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin') THEN
    RETURN NEW;
  END IF;
  
  -- Also check JWT claim for service_role (used by Supabase client with service key)
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Allow user_id changes (profile linking or FK cascade on user deletion)
  -- This is safe because:
  --   - Setting user_id is done by SECURITY DEFINER trigger (link_user_to_profile)
  --   - Clearing user_id is done by FK cascade (ON DELETE SET NULL)
  -- Neither can be triggered directly by authenticated users
  IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    -- Ensure ONLY user_id is changing (plus auto-updated fields like updated_at and picture)
    IF (
      OLD.id IS NOT DISTINCT FROM NEW.id AND
      OLD.name IS NOT DISTINCT FROM NEW.name AND
      OLD.work_email IS NOT DISTINCT FROM NEW.work_email AND
      OLD.role IS NOT DISTINCT FROM NEW.role AND
      OLD.team_id IS NOT DISTINCT FROM NEW.team_id AND
      OLD.phone_number IS NOT DISTINCT FROM NEW.phone_number AND
      OLD.personal_email IS NOT DISTINCT FROM NEW.personal_email AND
      OLD.date_of_birth IS NOT DISTINCT FROM NEW.date_of_birth AND
      OLD.removed_access IS NOT DISTINCT FROM NEW.removed_access AND
      OLD.removed_access_by IS NOT DISTINCT FROM NEW.removed_access_by AND
      OLD.created_at IS NOT DISTINCT FROM NEW.created_at
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- For regular authenticated user updates, only allow picture column changes
  -- Check if any protected column is being modified
  IF (
    OLD.id IS DISTINCT FROM NEW.id OR
    OLD.name IS DISTINCT FROM NEW.name OR
    OLD.user_id IS DISTINCT FROM NEW.user_id OR
    OLD.work_email IS DISTINCT FROM NEW.work_email OR
    OLD.role IS DISTINCT FROM NEW.role OR
    OLD.team_id IS DISTINCT FROM NEW.team_id OR
    OLD.phone_number IS DISTINCT FROM NEW.phone_number OR
    OLD.personal_email IS DISTINCT FROM NEW.personal_email OR
    OLD.date_of_birth IS DISTINCT FROM NEW.date_of_birth OR
    OLD.removed_access IS DISTINCT FROM NEW.removed_access OR
    OLD.removed_access_by IS DISTINCT FROM NEW.removed_access_by OR
    OLD.created_at IS DISTINCT FROM NEW.created_at
  ) THEN
    RAISE EXCEPTION 'Only picture column can be updated by users';
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_picture_only_update() IS 'Trigger function that restricts profile updates to picture column only for regular users. Allows service_role operations (admin), FK cascades (user deletion), and profile linking (user_id changes via SECURITY DEFINER triggers).';
