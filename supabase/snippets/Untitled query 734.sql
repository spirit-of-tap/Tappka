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
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    school_email TEXT,
    locale TEXT NOT NULL DEFAULT 'cs' CHECK (locale IN ('cs', 'en')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pre-registered emails table (admin-imported from Excel)
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
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role, team_id, is_verified, locale, created_at, updated_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student'),
        CASE 
            WHEN NEW.raw_user_meta_data->>'team_id' IS NOT NULL 
            THEN (NEW.raw_user_meta_data->>'team_id')::UUID 
            ELSE NULL 
        END,
        FALSE,
        COALESCE(NEW.raw_user_meta_data->>'locale', 'cs'),
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

-- Teams: Anyone authenticated can read active teams
CREATE POLICY "Anyone can view active teams" ON teams
    FOR SELECT USING (is_active = true);

-- Teams: Only admins can modify teams
CREATE POLICY "Admins can manage teams" ON teams
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Profiles: Users can read their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Profiles: Verified users can view other profiles in their team
CREATE POLICY "Verified users can view team profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles AS viewer
            WHERE viewer.id = auth.uid()
            AND viewer.is_verified = true
            AND (
                viewer.team_id = profiles.team_id
                OR viewer.role IN ('coach', 'admin')
            )
        )
    );

-- Profiles: Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Profiles: Admins can manage all profiles
CREATE POLICY "Admins can manage all profiles" ON profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Pre-registered emails: Users can check if their email exists
CREATE POLICY "Users can check pre-registered emails" ON pre_registered_emails
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Pre-registered emails: Only admins can modify
CREATE POLICY "Admins can manage pre-registered emails" ON pre_registered_emails
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Verification codes: Users can only see their own codes
CREATE POLICY "Users can view own verification codes" ON verification_codes
    FOR SELECT USING (auth.uid() = user_id);

-- Verification codes: Users can create codes for themselves
CREATE POLICY "Users can create own verification codes" ON verification_codes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Verification codes: Users can update their own codes (for attempts/used)
CREATE POLICY "Users can update own verification codes" ON verification_codes
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Verification codes: Admins can manage all codes
CREATE POLICY "Admins can manage verification codes" ON verification_codes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Insert some sample teams for development
INSERT INTO teams (name, year, is_active) VALUES
    ('Tuuli', 1, true),
    ('Tuuli', 1, true),
    ('Impact', 2, true),
    ('Growth', 2, true),
    ('Legacy', 3, true);
