/**
 * Data fetching helpers for the komunita (community) system
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type {
  Profile,
  ProfileWithTeam,
  Team,
  TeamWithMembers,
  TeamWithCount,
  ProfileFilters,
} from './types';
import { getPublicStorageUrl } from '@/lib/storage/public-url';
import type { BucketId } from '@/lib/storage/buckets';

/**
 * Get all profiles with optional filtering
 */
export async function getProfiles(
  supabase: SupabaseClient<Database>,
  filters?: ProfileFilters,
): Promise<ProfileWithTeam[]> {
  let query = supabase
    .from('profiles')
    .select(`
      *,
      team:teams(*)
    `)
    .is('access_removed_at', null) // Only active users
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
    // We need to join with teams to filter by onboardingYear
    const { data: teams } = await supabase
      .from('teams')
      .select('id')
      .eq('onboardingYear', filters.year);
    
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
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<ProfileWithTeam | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      team:teams(*)
    `)
    .eq('id', profileId)
    .is('access_removed_at', null)
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
  supabase: SupabaseClient<Database>,
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
  return (data || []).map((team) => {
    const { profiles, ...rest } = team;
    return {
      ...rest,
      member_count: profiles?.[0]?.count || 0,
    };
  }) as TeamWithCount[];
}

/**
 * Get all teams (simple list)
 */
export async function getTeams(supabase: SupabaseClient<Database>): Promise<Team[]> {
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
  supabase: SupabaseClient<Database>,
  teamId: string,
): Promise<TeamWithMembers | null> {
  const { data, error } = await supabase
    .from('teams')
    .select(`
      *,
      profiles(*)
    `)
    .eq('id', teamId)
    .is('profiles.access_removed_at', null)
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
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  return {
    ...data,
    profiles: sortedProfiles,
  } as TeamWithMembers;
}

export function getStorageUrl(
  _supabase: SupabaseClient<Database>,
  bucket: BucketId,
  path: string | null,
): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return getPublicStorageUrl(bucket, path);
}

export function getProfilePictureUrl(
  supabase: SupabaseClient<Database>,
  profile: Profile,
): string | null {
  if (profile.picture) {
    return getStorageUrl(supabase, 'avatars', profile.picture);
  }
  return null;
}

export function getTeamPictureUrl(
  supabase: SupabaseClient<Database>,
  team: Team,
): string | null {
  if (team.picture) {
    return getStorageUrl(supabase, 'avatars', team.picture);
  }
  return null;
}
