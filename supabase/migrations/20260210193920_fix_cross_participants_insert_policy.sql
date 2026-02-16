-- Migration: Fix Cross Participants Insert Policy
-- Purpose: Add policy for users to add themselves as cross participants
-- Affected tables: training_session_cross_participants

-- Users can add themselves as cross participants
-- Note: Uses auth.uid() pattern for initial implementation
CREATE POLICY "Users can add themselves as cross participants" ON training_session_cross_participants
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id IN (
            SELECT id FROM profiles 
            WHERE user_id IN (
                SELECT id FROM public.users 
                WHERE auth_user_id = auth.uid()
            )
        )
    );
