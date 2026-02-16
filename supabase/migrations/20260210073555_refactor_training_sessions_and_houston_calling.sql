-- Migration: Refactor Training Sessions and Houston Calling
-- Purpose: Creates dedicated tables for Training Sessions and Houston Calling events
--          that link to reservations, replacing the previous embedded approach
-- Affected tables: training_sessions, training_session_facilitators, 
--                  training_session_cross_participants, houston_calling_events

-- ============================================
-- TRAINING SESSIONS TABLE
-- ============================================

-- Main training sessions table - links to a reservation
CREATE TABLE training_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    cross_slots_available INTEGER NOT NULL DEFAULT 0 
        CHECK (cross_slots_available >= 0 AND cross_slots_available <= 3),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_training_sessions_reservation_id ON training_sessions(reservation_id);
CREATE INDEX idx_training_sessions_team_id ON training_sessions(team_id);

-- Updated_at trigger
CREATE TRIGGER update_training_sessions_updated_at
    BEFORE UPDATE ON training_sessions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TRAINING SESSION FACILITATORS TABLE
-- ============================================

-- Junction table for facilitators (students who run the TS)
CREATE TABLE training_session_facilitators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(training_session_id, user_id)
);

-- Indexes
CREATE INDEX idx_ts_facilitators_training_session_id ON training_session_facilitators(training_session_id);
CREATE INDEX idx_ts_facilitators_user_id ON training_session_facilitators(user_id);

-- Enable RLS
ALTER TABLE training_session_facilitators ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TRAINING SESSION CROSS PARTICIPANTS TABLE
-- ============================================

-- Junction table for cross participants (students from other teams)
CREATE TABLE training_session_cross_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(training_session_id, user_id)
);

-- Indexes
CREATE INDEX idx_ts_cross_participants_training_session_id ON training_session_cross_participants(training_session_id);
CREATE INDEX idx_ts_cross_participants_user_id ON training_session_cross_participants(user_id);

-- Enable RLS
ALTER TABLE training_session_cross_participants ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HOUSTON CALLING EVENTS TABLE
-- ============================================

-- Houston Calling events table - links to a reservation
CREATE TABLE houston_calling_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_houston_calling_events_reservation_id ON houston_calling_events(reservation_id);
CREATE INDEX idx_houston_calling_events_team_id ON houston_calling_events(team_id);

-- Updated_at trigger
CREATE TRIGGER update_houston_calling_events_updated_at
    BEFORE UPDATE ON houston_calling_events
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE houston_calling_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- BASIC RLS POLICIES (will be refined in subsequent migrations)
-- ============================================

-- Training Sessions - Anyone can view
CREATE POLICY "Anyone can view training sessions" ON training_sessions
    FOR SELECT TO authenticated
    USING (true);

-- Training Session Facilitators - Anyone can view
CREATE POLICY "Anyone can view facilitators" ON training_session_facilitators
    FOR SELECT TO authenticated
    USING (true);

-- Training Session Cross Participants - Anyone can view
CREATE POLICY "Anyone can view cross participants" ON training_session_cross_participants
    FOR SELECT TO authenticated
    USING (true);

-- Houston Calling Events - Anyone can view
CREATE POLICY "Anyone can view houston calling events" ON houston_calling_events
    FOR SELECT TO authenticated
    USING (true);
