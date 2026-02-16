-- Migration: Fix Cross Participants Policy - Via Profiles Join
-- Purpose: Add policy for users to remove themselves as cross participants
-- Affected tables: training_session_cross_participants

-- Users can remove themselves as cross participants
CREATE POLICY "Users can remove themselves as cross participants" ON training_session_cross_participants
    FOR DELETE TO authenticated
    USING (
        user_id IN (
            SELECT p.id
            FROM profiles p
            JOIN users u ON p.user_id = u.id
            WHERE u.auth_user_id = uid()
        )
    );
