import type { Tables } from "@/lib/supabase/tables";

export type Profile = Tables<"profiles">;

export interface BirthGivingProfileSummary {
  id: string;
  name: string | null;
  picture: string | null;
}

export type BirthGivingDuration = "8h" | "24h";
export type BirthGivingEventStatus = "draft" | "published";
export type BirthGivingAssignmentState = "none" | "present" | "missing";
export type BirthGivingTeamResultState = "pending" | "present" | "missing";

export interface BirthGivingResultFile {
  id: string;
  storage_path: string;
  original_file_name: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
  uploaded_by_profile_id: string;
}

export interface BirthGivingEvent {
  id: string;
  name: string;
  customer: string;
  starts_at: string;
  duration: BirthGivingDuration;
  status: BirthGivingEventStatus;
  organizer_profile_ids: string[];
  assignment_state: BirthGivingAssignmentState;
  assignment_storage_path: string | null;
  assignment_file_name: string | null;
  assignment_mime_type: string | null;
  assignment_file_size: number | null;
  assignment_uploaded_at: string | null;
  assignment_uploaded_by_profile_id: string | null;
  removed_at: string | null;
  removed_by_profile_id: string | null;
  created_by_profile_id: string;
  updated_by_profile_id: string;
  created_at: string;
  updated_at: string;
}

export interface BirthGivingTeam {
  id: string;
  event_id: string;
  name: string;
  is_winner: boolean;
  result_state: BirthGivingTeamResultState;
  result_files: BirthGivingResultFile[];
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_by_profile_id: string;
  updated_by_profile_id: string;
  created_at: string;
  updated_at: string;
}

export interface BirthGivingTeamMember {
  id: string;
  event_id: string;
  team_id: string;
  profile_id: string;
  confirmed_at: string;
  reflection_contribution: string | null;
  reflection_learning: string | null;
  reflection_submitted_at: string | null;
  created_by_profile_id: string;
  updated_by_profile_id: string;
  created_at: string;
  updated_at: string;
}

export interface BirthGivingMemberWithProfile extends BirthGivingTeamMember {
  profile: BirthGivingProfileSummary;
}

export interface BirthGivingTeamDetail extends BirthGivingTeam {
  members: BirthGivingMemberWithProfile[];
}

export interface BirthGivingEventDetail extends BirthGivingEvent {
  organizers: BirthGivingProfileSummary[];
  teams: BirthGivingTeamDetail[];
}

export interface BirthGivingEventIndexItem extends BirthGivingEvent {
  team_count: number;
  participant_count: number;
  participant_profile_ids: string[];
}

export interface GroupableBirthGivingEvent {
  id: string;
  starts_at: string;
  duration: BirthGivingDuration;
  organizer_profile_ids: string[];
  participant_profile_ids: string[];
}

export interface BirthGivingDuplicateCandidateItem {
  id: string;
  name: string;
  customer: string;
  starts_at: string;
  status: BirthGivingEventStatus;
}


export interface GroupedBirthGivingEvents<T extends GroupableBirthGivingEvent> {
  upcoming: T[];
  mine: T[];
  history: T[];
}

export interface BirthGivingProfileHistoryItem extends BirthGivingEvent {
  membership: BirthGivingTeamMember;
  team: Pick<BirthGivingTeam, "id" | "name" | "is_winner">;
  organizers: BirthGivingProfileSummary[];
}

