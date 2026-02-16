-- Migration: Fix Training Session RLS Policies
-- Purpose: Add INSERT/UPDATE/DELETE policies for training_sessions table
-- Affected tables: training_sessions

-- Team members can create training sessions for their team
CREATE POLICY "Team members can create training sessions for their team" ON training_sessions
    FOR INSERT TO authenticated
    WITH CHECK (
        team_id IN (
            SELECT profiles.team_id
            FROM profiles
            WHERE profiles.user_id IN (
                SELECT users.id
                FROM users
                WHERE users.auth_user_id = auth.uid()
            )
        )
    );

-- Team members can update their team's training sessions
CREATE POLICY "Team members can update their team's training sessions" ON training_sessions
    FOR UPDATE TO authenticated
    USING (
        team_id IN (
            SELECT profiles.team_id
            FROM profiles
            WHERE profiles.user_id IN (
                SELECT users.id
                FROM users
                WHERE users.auth_user_id = auth.uid()
            )
        )
    );

-- Team members can delete their team's training sessions
CREATE POLICY "Team members can delete their team's training sessions" ON training_sessions
    FOR DELETE TO authenticated
    USING (
        team_id IN (
            SELECT profiles.team_id
            FROM profiles
            WHERE profiles.user_id IN (
                SELECT users.id
                FROM users
                WHERE users.auth_user_id = auth.uid()
            )
        )
    );
