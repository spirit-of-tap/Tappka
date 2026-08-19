import type { Database } from "@/lib/supabase/database.types";
import type { Tables } from "@/lib/supabase/tables";

export type BirthGivingAssignment = Tables<"birth_giving_assignments">;
export type BirthGivingEmailDelivery = Tables<"birth_giving_email_deliveries">;
export type BirthGivingEventOrganizer = Tables<"birth_giving_event_organizers">;
export type BirthGivingEvent = Tables<"birth_giving_events">;
export type BirthGivingLookingForTeam = Tables<"birth_giving_looking_for_team">;
export type BirthGivingReflection = Tables<"birth_giving_reflections">;
export type BirthGivingTeamMember = Tables<"birth_giving_team_members">;
export type BirthGivingTeamProposal = Tables<"birth_giving_team_proposals">;
export type BirthGivingTeamResultFile = Tables<"birth_giving_team_result_files">;
export type BirthGivingTeam = Tables<"birth_giving_teams">;
export type Profile = Tables<"profiles">;

export type BirthGivingAssignmentState =
  Database["public"]["Enums"]["birth_giving_assignment_state"];
export type BirthGivingDeliveryStatus =
  Database["public"]["Enums"]["birth_giving_delivery_status"];
export type BirthGivingDuration = Database["public"]["Enums"]["birth_giving_duration"];
export type BirthGivingEmailMessageType =
  Database["public"]["Enums"]["birth_giving_email_message_type"];
export type BirthGivingEventStatus =
  Database["public"]["Enums"]["birth_giving_event_status"];
export type BirthGivingProposalDirection =
  Database["public"]["Enums"]["birth_giving_proposal_direction"];
export type BirthGivingProposalState =
  Database["public"]["Enums"]["birth_giving_proposal_state"];
export type BirthGivingTeamResultState =
  Database["public"]["Enums"]["birth_giving_team_result_state"];
export type BirthGivingTeamStatus =
  Database["public"]["Enums"]["birth_giving_team_status"];

export interface BirthGivingProfileSummary {
  id: Profile["id"];
  name: Profile["name"];
  picture: Profile["picture"];
}

export interface BirthGivingDuplicateCandidateItem {
  id: BirthGivingEvent["id"];
  status: BirthGivingEventStatus;
  name: BirthGivingEvent["name"];
  customer: BirthGivingEvent["customer"];
  starts_at: BirthGivingEvent["starts_at"];
}

export interface BirthGivingOrganizerWithProfile extends BirthGivingEventOrganizer {
  profile: BirthGivingProfileSummary;
}

export interface BirthGivingMemberWithProfile extends BirthGivingTeamMember {
  profile: BirthGivingProfileSummary;
  reflection: BirthGivingReflection | null;
}

export interface BirthGivingProposalWithProfiles extends BirthGivingTeamProposal {
  candidate: BirthGivingProfileSummary;
  initiator: BirthGivingProfileSummary;
}

export interface BirthGivingTeamSearchWithProfile extends BirthGivingLookingForTeam {
  profile: BirthGivingProfileSummary;
}

export interface BirthGivingTeamDetail extends BirthGivingTeam {
  members: BirthGivingMemberWithProfile[];
  proposals: BirthGivingProposalWithProfiles[];
  result_files: BirthGivingTeamResultFile[];
}

export interface BirthGivingEventDetail extends BirthGivingEvent {
  assignment: BirthGivingAssignment | null;
  organizers: BirthGivingOrganizerWithProfile[];
  teams: BirthGivingTeamDetail[];
  team_searches: BirthGivingTeamSearchWithProfile[];
}

export interface BirthGivingEventIndexItem extends BirthGivingEvent {
  organizer_profile_ids: string[];
  participant_profile_ids: string[];
  pending_proposal_profile_ids: string[];
  team_count: number;
  participant_count: number;
}

export interface GroupableBirthGivingEvent {
  id: string;
  starts_at: string;
  duration: BirthGivingDuration;
  joining_open: boolean;
  organizer_profile_ids: string[];
  participant_profile_ids: string[];
  pending_proposal_profile_ids: string[];
}

export interface GroupedBirthGivingEvents<T extends GroupableBirthGivingEvent> {
  upcoming: T[];
  mine: T[];
  history: T[];
}

export interface BirthGivingParticipationCandidate {
  event_id: string;
  frozen_at: string | null;
  event_status: BirthGivingEventStatus;
  event_removed_at: string | null;
  team_status: BirthGivingTeamStatus;
}

export interface BirthGivingProfileHistoryItem extends BirthGivingEvent {
  membership: BirthGivingTeamMember;
  team: Pick<BirthGivingTeam, "id" | "name" | "status">;
}
