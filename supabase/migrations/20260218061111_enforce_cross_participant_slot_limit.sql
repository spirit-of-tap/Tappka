-- ============================================================================
-- Migration: enforce_cross_participant_slot_limit
-- Created: 2026-02-18
-- 
-- Purpose: Fix race condition in cross participant slot booking
-- 
-- Problem: The API route checks slot availability with a SELECT, then INSERTs.
-- Between those two queries, another request can slip in and both insert,
-- exceeding `cross_slots_available`.
--
-- Solution: This trigger moves the check into the same transaction as the insert,
-- with `SELECT ... FOR UPDATE` serializing concurrent requests for the same session.
-- This ensures atomic enforcement of the slot limit.
-- ============================================================================

CREATE OR REPLACE FUNCTION check_cross_participant_slot_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_slots_available INTEGER;
  v_current_count   INTEGER;
BEGIN
  SELECT cross_slots_available INTO v_slots_available
    FROM training_sessions WHERE id = NEW.training_session_id
    FOR UPDATE;           -- serializes concurrent inserts for this session

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Training session not found';
  END IF;

  SELECT COUNT(*) INTO v_current_count
    FROM training_session_cross_participants
   WHERE training_session_id = NEW.training_session_id;

  IF v_current_count >= v_slots_available THEN
    RAISE EXCEPTION 'cross_slots_full'
      USING DETAIL = 'Všechna cross místa jsou obsazena', ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END; $$;

-- Drop existing trigger if present (for idempotency)
DROP TRIGGER IF EXISTS enforce_cross_participant_slot_limit 
  ON training_session_cross_participants;

CREATE TRIGGER enforce_cross_participant_slot_limit
  BEFORE INSERT ON training_session_cross_participants
  FOR EACH ROW EXECUTE FUNCTION public.check_cross_participant_slot_limit();
