-- Migration: Fix RLS InitPlan performance
-- Purpose: Creates a uid() function in public schema that wraps auth.uid() for better RLS performance
-- Background: Using (SELECT auth.uid()) in RLS policies can cause InitPlan issues in nested subqueries.
--             Creating a stable function helps the planner optimize these queries.
-- Affected: All tables with RLS policies using auth.uid()

-- Create a stable function that wraps auth.uid()
-- This helps prevent repeated evaluation in complex RLS policies
CREATE OR REPLACE FUNCTION public.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT auth.uid()
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.uid() TO authenticated;

-- Add comment explaining the function's purpose
COMMENT ON FUNCTION public.uid() IS 'Wrapper around auth.uid() for better RLS performance. Use this in policies to prevent InitPlan issues.';
