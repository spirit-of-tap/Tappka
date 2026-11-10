import type { ProfileRole } from './types';

export interface AlumniCheckProfile {
  role: ProfileRole;
  team_id: string | null;
  former_team_id: string | null;
  /** Only `removed_at` matters here, so the full team row (or null) is fine. */
  team: { removed_at: string | null } | null;
}

/**
 * A student is no longer studying once they have no active team: either they
 * left it (`team_id` cleared, `former_team_id` kept) or their cohort was
 * archived (`team.removed_at`). Staff never count as alumni, and a student
 * still waiting for a first team stays in the main list.
 */
export function isAlumnus(profile: AlumniCheckProfile): boolean {
  if (profile.role !== 'student') return false;
  if (profile.team?.removed_at != null) return true;
  return profile.team_id === null && profile.former_team_id !== null;
}
