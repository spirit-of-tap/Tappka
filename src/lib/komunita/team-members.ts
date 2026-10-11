import type { ProfileRole } from './types';

/** Roles attached to a team that are not counted as its members. */
const NON_MEMBER_ROLES: readonly ProfileRole[] = ['coach'];

/** Team member count shown in the UI — coaches are attached to teams but are not members. */
export function countTeamMembers(profiles: readonly { role: ProfileRole }[]): number {
  return profiles.filter((p) => !NON_MEMBER_ROLES.includes(p.role)).length;
}
