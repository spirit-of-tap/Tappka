/**
 * Data fetching helpers for the komunita (community) system
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type {
  Profile,
  ProfileWithTeam,
  Team,
  TeamWithMembers,
  TeamWithCount,
  ProfileFilters,
} from './types';

/**
 * Get all profiles with optional filtering
 */
export async function getProfiles(
  supabase: SupabaseClient,
  filters?: ProfileFilters,
): Promise<ProfileWithTeam[]> {
  let query = supabase
    .from('profiles')
    .select(`
      *,
      team:teams(*)
    `)
    .is('removed_access', null) // Only active users
    .order('name', { ascending: true });

  // Apply search filter
  if (filters?.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,work_email.ilike.%${filters.search}%,personal_email.ilike.%${filters.search}%`,
    );
  }

  // Apply team filter
  if (filters?.teamId) {
    query = query.eq('team_id', filters.teamId);
  }

  // Apply role filter
  if (filters?.role) {
    query = query.eq('role', filters.role);
  }

  // Apply year filter (via team)
  if (filters?.year) {
    // We need to join with teams to filter by year
    const { data: teams } = await supabase
      .from('teams')
      .select('id')
      .eq('year', filters.year);
    
    if (teams && teams.length > 0) {
      const teamIds = teams.map(t => t.id);
      query = query.in('team_id', teamIds);
    } else {
      // No teams with this year, return empty
      return [];
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching profiles:', error);
    throw error;
  }

  return data as ProfileWithTeam[];
}

/**
 * Get a single profile by ID with team information
 */
export async function getProfileById(
  supabase: SupabaseClient,
  profileId: string,
): Promise<ProfileWithTeam | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      team:teams(*)
    `)
    .eq('id', profileId)
    .is('removed_access', null)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return data as ProfileWithTeam;
}

/**
 * Get all teams with member counts
 */
export async function getTeamsWithCount(
  supabase: SupabaseClient,
): Promise<TeamWithCount[]> {
  const { data, error } = await supabase
    .from('teams')
    .select(`
      *,
      profiles!team_id(count)
    `)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching teams:', error);
    throw error;
  }

  // Transform the data to include member_count
  return (data || []).map((team: any) => ({
    ...team,
    member_count: team.profiles?.[0]?.count || 0,
    profiles: undefined, // Remove the nested profiles object
  })) as TeamWithCount[];
}

/**
 * Get all teams (simple list)
 */
export async function getTeams(supabase: SupabaseClient): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching teams:', error);
    throw error;
  }

  return data as Team[];
}

/**
 * Get a single team by ID with all members
 */
export async function getTeamById(
  supabase: SupabaseClient,
  teamId: string,
): Promise<TeamWithMembers | null> {
  const { data, error } = await supabase
    .from('teams')
    .select(`
      *,
      profiles(*)
    `)
    .eq('id', teamId)
    .is('profiles.removed_access', null)
    .single();

  if (error) {
    console.error('Error fetching team:', error);
    return null;
  }

  // Sort profiles by role (coaches first, then mentors, then students)
  const roleOrder = { coach: 0, mentor: 1, student: 2, admin: 3 };
  const sortedProfiles = (data.profiles || []).sort((a: Profile, b: Profile) => {
    const orderA = roleOrder[a.role] ?? 999;
    const orderB = roleOrder[b.role] ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });

  return {
    ...data,
    profiles: sortedProfiles,
  } as TeamWithMembers;
}

/**
 * Get storage URL for a picture from B2 storage key
 * For private buckets, this returns the key that can be used to fetch a presigned URL
 * For public buckets or full URLs, returns as-is
 */
export function getStorageUrl(
  _supabase: SupabaseClient,
  _bucket: string,
  path: string | null,
): string | null {
  if (!path) return null;

  // If it's already a full URL, return it (legacy or external URLs)
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // Return the key - UI components will fetch presigned URL via API
  return path;
}

/**
 * Get profile picture key/URL
 * Returns the storage key for B2, or the full URL if it's a legacy/external URL
 */
export function getProfilePictureUrl(
  supabase: SupabaseClient,
  profile: Profile,
): string | null {
  if (profile.picture) {
    return getStorageUrl(supabase, 'profile-pictures', profile.picture);
  }
  return null;
}

/**
 * Get team picture key/URL
 * Returns the storage key for B2, or the full URL if it's a legacy/external URL
 */
export function getTeamPictureUrl(
  supabase: SupabaseClient,
  team: Team,
): string | null {
  if (team.picture) {
    return getStorageUrl(supabase, 'team-pictures', team.picture);
  }
  return null;
}
