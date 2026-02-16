-- Migration: Add Training Session Prep File
-- Purpose: Add columns for storing preparation file (Příprava) information
-- Affected tables: training_sessions

-- Add prep_file_key column (B2 storage key)
ALTER TABLE training_sessions
ADD COLUMN prep_file_key TEXT;

-- Add prep_file_name column (original filename for display)
ALTER TABLE training_sessions
ADD COLUMN prep_file_name TEXT;

-- Add comments
COMMENT ON COLUMN training_sessions.prep_file_key IS 'B2 storage key for the preparation file (Příprava)';
COMMENT ON COLUMN training_sessions.prep_file_name IS 'Original filename of the preparation file for display purposes';
