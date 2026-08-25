import type {
  BirthGivingEventDetail,
  BirthGivingProfileSummary,
  BirthGivingTeamDetail,
} from "./types";

export interface BirthGivingRetrospectiveTeamIssue {
  team: BirthGivingTeamDetail;
  memberCount: number;
  sizeValid: boolean;
  resultStatePending: boolean;
  resultPresentWithoutFiles: boolean;
}

export interface BirthGivingRetrospectiveReview {
  assignmentPending: boolean;
  teamsMissing: boolean;
  teamIssues: BirthGivingRetrospectiveTeamIssue[];
  affectedProfiles: BirthGivingProfileSummary[];
}

export function buildBirthGivingRetrospectiveReview(
  event: BirthGivingEventDetail,
): BirthGivingRetrospectiveReview {
  const teams = event.teams.filter(({ cancelled_at }) => !cancelled_at);
  return {
    assignmentPending: event.assignment_state === "none",
    teamsMissing: teams.length === 0,
    teamIssues: teams.map((team) => buildTeamIssue(team)),
    affectedProfiles: collectBirthGivingAffectedProfiles(event),
  };
}

export function collectBirthGivingAffectedProfiles(
  event: Pick<BirthGivingEventDetail, "teams">,
): BirthGivingProfileSummary[] {
  const seen = new Set<string>();
  const profiles: BirthGivingProfileSummary[] = [];
  for (const team of event.teams) {
    if (team.cancelled_at) continue;
    for (const member of team.members) {
      if (seen.has(member.profile_id)) continue;
      seen.add(member.profile_id);
      profiles.push(member.profile);
    }
  }
  return profiles;
}

function buildTeamIssue(
  team: BirthGivingTeamDetail,
): BirthGivingRetrospectiveTeamIssue {
  const memberCount = team.members.length;
  return {
    team,
    memberCount,
    sizeValid: memberCount >= 1,
    resultStatePending: team.result_state === "pending",
    resultPresentWithoutFiles:
      team.result_state === "present" && team.result_files.length === 0,
  };
}