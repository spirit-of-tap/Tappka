-- Migration: Allow users to update ONLY their profile picture
-- This migration creates a secure system where users can update their own profile picture
-- but cannot modify any other profile fields (name, email, role, etc.)

-- Step 1: Drop any existing policies and functions from previous attempts
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile picture" ON public.profiles;
DROP FUNCTION IF EXISTS public.is_only_updating_picture();
DROP TRIGGER IF EXISTS enforce_picture_only_update ON public.profiles;
DROP FUNCTION IF EXISTS public.validate_picture_only_update();

-- Step 2: Create a trigger function that validates only picture column is updated
-- This function has access to OLD and NEW record values
CREATE OR REPLACE FUNCTION public.validate_picture_only_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if any column other than picture and updated_at is being modified
  -- Using IS DISTINCT FROM to handle NULL values properly
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create trigger that runs BEFORE update
-- This trigger will validate column changes before RLS policies are checked
CREATE TRIGGER enforce_picture_only_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_picture_only_update();

-- Step 4: Create RLS policy for updates
-- This policy ensures users can only update their own profile
-- The trigger (above) handles the column-level restriction
CREATE POLICY "Users can update their own profile picture"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- User must own the profile (via user_id -> users.auth_user_id)
  user_id IN (
    SELECT users.id
    FROM users
    WHERE users.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  -- Same check for the updated row
  user_id IN (
    SELECT users.id
    FROM users
    WHERE users.auth_user_id = auth.uid()
  )
);

-- Note: This approach uses both RLS and triggers for maximum security:
-- 1. RLS ensures users can only update their own profile
-- 2. Trigger ensures only the picture column (and auto-updated updated_at) can be modified
-- 3. Together they provide robust column-level security for user updates
