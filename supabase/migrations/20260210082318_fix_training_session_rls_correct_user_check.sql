-- Migration: Fix Training Session RLS - Correct User Check
-- Purpose: Fix the auth.uid() check pattern in training session policies
-- Note: This migration exists as a historical fix; policies were corrected in-place
-- The policies from previous migration already use the correct pattern
-- This file documents that a fix was applied

-- No changes needed - previous migration already has correct pattern
SELECT 1;
