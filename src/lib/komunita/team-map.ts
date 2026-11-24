import { isAlumnus } from './alumni';
import type { ProfileRole, ProfileWithTeam } from './types';

export const BUBBLE_MIN_DIAMETER = 136;
export const BUBBLE_MAX_DIAMETER = 232;
/** Member count at which a bubble reaches its maximum diameter. */
export const BUBBLE_FULL_SIZE_MEMBERS = 30;
export const RING_AVATAR_SIZE = 32;
const RING_AVATAR_GAP = 4;
export const MAX_RING_AVATARS = 12;
/** Above this many bubbles the side panel sticks to the viewport on large screens. */
export const DENSE_MAP_GROUP_COUNT = 24;

export const STAFF_GROUP_ID = 'group:staff';
export const UNASSIGNED_GROUP_ID = 'group:unassigned';

const STAFF_ROLES: ReadonlySet<ProfileRole> = new Set(['coach', 'admin']);
const ROLE_ORDER: Record<ProfileRole, number> = { coach: 0, admin: 1, mentor: 2, student: 3 };
const COLLATOR = new Intl.Collator('cs');

export type MapGroupKind = 'team' | 'staff' | 'unassigned';

export interface MapGroup {
  id: string;
  kind: MapGroupKind;
  name: string;
  color: string | null;
  members: ProfileWithTeam[];
  coaches: ProfileWithTeam[];
}

export interface RingLayout {
  shown: number;
  overflow: number;
}

export interface MapSearchResult {
  people: ProfileWithTeam[];
  highlightedGroupIds: Set<string>;
}

/** Diacritics-insensitive, lowercase normalization for matching Czech names. */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Square-root scale so the bubble's area, not its width, tracks the head count. */
export function bubbleDiameter(memberCount: number): number {
  const span = BUBBLE_FULL_SIZE_MEMBERS - 1;
  const t = Math.min(Math.max((memberCount - 1) / span, 0), 1);
  return Math.round(BUBBLE_MIN_DIAMETER + (BUBBLE_MAX_DIAMETER - BUBBLE_MIN_DIAMETER) * Math.sqrt(t));
}

/** How many avatars fit on the ring of a bubble this wide. */
export function ringCapacity(diameter: number, avatarSize: number = RING_AVATAR_SIZE): number {
  const radius = (diameter - avatarSize) / 2;
  const fit = Math.floor((2 * Math.PI * radius) / (avatarSize + RING_AVATAR_GAP));
  return Math.max(1, Math.min(fit, MAX_RING_AVATARS));
}

/** The "+N" chip takes one slot of the ring, so one fewer avatar is shown when members overflow. */
export function ringLayout(memberCount: number, diameter: number): RingLayout {
  const capacity = ringCapacity(diameter);
  if (memberCount <= capacity) return { shown: memberCount, overflow: 0 };
  const shown = capacity - 1;
  return { shown, overflow: memberCount - shown };
}

function compareMembers(a: ProfileWithTeam, b: ProfileWithTeam): number {
  const byRole = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
  return byRole !== 0 ? byRole : COLLATOR.compare(a.name ?? '', b.name ?? '');
}

function toGroup(
  id: string,
  kind: MapGroupKind,
  name: string,
  color: string | null,
  members: ProfileWithTeam[],
): MapGroup {
  const sorted = [...members].sort(compareMembers);
  return {
    id,
    kind,
    name,
    color,
    members: sorted,
    coaches: kind === 'team' ? sorted.filter((m) => STAFF_ROLES.has(m.role)) : [],
  };
}

/**
 * Teams with at least one active member, the viewer's team first, then by size
 * and name; staff and unassigned people follow as neutral groups.
 */
export function buildMapGroups(
  profiles: ProfileWithTeam[],
  viewerTeamId: string | null = null,
): MapGroup[] {
  const byTeam = new Map<string, ProfileWithTeam[]>();
  const staff: ProfileWithTeam[] = [];
  const unassigned: ProfileWithTeam[] = [];

  for (const profile of profiles) {
    if (isAlumnus(profile)) continue;
    if (profile.team && profile.team.removed_at === null) {
      const list = byTeam.get(profile.team.id) ?? [];
      list.push(profile);
      byTeam.set(profile.team.id, list);
    } else if (STAFF_ROLES.has(profile.role)) {
      staff.push(profile);
    } else {
      unassigned.push(profile);
    }
  }

  const teams = [...byTeam.entries()].map(([id, members]) => {
    const team = members[0].team!;
    return toGroup(id, 'team', team.name, team.color, members);
  });

  teams.sort((a, b) => {
    if (viewerTeamId) {
      if (a.id === viewerTeamId) return -1;
      if (b.id === viewerTeamId) return 1;
    }
    return b.members.length - a.members.length || COLLATOR.compare(a.name, b.name);
  });

  const groups = teams;
  if (staff.length > 0) groups.push(toGroup(STAFF_GROUP_ID, 'staff', 'Kouči:ky a vedení', null, staff));
  if (unassigned.length > 0) groups.push(toGroup(UNASSIGNED_GROUP_ID, 'unassigned', 'Bez týmu', null, unassigned));
  return groups;
}

export function defaultSelectedGroupId(groups: MapGroup[], viewerTeamId: string | null): string | null {
  if (viewerTeamId && groups.some((g) => g.id === viewerTeamId)) return viewerTeamId;
  return groups[0]?.id ?? null;
}

export function groupIdByProfile(groups: MapGroup[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of groups) {
    for (const member of group.members) map.set(member.id, group.id);
  }
  return map;
}

function matchesPerson(profile: ProfileWithTeam, q: string): boolean {
  return (
    normalize(profile.name ?? '').includes(q) ||
    normalize(profile.work_email).includes(q) ||
    (profile.personal_email ? normalize(profile.personal_email).includes(q) : false)
  );
}

/**
 * People match by name or email, teams by name. A team that matches by name
 * contributes its whole roster; every group holding a match stays highlighted.
 */
export function searchMap(
  profiles: ProfileWithTeam[],
  groups: MapGroup[],
  query: string,
): MapSearchResult {
  const q = normalize(query.trim());
  if (!q) return { people: profiles, highlightedGroupIds: new Set(groups.map((g) => g.id)) };

  const highlighted = new Set<string>();
  const matchedIds = new Set<string>();
  const groupOf = groupIdByProfile(groups);

  for (const profile of profiles) {
    if (!matchesPerson(profile, q)) continue;
    matchedIds.add(profile.id);
    const groupId = groupOf.get(profile.id);
    if (groupId) highlighted.add(groupId);
  }
  for (const group of groups) {
    if (group.kind !== 'team' || !normalize(group.name).includes(q)) continue;
    highlighted.add(group.id);
    for (const member of group.members) matchedIds.add(member.id);
  }

  return { people: profiles.filter((p) => matchedIds.has(p.id)), highlightedGroupIds: highlighted };
}

export function coachLine(group: MapGroup): string | null {
  if (group.coaches.length === 0) return null;
  const names = group.coaches.map((c) => c.name ?? '').join(', ');
  return group.coaches.length === 1 ? `kouč:ka ${names}` : `kouči:ky ${names}`;
}
