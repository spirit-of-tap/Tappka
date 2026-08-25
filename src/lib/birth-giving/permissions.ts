import type {
  BirthGivingEventDetail,
  BirthGivingMemberWithProfile,
} from "./types";

export function isBirthGivingOrganizer(
  event: { organizer_profile_ids?: string[]; organizers?: { id: string }[] },
  profileId: string,
): boolean {
  if (event.organizer_profile_ids) {
    return event.organizer_profile_ids.includes(profileId);
  }
  if (event.organizers) {
    return event.organizers.some((org) => org.id === profileId);
  }
  return false;
}

export function isBirthGivingTeamMember(
  team: { members?: { profile_id: string }[] },
  profileId: string,
): boolean {
  return team.members?.some((m) => m.profile_id === profileId) ?? false;
}

export function getBirthGivingMembership(
  event: Pick<BirthGivingEventDetail, "teams">,
  profileId: string,
): BirthGivingMemberWithProfile | null {
  for (const team of event.teams) {
    const member = team.members?.find((m) => m.profile_id === profileId);
    if (member) return member;
  }
  return null;
}

export function canManageEvent(
  event: { organizer_profile_ids?: string[]; organizers?: { id: string }[] },
  profileId: string,
): boolean {
  return isBirthGivingOrganizer(event, profileId);
}

export function canManageTeam(
  event: { organizer_profile_ids?: string[]; organizers?: { id: string }[] },
  team: { created_by_profile_id?: string; members?: { profile_id: string }[] },
  profileId: string,
): boolean {
  if (isBirthGivingOrganizer(event, profileId)) return true;
  if (team.created_by_profile_id === profileId) return true;
  return isBirthGivingTeamMember(team, profileId);
}

export function canUploadResults(
  event: { organizer_profile_ids?: string[]; organizers?: { id: string }[] },
  team: { members?: { profile_id: string }[] },
  profileId: string,
): boolean {
  return isBirthGivingOrganizer(event, profileId) || isBirthGivingTeamMember(team, profileId);
}

export function canSubmitReflection(
  team: { members?: { profile_id: string }[] },
  profileId: string,
): boolean {
  return isBirthGivingTeamMember(team, profileId);
}