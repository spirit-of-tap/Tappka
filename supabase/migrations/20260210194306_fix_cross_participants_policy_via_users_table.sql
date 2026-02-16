-- Migration: Fix Cross Participants Policy - Via Users Table
-- Purpose: Add policy for team members to manage cross participants for their sessions
-- Affected tables: training_session_cross_participants

-- Team members can manage (delete) cross participants for their training sessions
CREATE POLICY "Team members can manage cross participants for their sessions" ON training_session_cross_participants
    FOR DELETE TO authenticated
    USING (
        training_session_id IN (
            SELECT ts.id
            FROM training_sessions ts
            JOIN profiles p ON p.id = uid()
            WHERE ts.team_id = p.team_id
        )
    );
