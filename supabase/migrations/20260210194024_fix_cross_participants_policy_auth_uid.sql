-- Migration: Fix Cross Participants Policy - Auth UID Pattern
-- Purpose: Refine the cross participants insert policy to use uid() function
-- Affected tables: training_session_cross_participants

-- Drop and recreate with optimized pattern
DROP POLICY IF EXISTS "Users can add themselves as cross participants" ON training_session_cross_participants;

CREATE POLICY "Users can add themselves as cross participants" ON training_session_cross_participants
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id IN (
            SELECT p.id
            FROM profiles p
            JOIN users u ON p.user_id = u.id
            WHERE u.auth_user_id = uid()
        )
    );
