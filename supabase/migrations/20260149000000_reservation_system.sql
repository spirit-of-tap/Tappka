-- Tappka Reservation System Migration
-- Creates tables for rooms, reservations, recurring schedules, cowork participants, room issues, and schedule breaks

-- ============================================
-- EXTENSIONS
-- ============================================

-- Required for EXCLUDE constraint (preventing overlapping reservations)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================
-- ENUM TYPES
-- ============================================

-- Reservation types
CREATE TYPE reservation_type AS ENUM ('personal', 'training_session', 'houston_calling');

-- Issue types for room problems
CREATE TYPE issue_type AS ENUM ('locked', 'mess', 'technical', 'other');
CREATE TYPE issue_status AS ENUM ('open', 'resolved');

-- Schedule break types (Days of Joy, holidays, etc.)
CREATE TYPE schedule_break_type AS ENUM ('days_of_joy', 'holiday', 'other');

-- ============================================
-- TABLES
-- ============================================

-- Rooms table
-- Stores all reservable rooms with their rules
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,          -- 'd126', 'd132', etc. (used in URLs)
    name TEXT NOT NULL,                  -- 'D126', 'Tichá místnost', etc.
    description TEXT,                    -- Optional description
    available_days INTEGER[],            -- NULL = all days, [3] = Wednesday only (0=Sun, 1=Mon, etc.)
    can_have_ts BOOLEAN NOT NULL DEFAULT true,  -- Can have Training Sessions?
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recurring schedules table
-- Stores recurring Training Session schedules set by coaches
CREATE TABLE recurring_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- Can be NULL if creator deleted
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sunday, 1=Monday, etc.
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    valid_from DATE NOT NULL,
    valid_until DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Ensure valid time range
    CONSTRAINT valid_time_range CHECK (end_time > start_time),
    -- Ensure valid date range
    CONSTRAINT valid_schedule_dates CHECK (valid_until >= valid_from)
);

-- Reservations table
-- Stores all reservations (personal, TS, and HC)
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- NULL for system reservations (HC)
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,      -- For TS reservations
    recurring_schedule_id UUID REFERENCES recurring_schedules(id) ON DELETE CASCADE,  -- Link to recurring schedule
    reservation_type reservation_type NOT NULL DEFAULT 'personal',
    title TEXT NOT NULL,
    reason TEXT,                         -- Required for personal reservations
    person_count INTEGER,                -- Required for personal reservations
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_cowork_open BOOLEAN NOT NULL DEFAULT false,  -- Allow others to join?
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Ensure valid time range
    CONSTRAINT valid_reservation_time CHECK (end_time > start_time),
    
    -- Prevent overlapping active reservations for the same room
    CONSTRAINT no_overlap EXCLUDE USING gist (
        room_id WITH =,
        tstzrange(start_time, end_time) WITH &&
    ) WHERE (status = 'active')
);

-- Cowork participants table
-- Stores users who joined open cowork reservations
CREATE TABLE cowork_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Each user can only join a reservation once
    UNIQUE(reservation_id, user_id)
);

-- Room issues table
-- Stores reported problems with rooms
CREATE TABLE room_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    reported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- Can be NULL if reporter deleted
    issue_type issue_type NOT NULL,
    description TEXT,
    status issue_status NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Schedule breaks table
-- Stores exceptions to TS schedule (Days of Joy, holidays, etc.)
CREATE TABLE schedule_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    break_type schedule_break_type NOT NULL,
    name TEXT NOT NULL,                  -- 'Days of Joy - Podzim 2026', 'Vánoční prázdniny', etc.
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- Can be NULL if creator deleted
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Ensure valid date range
    CONSTRAINT valid_break_date_range CHECK (end_date >= start_date)
);

-- ============================================
-- INDEXES
-- ============================================

-- Rooms
CREATE INDEX idx_rooms_code ON rooms(code);

-- Recurring schedules
CREATE INDEX idx_recurring_schedules_room ON recurring_schedules(room_id);
CREATE INDEX idx_recurring_schedules_team ON recurring_schedules(team_id);
CREATE INDEX idx_recurring_schedules_day ON recurring_schedules(day_of_week);
CREATE INDEX idx_recurring_schedules_valid ON recurring_schedules(valid_from, valid_until);

-- Reservations
CREATE INDEX idx_reservations_room_time ON reservations(room_id, start_time, end_time) WHERE status = 'active';
CREATE INDEX idx_reservations_user ON reservations(user_id) WHERE status = 'active';
CREATE INDEX idx_reservations_team ON reservations(team_id) WHERE status = 'active';
CREATE INDEX idx_reservations_type ON reservations(reservation_type) WHERE status = 'active';
CREATE INDEX idx_reservations_start ON reservations(start_time) WHERE status = 'active';
CREATE INDEX idx_reservations_recurring ON reservations(recurring_schedule_id);

-- Cowork participants
CREATE INDEX idx_cowork_reservation ON cowork_participants(reservation_id);
CREATE INDEX idx_cowork_user ON cowork_participants(user_id);

-- Room issues
CREATE INDEX idx_room_issues_room_status ON room_issues(room_id, status);
CREATE INDEX idx_room_issues_type ON room_issues(issue_type) WHERE status = 'open';

-- Schedule breaks
CREATE INDEX idx_schedule_breaks_dates ON schedule_breaks(start_date, end_date);
CREATE INDEX idx_schedule_breaks_type ON schedule_breaks(break_type);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at on reservations
CREATE TRIGGER update_reservations_updated_at
    BEFORE UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cowork_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_breaks ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- ROOMS POLICIES
-- ----------------------------------------

-- All authenticated users can read rooms
CREATE POLICY "Authenticated can read rooms" ON rooms
    FOR SELECT TO authenticated
    USING (true);

-- Only admins can manage rooms
CREATE POLICY "Admins can manage rooms" ON rooms
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ----------------------------------------
-- RECURRING SCHEDULES POLICIES
-- ----------------------------------------

-- All authenticated users can read schedules
CREATE POLICY "Authenticated can read recurring_schedules" ON recurring_schedules
    FOR SELECT TO authenticated
    USING (true);

-- Coaches and admins can manage schedules
CREATE POLICY "Coaches can manage recurring_schedules" ON recurring_schedules
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'admin')))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'admin')));

-- ----------------------------------------
-- RESERVATIONS POLICIES
-- ----------------------------------------

-- All authenticated users can read active reservations
CREATE POLICY "Authenticated can read active reservations" ON reservations
    FOR SELECT TO authenticated
    USING (status = 'active');

-- Users can create their own personal reservations
CREATE POLICY "Users can create own reservations" ON reservations
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id IN (
            SELECT id FROM profiles 
            WHERE user_id IN (
                SELECT id FROM public.users 
                WHERE auth_user_id = auth.uid()
            )
        ) AND 
        reservation_type = 'personal'
    );

-- Users can update their own reservations
CREATE POLICY "Users can update own reservations" ON reservations
    FOR UPDATE TO authenticated
    USING (
        user_id IN (
            SELECT id FROM profiles 
            WHERE user_id IN (
                SELECT id FROM public.users 
                WHERE auth_user_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        user_id IN (
            SELECT id FROM profiles 
            WHERE user_id IN (
                SELECT id FROM public.users 
                WHERE auth_user_id = auth.uid()
            )
        )
    );

-- Users can delete (cancel) their own reservations
CREATE POLICY "Users can delete own reservations" ON reservations
    FOR DELETE TO authenticated
    USING (
        user_id IN (
            SELECT id FROM profiles 
            WHERE user_id IN (
                SELECT id FROM public.users 
                WHERE auth_user_id = auth.uid()
            )
        )
    );

-- Coaches can manage TS and HC reservations
CREATE POLICY "Coaches can manage TS reservations" ON reservations
    FOR ALL TO authenticated
    USING (
        reservation_type IN ('training_session', 'houston_calling') AND
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'admin'))
    )
    WITH CHECK (
        reservation_type IN ('training_session', 'houston_calling') AND
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'admin'))
    );

-- ----------------------------------------
-- COWORK PARTICIPANTS POLICIES
-- ----------------------------------------

-- All authenticated users can read participants
CREATE POLICY "Authenticated can read cowork_participants" ON cowork_participants
    FOR SELECT TO authenticated
    USING (true);

-- Users can join open reservations
CREATE POLICY "Users can join cowork" ON cowork_participants
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id IN (
            SELECT id FROM profiles 
            WHERE user_id IN (
                SELECT id FROM public.users 
                WHERE auth_user_id = auth.uid()
            )
        ) AND
        EXISTS (
            SELECT 1 FROM reservations 
            WHERE id = reservation_id 
            AND is_cowork_open = true 
            AND status = 'active'
        )
    );

-- Users can leave (delete their participation)
CREATE POLICY "Users can leave cowork" ON cowork_participants
    FOR DELETE TO authenticated
    USING (
        user_id IN (
            SELECT id FROM profiles 
            WHERE user_id IN (
                SELECT id FROM public.users 
                WHERE auth_user_id = auth.uid()
            )
        )
    );

-- ----------------------------------------
-- ROOM ISSUES POLICIES
-- ----------------------------------------

-- All authenticated users can read issues
CREATE POLICY "Authenticated can read room_issues" ON room_issues
    FOR SELECT TO authenticated
    USING (true);

-- Users can report issues
CREATE POLICY "Users can report issues" ON room_issues
    FOR INSERT TO authenticated
    WITH CHECK (
        reported_by IN (
            SELECT id FROM profiles 
            WHERE user_id IN (
                SELECT id FROM public.users 
                WHERE auth_user_id = auth.uid()
            )
        )
    );

-- Users can update their own reports (before resolved)
CREATE POLICY "Users can update own issues" ON room_issues
    FOR UPDATE TO authenticated
    USING (
        reported_by IN (
            SELECT id FROM profiles 
            WHERE user_id IN (
                SELECT id FROM public.users 
                WHERE auth_user_id = auth.uid()
            )
        ) AND status = 'open'
    )
    WITH CHECK (
        reported_by IN (
            SELECT id FROM profiles 
            WHERE user_id IN (
                SELECT id FROM public.users 
                WHERE auth_user_id = auth.uid()
            )
        )
    );

-- Coaches and admins can resolve issues
CREATE POLICY "Coaches can resolve issues" ON room_issues
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'admin')));

-- ----------------------------------------
-- SCHEDULE BREAKS POLICIES
-- ----------------------------------------

-- All authenticated users can read breaks
CREATE POLICY "Authenticated can read schedule_breaks" ON schedule_breaks
    FOR SELECT TO authenticated
    USING (true);

-- Coaches and admins can manage breaks
CREATE POLICY "Coaches can manage schedule_breaks" ON schedule_breaks
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'admin')))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'admin')));

-- ============================================
-- SEED DATA - ROOMS
-- ============================================

INSERT INTO rooms (code, name, description, available_days, can_have_ts) VALUES
    ('d126', 'D126', 'Přední Koučovačka', NULL, true),
    ('d132', 'D132', 'Zadní Koučovačka', NULL, true),
    ('d226', 'D226', 'Horní Koučovačka "Kaamos" místnost', NULL, true),
    ('d127', 'D127 - Tichá místnost', 'Přední pravá malá místnost se zvedacímy stoly a gaučíkem', NULL, false),
    ('d129', 'D129 - Reprezentační místnost', 'Zadní pravá malá místnost', NULL, false),
    ('d107', 'D107', 'Dostupná pouze ve středu. První středa v měsíci: Houston Calling 9-12.', ARRAY[3], false);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE rooms IS 'Místnosti dostupné pro rezervaci';
COMMENT ON TABLE recurring_schedules IS 'Opakované rozvrhy Training Sessions nastavené kouči';
COMMENT ON TABLE reservations IS 'Všechny rezervace (osobní, TS, HC)';
COMMENT ON TABLE cowork_participants IS 'Účastníci kteří se připojili k otevřeným cowork rezervacím';
COMMENT ON TABLE room_issues IS 'Nahlášené problémy s místnostmi';
COMMENT ON TABLE schedule_breaks IS 'Výjimky z TS rozvrhu (Days of Joy, prázdniny, svátky)';

COMMENT ON COLUMN rooms.available_days IS 'Pole dnů kdy je místnost dostupná. NULL = všechny dny. [3] = pouze středa (0=Ne, 1=Po, 2=Út, 3=St, 4=Čt, 5=Pá, 6=So)';
COMMENT ON COLUMN rooms.can_have_ts IS 'Může mít tato místnost Training Sessions? false pro tiché/reprezentační místnosti';
COMMENT ON COLUMN reservations.is_cowork_open IS 'Může se k této rezervaci připojit někdo další?';
COMMENT ON COLUMN reservations.recurring_schedule_id IS 'Reference na opakovaný rozvrh, pokud je tato rezervace součástí TS';
