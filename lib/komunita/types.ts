/**
 * Type definitions for the komunita (community) system
 */

// Database enum types
export type ProfileRole = 'student' | 'team_leader' | 'coach' | 'admin';

// Team from database
export interface Team {
  id: string;
  name: string;
  picture: string | null;
  color: string | null;
  year: number | null;
  created_at: string;
  updated_at: string;
}

// Profile from database
export interface Profile {
  id: string;
  name: string;
  picture: string | null;
  user_id: string | null;
  work_email: string;
  role: ProfileRole;
  team_id: string | null;
  phone_number: string | null;
  personal_email: string | null;
  date_of_birth: string | null;
  removed_access: string | null;
  removed_access_by: string | null;
  created_at: string;
  updated_at: string;
}

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
  team_leader: 'Team Leader',
  coach: 'Kouč',
  admin: 'Admin',
};

// Role badge colors
export const ROLE_COLORS: Record<ProfileRole, string> = {
  student: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  team_leader: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  coach: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

// Year labels
export const YEAR_LABELS: Record<number, string> = {
  1: '1. ročník',
  2: '2. ročník',
  3: '3. ročník',
};
