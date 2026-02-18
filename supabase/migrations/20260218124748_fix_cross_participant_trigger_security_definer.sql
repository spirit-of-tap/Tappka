-- ============================================================================
-- Migration: fix_cross_participant_trigger_security_definer
-- Created: 2026-02-18
-- 
-- Purpose: Fix trigger function to use SECURITY DEFINER
-- 
-- Problem: The trigger function runs with the invoking user's privileges.
-- The `FOR UPDATE` lock requires UPDATE privileges on training_sessions,
-- but RLS policies restrict UPDATE to team members only. This caused
-- "Training session not found" errors for non-team members trying to cross.
--
-- Solution: Use SECURITY DEFINER so the function runs with owner privileges,
-- bypassing RLS for the slot availability check and lock acquisition.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_cross_participant_slot_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER  -- Run with owner privileges to bypass RLS for the lock
SET search_path = public  -- Security best practice for SECURITY DEFINER functions
AS $function$
DECLARE
  v_slots_available INTEGER;
  v_current_count   INTEGER;
BEGIN
  -- Lock the parent session row to serialize concurrent inserts
  SELECT cross_slots_available INTO v_slots_available
    FROM training_sessions 
    WHERE id = NEW.training_session_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Training session not found';
  END IF;

  -- Count current participants
  SELECT COUNT(*) INTO v_current_count
    FROM training_session_cross_participants
    WHERE training_session_id = NEW.training_session_id;

  -- Check if slots are full
  IF v_current_count >= v_slots_available THEN
    RAISE EXCEPTION 'cross_slots_full'
      USING DETAIL = 'Všechna cross místa jsou obsazena', ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;
