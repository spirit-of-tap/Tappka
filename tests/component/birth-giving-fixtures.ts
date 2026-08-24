import type {
  BirthGivingEventDetail,
  BirthGivingEventIndexItem,
  BirthGivingMemberWithProfile,
  BirthGivingProfileHistoryItem,
  BirthGivingProfileSummary,
  BirthGivingResultFile,
  BirthGivingTeamDetail,
  BirthGivingTeamMember,
} from "@/lib/birth-giving/types";

export const STARTS_AT = "2026-08-19T08:00:00.000Z";
export const NOW = "2026-08-19T12:00:00.000Z";
export const HISTORICAL_STARTS_AT = "2024-08-19T08:00:00.000Z";

export function makeProfileSummary(id: string, name: string): BirthGivingProfileSummary {
  return { id, name, picture: null };
}

export function makeMember(overrides: Partial<BirthGivingTeamMember> = {}): BirthGivingTeamMember {
  return {
    id: `member-${overrides.profile_id ?? "default"}`,
    event_id: "event-1",
    team_id: "team-1",
    profile_id: "member-1",
    confirmed_at: STARTS_AT,
    reflection_contribution: null,
    reflection_learning: null,
    reflection_submitted_at: null,
    created_by_profile_id: "org-1",
    updated_by_profile_id: "org-1",
    created_at: "2026-08-19T07:00:00.000Z",
    updated_at: "2026-08-19T07:00:00.000Z",
    ...overrides,
  };
}

export function makeMemberWithProfile(
  overrides: Partial<BirthGivingTeamMember> = {},
): BirthGivingMemberWithProfile {
  const profileId = overrides.profile_id ?? "member-1";
  const name = profileId === "member-1" ? "Member One" : `Member ${profileId}`;
  return {
    ...makeMember(overrides),
    profile: makeProfileSummary(profileId, name),
  };
}

export function makeResultFile(overrides: Partial<BirthGivingResultFile> = {}): BirthGivingResultFile {
  return {
    id: "file-1",
    storage_path: "birth-giving/results/event-1/team-1/file-1.pdf",
    original_file_name: "vysledky.pdf",
    mime_type: "application/pdf",
    file_size: 1_500_000,
    uploaded_by_profile_id: "member-1",
    uploaded_at: "2026-08-19T17:00:00.000Z",
    ...overrides,
  };
}

export function makeOrganizer(profileId = "org-1", name = "Org One"): BirthGivingProfileSummary {
  return makeProfileSummary(profileId, name);
}

export function makeTeam(overrides: Partial<BirthGivingTeamDetail> = {}): BirthGivingTeamDetail {
  return {
    id: "team-1",
    event_id: "event-1",
    name: "Tým Alfa",
    is_winner: false,
    result_state: "pending",
    result_files: [],
    cancelled_at: null,
    cancellation_reason: null,
    created_at: "2026-08-19T06:30:00.000Z",
    updated_at: "2026-08-19T06:30:00.000Z",
    created_by_profile_id: "member-1",
    updated_by_profile_id: "member-1",
    members: [],
    ...overrides,
  };
}

export interface MakeEventOptions {
  teams?: BirthGivingTeamDetail[];
  organizers?: BirthGivingProfileSummary[];
}

export function makeEvent(
  overrides: Partial<BirthGivingEventDetail> = {},
  options: MakeEventOptions = {},
): BirthGivingEventDetail {
  return {
    id: "event-1",
    name: "First BG",
    customer: "Zákazník A",
    starts_at: STARTS_AT,
    duration: "8h",
    status: "published",
    organizer_profile_ids: ["org-1"],
    assignment_state: "none",
    assignment_storage_path: null,
    assignment_file_name: null,
    assignment_mime_type: null,
    assignment_file_size: null,
    assignment_uploaded_at: null,
    assignment_uploaded_by_profile_id: null,
    removed_at: null,
    removed_by_profile_id: null,
    created_at: "2026-08-19T06:00:00.000Z",
    updated_at: "2026-08-19T06:00:00.000Z",
    created_by_profile_id: "org-1",
    updated_by_profile_id: "org-1",
    organizers: options.organizers ?? [makeOrganizer()],
    teams: options.teams ?? [],
    ...overrides,
  };
}

export function makeEventIndexItem(
  overrides: Partial<BirthGivingEventIndexItem> = {},
): BirthGivingEventIndexItem {
  return {
    id: overrides.id ?? "event-1",
    name: overrides.name ?? "First BG",
    customer: overrides.customer ?? "Zákazník A",
    starts_at: overrides.starts_at ?? STARTS_AT,
    duration: "8h",
    status: "published",
    organizer_profile_ids: ["org-1"],
    assignment_state: "none",
    assignment_storage_path: null,
    assignment_file_name: null,
    assignment_mime_type: null,
    assignment_file_size: null,
    assignment_uploaded_at: null,
    assignment_uploaded_by_profile_id: null,
    removed_at: null,
    removed_by_profile_id: null,
    created_at: "2026-08-19T06:00:00.000Z",
    updated_at: "2026-08-19T06:00:00.000Z",
    created_by_profile_id: "org-1",
    updated_by_profile_id: "org-1",
    participant_profile_ids: [],
    team_count: 0,
    participant_count: 0,
    ...overrides,
  };
}

export function makeHistoryItem(overrides: Partial<BirthGivingProfileHistoryItem> = {}): BirthGivingProfileHistoryItem {
  return {
    id: "event-1",
    name: "First BG",
    customer: "Zákazník A",
    starts_at: STARTS_AT,
    duration: "8h",
    status: "published",
    organizer_profile_ids: ["org-1"],
    assignment_state: "none",
    assignment_storage_path: null,
    assignment_file_name: null,
    assignment_mime_type: null,
    assignment_file_size: null,
    assignment_uploaded_at: null,
    assignment_uploaded_by_profile_id: null,
    removed_at: null,
    removed_by_profile_id: null,
    created_at: "2026-08-19T06:00:00.000Z",
    updated_at: "2026-08-19T06:00:00.000Z",
    created_by_profile_id: "org-1",
    updated_by_profile_id: "org-1",
    membership: makeMember(),
    team: { id: "team-1", name: "Tým Alfa", is_winner: false },
    organizers: [makeOrganizer()],
    ...overrides,
  };
}

export function makeOrganizerSummaries(): BirthGivingProfileSummary[] {
  return [
    makeProfileSummary("org-1", "Org One"),
    makeProfileSummary("org-2", "Org Two"),
  ];
}

export function makeDraftEvent(
  overrides: Partial<BirthGivingEventDetail> = {},
  options: MakeEventOptions = {},
): BirthGivingEventDetail {
  return makeEvent(
    {
      status: "draft",
      starts_at: HISTORICAL_STARTS_AT,
      ...overrides,
    },
    options,
  );
}

export function makeAllProfiles(): BirthGivingProfileSummary[] {
  return [
    makeProfileSummary("org-1", "Org One"),
    makeProfileSummary("member-1", "Member One"),
    makeProfileSummary("candidate-1", "Candidate One"),
    makeProfileSummary("candidate-2", "Candidate Two"),
  ];
}