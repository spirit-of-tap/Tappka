-- Migration: Fix profiles view policy for community
-- Purpose: Replaces the profiles SELECT policy to use optimized uid() function pattern
-- Affected tables: profiles
-- Special considerations: Uses (SELECT uid() AS uid) pattern for better RLS performance

-- Drop existing policy (may have different name from previous migration)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Verified users can view all profiles" ON public.profiles;

-- Create optimized policy that allows users with verified school accounts to view all active profiles
-- Uses (SELECT uid()) pattern to prevent InitPlan issues in nested subqueries
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
