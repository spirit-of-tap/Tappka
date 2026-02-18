-- ============================================================================
-- Migration: enable_realtime_for_training_sessions
-- Created: 2026-02-18
-- 
-- Purpose: Enable Supabase Realtime for training session tables
-- 
-- This allows clients to subscribe to changes via Supabase Realtime,
-- enabling live updates when cross participants join/leave sessions.
-- ============================================================================

-- Add tables to the supabase_realtime publication
-- Using conditional logic to avoid errors if already added

DO $$
BEGIN
  -- Check if training_sessions is already in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'training_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE training_sessions;
  END IF;
  
  -- Check if training_session_cross_participants is already in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'training_session_cross_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE training_session_cross_participants;
  END IF;
END $$;

-- Set REPLICA IDENTITY FULL for cross_participants table
-- This ensures DELETE events include the full row data (not just primary key)
-- which allows clients to identify which participant was removed
ALTER TABLE training_session_cross_participants REPLICA IDENTITY FULL;
