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
// student/coach use the "-strong" text variants: bare text-chart-3/text-chart-2
// measure below WCAG AA 4.5:1 as standalone text on their own tinted badge
// background. text-chart-5 (mentor, ~5.0:1) and text-destructive (admin, ~4.7:1
// on --background) already clear AA and are left as-is.
export const ROLE_COLORS: Record<ProfileRole, string> = {
  student: 'bg-chart-3/15 text-chart-3-strong',
  mentor: 'bg-chart-5/15 text-chart-5',
  coach: 'bg-chart-2/15 text-chart-2-strong',
  admin: 'bg-destructive/15 text-destructive',
};

// Year labels
export const YEAR_LABELS: Record<number, string> = {
  1: '1. ročník',
  2: '2. ročník',
  3: '3. ročník',
};
