-- Migration: Fix Facilitators RLS Policy
-- Purpose: Add policy for team members to manage facilitators for their team's training sessions
-- Affected tables: training_session_facilitators

-- Team members can manage facilitators for their team's training sessions
CREATE POLICY "Team members can manage facilitators for their team's training " ON training_session_facilitators
    FOR ALL TO authenticated
    USING (
        training_session_id IN (
            SELECT ts.id
            FROM training_sessions ts
            WHERE ts.team_id IN (
                SELECT profiles.team_id
                FROM profiles
                WHERE profiles.user_id IN (
                    SELECT users.id
                    FROM users
                    WHERE users.auth_user_id = uid()
                )
            )
        )
    );
