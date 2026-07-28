/**
 * Type definitions for the komunita (community) system
 */

import type { Database } from '@/lib/supabase/database.types';
import type { Tables } from '@/lib/supabase/tables';

// Database enum types
export type ProfileRole = Database['public']['Enums']['profile_role'];

// Team from database
export type Team = Tables<'teams'>;

// Profile from database
export type Profile = Tables<'profiles'>;

// Profile with team information
export interface ProfileWithTeam extends Profile {
  team: Team | null;
}

// Team with members list
export interface TeamWithMembers extends Team {
  profiles: Profile[];
}

// Team with member count (for listing)
export interface TeamWithCount extends Team {
  member_count: number;
}

// Filters for profile search
export interface ProfileFilters {
  search?: string;
  teamId?: string;
  role?: ProfileRole;
  year?: number;
}

// Role labels in Czech
export const ROLE_LABELS: Record<ProfileRole, string> = {
  student: 'Student',
  mentor: 'Mentor',
  coach: 'Kouč',
  admin: 'Admin',
};

// Role badge colors
export const ROLE_COLORS: Record<ProfileRole, string> = {
  student: 'bg-chart-3/15 text-chart-3',
  mentor: 'bg-chart-5/15 text-chart-5',
  coach: 'bg-chart-2/15 text-chart-2',
  admin: 'bg-destructive/15 text-destructive',
};

// Year labels
export const YEAR_LABELS: Record<number, string> = {
  1: '1. ročník',
  2: '2. ročník',
  3: '3. ročník',
};
