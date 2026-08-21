import { calculateEventEnd } from "./time";
import type {
  BirthGivingEventDetail,
  BirthGivingMemberWithProfile,
  BirthGivingTeamDetail,
} from "./types";

export function isBirthGivingOrganizer(
  event: Pick<BirthGivingEventDetail, "organizers">,
  profileId: string,
): boolean {
  return event.organizers.some((organizer) => organizer.profile_id === profileId);
}

export function getBirthGivingMembership(
  event: Pick<BirthGivingEventDetail, "teams">,
  profileId: string,
): BirthGivingMemberWithProfile | null {
  for (const team of event.teams) {
    const member = team.members.find(({ profile_id }) => profile_id === profileId);
    if (member) return member;
  }
  return null;
}

export function isBirthGivingTeamMember(
  team: Pick<BirthGivingTeamDetail, "members">,
  profileId: string,
): boolean {
  return team.members.some(({ profile_id }) => profile_id === profileId);
}

export function canFormBirthGivingTeams(
  event: Pick<BirthGivingEventDetail, "status" | "joining_open" | "starts_at">,
  now: Date,
): boolean {
  return (
    event.status === "published"
    && event.joining_open
    && now.getTime() < Date.parse(event.starts_at)
  );
}

export function canManageBirthGivingAssignment(
  event: Pick<BirthGivingEventDetail, "status" | "starts_at" | "duration" | "organizers">,
  profileId: string,
  now: Date,
): boolean {
  if (!isBirthGivingOrganizer(event, profileId)) return false;
  if (event.status === "draft") return true;
  return now.getTime() < calculateEventEnd(new Date(event.starts_at), event.duration).getTime();
}

export function canMarkBirthGivingAssignmentMissing(
  event: Pick<BirthGivingEventDetail, "starts_at" | "duration" | "organizers">,
  profileId: string,
  now: Date,
): boolean {
  if (!isBirthGivingOrganizer(event, profileId)) return false;
  return now.getTime() >= calculateEventEnd(new Date(event.starts_at), event.duration).getTime();
}

export function canManageBirthGivingEventDetails(
  event: Pick<BirthGivingEventDetail, "starts_at" | "duration" | "organizers">,
  profileId: string,
  now: Date,
): boolean {
  if (!isBirthGivingOrganizer(event, profileId)) return false;
  return now.getTime() < calculateEventEnd(new Date(event.starts_at), event.duration).getTime();
}

export function canManageBirthGivingResult(
  event: Pick<BirthGivingEventDetail, "status" | "starts_at" | "duration" | "organizers">,
  team: Pick<BirthGivingTeamDetail, "members" | "status">,
  profileId: string,
  now: Date,
): boolean {
  if (team.status === "cancelled") return false;
  const started = now.getTime() >= Date.parse(event.starts_at);
  if (
    event.status === "published"
    && started
    && isBirthGivingTeamMember(team, profileId)
  ) {
    return true;
  }
  const ended = now.getTime() >= calculateEventEnd(new Date(event.starts_at), event.duration).getTime();
  return ended && isBirthGivingOrganizer(event, profileId);
}

export function canMarkBirthGivingResultMissing(
  event: Pick<BirthGivingEventDetail, "status" | "starts_at" | "duration" | "organizers">,
  team: Pick<BirthGivingTeamDetail, "members" | "status">,
  profileId: string,
  now: Date,
): boolean {
  if (!canManageBirthGivingResult(event, team, profileId, now)) return false;
  return now.getTime() >= calculateEventEnd(new Date(event.starts_at), event.duration).getTime();
}