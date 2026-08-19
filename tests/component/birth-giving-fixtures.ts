import type {
  BirthGivingAssignment,
  BirthGivingEventDetail,
  BirthGivingEventIndexItem,
  BirthGivingMemberWithProfile,
  BirthGivingOrganizerWithProfile,
  BirthGivingProfileSummary,
  BirthGivingProfileHistoryItem,
  BirthGivingProposalWithProfiles,
  BirthGivingReflection,
  BirthGivingTeamDetail,
  BirthGivingTeamMember,
  BirthGivingTeamProposal,
  BirthGivingTeamResultFile,
  BirthGivingTeamSearchWithProfile,
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
    frozen_at: null,
    created_at: "2026-08-19T07:00:00.000Z",
    updated_at: "2026-08-19T07:00:00.000Z",
    created_by_profile_id: "org-1",
    updated_by_profile_id: "org-1",
    ...overrides,
  };
}

export function makeMemberWithProfile(
  overrides: Partial<BirthGivingTeamMember> = {},
  reflection: BirthGivingReflection | null = null,
): BirthGivingMemberWithProfile {
  const profileId = overrides.profile_id ?? "member-1";
  const name = profileId === "member-1" ? "Member One" : `Member ${profileId}`;
  return {
    ...makeMember(overrides),
    profile: makeProfileSummary(profileId, name),
    reflection,
  };
}

export function makeReflection(overrides: Partial<BirthGivingReflection> = {}): BirthGivingReflection {
  return {
    id: "reflection-1",
    event_id: "event-1",
    profile_id: "member-1",
    contribution: "Zorganizovala jsem práci v týmu.",
    learning: "Naučila jsem se delegovat.",
    removed_at: null,
    created_at: "2026-08-19T10:00:00.000Z",
    updated_at: "2026-08-19T10:00:00.000Z",
    created_by_profile_id: "member-1",
    updated_by_profile_id: "member-1",
    ...overrides,
  };
}

export function makeProposal(
  overrides: Partial<BirthGivingTeamProposal> & Partial<Pick<BirthGivingProposalWithProfiles, "candidate" | "initiator">> = {},
): BirthGivingProposalWithProfiles {
  const candidateProfileId = overrides.candidate_profile_id ?? "candidate-1";
  const initiatorProfileId = overrides.initiated_by_profile_id ?? "member-1";
  const direction = overrides.direction ?? "join_request";
  return {
    id: "proposal-1",
    event_id: "event-1",
    team_id: "team-1",
    candidate_profile_id: candidateProfileId,
    initiated_by_profile_id: initiatorProfileId,
    direction,
    state: "pending",
    resolved_by_profile_id: null,
    resolved_at: null,
    created_at: "2026-08-19T09:00:00.000Z",
    updated_at: "2026-08-19T09:00:00.000Z",
    created_by_profile_id: initiatorProfileId,
    updated_by_profile_id: initiatorProfileId,
    ...overrides,
    candidate:
      overrides.candidate
      ?? makeProfileSummary(candidateProfileId, candidateProfileId === "member-1" ? "Member One" : `Candidate ${candidateProfileId}`),
    initiator:
      overrides.initiator
      ?? makeProfileSummary(initiatorProfileId, `Initiator ${initiatorProfileId}`),
  } as BirthGivingProposalWithProfiles;
}

export function makeResultFile(overrides: Partial<BirthGivingTeamResultFile> = {}): BirthGivingTeamResultFile {
  return {
    id: "file-1",
    event_id: "event-1",
    team_id: "team-1",
    storage_path: "birth-giving/results/event-1/team-1/file-1.pdf",
    original_file_name: "vysledky.pdf",
    mime_type: "application/pdf",
    file_size: 1_500_000,
    uploaded_by_profile_id: "member-1",
    uploaded_at: "2026-08-19T17:00:00.000Z",
    removed_at: null,
    removed_by_profile_id: null,
    created_at: "2026-08-19T17:00:00.000Z",
    updated_at: "2026-08-19T17:00:00.000Z",
    created_by_profile_id: "member-1",
    updated_by_profile_id: "member-1",
    ...overrides,
  };
}

export function makeOrganizer(profileId = "org-1", name = "Org One"): BirthGivingOrganizerWithProfile {
  return {
    event_id: "event-1",
    profile_id: profileId,
    created_at: "2026-08-19T06:00:00.000Z",
    updated_at: "2026-08-19T06:00:00.000Z",
    created_by_profile_id: profileId,
    updated_by_profile_id: profileId,
    profile: makeProfileSummary(profileId, name),
  };
}

export function makeAssignment(overrides: Partial<BirthGivingAssignment> = {}): BirthGivingAssignment {
  return {
    event_id: "event-1",
    state: "present",
    replacement_id: "replacement-1",
    storage_path: "birth-giving/assignments/event-1/zadani.pdf",
    original_file_name: "zadani.pdf",
    mime_type: "application/pdf",
    file_size: 2_000_000,
    uploaded_by_profile_id: "org-1",
    uploaded_at: "2026-08-19T07:00:00.000Z",
    created_at: "2026-08-19T07:00:00.000Z",
    updated_at: "2026-08-19T07:00:00.000Z",
    created_by_profile_id: "org-1",
    updated_by_profile_id: "org-1",
    ...overrides,
  };
}

export function makeTeam(overrides: Partial<BirthGivingTeamDetail> = {}): BirthGivingTeamDetail {
  return {
    id: "team-1",
    event_id: "event-1",
    name: "Tým Alfa",
    status: "forming",
    result_state: "pending",
    cancelled_at: null,
    cancellation_reason: null,
    created_at: "2026-08-19T06:30:00.000Z",
    updated_at: "2026-08-19T06:30:00.000Z",
    created_by_profile_id: "member-1",
    updated_by_profile_id: "member-1",
    members: [],
    proposals: [],
    result_files: [],
    ...overrides,
  } as BirthGivingTeamDetail;
}

export function makeTeamSearch(
  profileId: string,
  name: string,
): BirthGivingTeamSearchWithProfile {
  return {
    event_id: "event-1",
    profile_id: profileId,
    created_at: "2026-08-19T08:30:00.000Z",
    updated_at: "2026-08-19T08:30:00.000Z",
    created_by_profile_id: profileId,
    updated_by_profile_id: profileId,
    profile: makeProfileSummary(profileId, name),
  };
}

export interface MakeEventOptions {
  assignment?: BirthGivingAssignment | null;
  teams?: BirthGivingTeamDetail[];
  teamSearches?: BirthGivingTeamSearchWithProfile[];
  organizers?: BirthGivingOrganizerWithProfile[];
}

export function makeEvent(
  overrides: Partial<BirthGivingEventDetail> = {},
  options: MakeEventOptions = {},
): BirthGivingEventDetail {
  return {
    id: "event-1",
    name: "First BG",
    normalized_name: "first bg",
    customer: "Zákazník A",
    normalized_customer: "zakaznik a",
    starts_at: STARTS_AT,
    duration: "8h",
    minimum_team_size: 2,
    maximum_team_size: 4,
    joining_open: true,
    status: "published",
    start_processed_at: null,
    start_emails_queued_at: null,
    removed_at: null,
    removed_by_profile_id: null,
    created_at: "2026-08-19T06:00:00.000Z",
    updated_at: "2026-08-19T06:00:00.000Z",
    created_by_profile_id: "org-1",
    updated_by_profile_id: "org-1",
    organizers: options.organizers ?? [makeOrganizer()],
    teams: options.teams ?? [],
    team_searches: options.teamSearches ?? [],
    ...overrides,
    assignment: overrides.assignment !== undefined ? overrides.assignment : options.assignment ?? null,
  } as unknown as BirthGivingEventDetail;
}

export function makeEventIndexItem(
  overrides: Partial<BirthGivingEventIndexItem> = {},
): BirthGivingEventIndexItem {
  return {
    id: overrides.id ?? "event-1",
    name: overrides.name ?? "First BG",
    normalized_name: "first bg",
    customer: overrides.customer ?? "Zákazník A",
    normalized_customer: "zakaznik a",
    starts_at: overrides.starts_at ?? STARTS_AT,
    duration: "8h",
    minimum_team_size: 2,
    maximum_team_size: 4,
    joining_open: true,
    status: "published",
    start_processed_at: null,
    start_emails_queued_at: null,
    removed_at: null,
    removed_by_profile_id: null,
    created_at: "2026-08-19T06:00:00.000Z",
    updated_at: "2026-08-19T06:00:00.000Z",
    created_by_profile_id: "org-1",
    updated_by_profile_id: "org-1",
    organizer_profile_ids: ["org-1"],
    participant_profile_ids: [],
    pending_proposal_profile_ids: [],
    team_count: 0,
    participant_count: 0,
    ...overrides,
  } as unknown as BirthGivingEventIndexItem;
}

export function makeHistoryItem(overrides: Partial<BirthGivingProfileHistoryItem> = {}): BirthGivingProfileHistoryItem {
  return {
    id: "event-1",
    name: "First BG",
    normalized_name: "first bg",
    customer: "Zákazník A",
    normalized_customer: "zakaznik a",
    starts_at: STARTS_AT,
    duration: "8h",
    minimum_team_size: 2,
    maximum_team_size: 4,
    joining_open: false,
    status: "published",
    start_processed_at: "2026-08-19T08:00:00.000Z",
    start_emails_queued_at: "2026-08-19T08:00:00.000Z",
    removed_at: null,
    removed_by_profile_id: null,
    created_at: "2026-08-19T06:00:00.000Z",
    updated_at: "2026-08-19T06:00:00.000Z",
    created_by_profile_id: "org-1",
    updated_by_profile_id: "org-1",
    membership: makeMember(),
    team: { id: "team-1", name: "Tým Alfa", status: "confirmed" },
    ...overrides,
  } as unknown as BirthGivingProfileHistoryItem;
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
      joining_open: false,
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