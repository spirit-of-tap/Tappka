-- Migration: Allow verified users to view all profiles
-- Purpose: Changes the profiles RLS SELECT policy so that users with a verified school email can view all profiles
-- Affected tables: profiles
-- Special considerations: Only users who have confirmed their work email (school account) can view the community

-- Drop the old restrictive policy that only allows users to see their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create a new policy that allows users with verified school accounts to view all active profiles
-- A user is considered "verified" when they have a verified_work_email in the users table
-- This is needed for the community/people listing page (komunita/lide)
CREATE POLICY "Verified users can view all profiles" ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Only show profiles that haven't been removed
  removed_access IS NULL
  -- And only to users who have verified their school email
  AND EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
  )
);
