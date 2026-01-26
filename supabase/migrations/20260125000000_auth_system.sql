-- Tappka Authentication System Migration
-- Creates tables for user profiles, teams, pre-registered emails, and verification codes

-- Create role enum
CREATE TYPE user_role AS ENUM ('student', 'team_leader', 'coach', 'admin');

-- Teams table (tymove firmy)
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    year INTEGER NOT NULL CHECK (year >= 1 AND year <= 3),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles table (extends auth.users)
-- Note: role and team_id are set during school email verification from pre_registered_emails
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    school_email TEXT,
    locale TEXT NOT NULL DEFAULT 'cs',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pre-registered emails table (admin-imported from Excel)
-- Contains the authoritative role and team assignment for each student
CREATE TABLE pre_registered_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'student',
    full_name TEXT,
    claimed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Verification codes table
CREATE TABLE verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    school_email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_profiles_team_id ON profiles(team_id);
CREATE INDEX idx_profiles_is_verified ON profiles(is_verified);
CREATE INDEX idx_pre_registered_emails_email ON pre_registered_emails(email);
CREATE INDEX idx_pre_registered_emails_claimed_by ON pre_registered_emails(claimed_by);
CREATE INDEX idx_verification_codes_user_id ON verification_codes(user_id);
CREATE INDEX idx_verification_codes_school_email ON verification_codes(school_email);
CREATE INDEX idx_verification_codes_expires_at ON verification_codes(expires_at);

-- Function to handle new user signup
-- Only sets full_name from metadata; role and team_id will be set during school email verification
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role, team_id, is_verified, created_at, updated_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        'student',  -- Default role, will be updated during verification
        NULL,       -- No team until verified
        FALSE,
        NOW(),
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on profiles
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_registered_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Teams: Authenticated users can read active teams
CREATE POLICY "Authenticated users can view active teams" ON teams
    FOR SELECT TO authenticated
    USING (is_active = true);

-- Profiles: Users can read their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

-- Profiles: Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Pre-registered emails: Authenticated users can read (to check if their email exists)
CREATE POLICY "Authenticated users can read pre-registered emails" ON pre_registered_emails
    FOR SELECT TO authenticated
    USING (true);

-- Verification codes: Users can read their own codes
CREATE POLICY "Users can view own verification codes" ON verification_codes
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Verification codes: Users can create codes for themselves
CREATE POLICY "Users can create own verification codes" ON verification_codes
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Verification codes: Users can update their own codes (for attempts/used)
CREATE POLICY "Users can update own verification codes" ON verification_codes
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Service role bypass (for API routes that need full access)
-- The service role key bypasses RLS by default, but we add explicit policies for clarity

-- Insert some sample teams for development
INSERT INTO teams (name, year, is_active) VALUES
    ('Viento', 1, true),
    ('Tuuli', 2, true),
    ('Aero', 3, true);
