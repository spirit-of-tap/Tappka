import { describe, expect, it } from "vitest";

import {
  canManageEvent,
  canManageTeam,
  canSubmitReflection,
  canUploadResults,
  getBirthGivingMembership,
  isBirthGivingOrganizer,
  isBirthGivingTeamMember,
} from "./permissions";
import type {
  BirthGivingEventDetail,
  BirthGivingMemberWithProfile,
  BirthGivingTeamDetail,
} from "./types";

const MEMBER: BirthGivingMemberWithProfile = {
  id: "member-1",
  event_id: "event-1",
  team_id: "team-1",
  profile_id: "profile-1",
  confirmed_at: "2026-08-19T08:00:00.000Z",
  reflection_contribution: null,
  reflection_learning: null,
  reflection_submitted_at: null,
  created_by_profile_id: "org-1",
  updated_by_profile_id: "org-1",
  created_at: "",
  updated_at: "",
  profile: { id: "profile-1", name: "Jan", picture: null },
};

function makeTeam(overrides: Partial<BirthGivingTeamDetail> = {}): BirthGivingTeamDetail {
  return {
    id: "team-1",
    event_id: "event-1",
    name: "Tým Alfa",
    is_winner: false,
    result_state: "pending",
    result_files: [],
    cancelled_at: null,
    cancellation_reason: null,
    created_at: "",
    updated_at: "",
    created_by_profile_id: "org-1",
    updated_by_profile_id: "org-1",
    members: [MEMBER],
    ...overrides,
  };
}

function makeEvent(overrides: Partial<BirthGivingEventDetail> = {}): BirthGivingEventDetail {
  return {
    id: "event-1",
    name: "First BG",
    customer: "Customer A",
    starts_at: "2026-08-19T08:00:00.000Z",
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
    created_at: "",
    updated_at: "",
    created_by_profile_id: "org-1",
    updated_by_profile_id: "org-1",
    organizers: [{ id: "org-1", name: "Organizer", picture: null }],
    teams: [makeTeam()],
    ...overrides,
  };
}

describe("Birth Giving permissions", () => {
  it("detects organizer", () => {
    const event = makeEvent({ organizer_profile_ids: ["org-1", "org-2"] });
    expect(isBirthGivingOrganizer(event, "org-1")).toBe(true);
    expect(isBirthGivingOrganizer(event, "org-2")).toBe(true);
    expect(isBirthGivingOrganizer(event, "stranger")).toBe(false);
  });

  it("detects team membership", () => {
    const team = makeTeam({ members: [MEMBER] });
    expect(isBirthGivingTeamMember(team, "profile-1")).toBe(true);
    expect(isBirthGivingTeamMember(team, "stranger")).toBe(false);
  });

  it("finds member in event", () => {
    const event = makeEvent();
    expect(getBirthGivingMembership(event, "profile-1")?.id).toBe("member-1");
    expect(getBirthGivingMembership(event, "stranger")).toBeNull();
  });

  it("manages event only if organizer", () => {
    const event = makeEvent({ organizer_profile_ids: ["org-1"] });
    expect(canManageEvent(event, "org-1")).toBe(true);
    expect(canManageEvent(event, "profile-1")).toBe(false);
  });

  it("manages team if organizer, creator or member", () => {
    const event = makeEvent({ organizer_profile_ids: ["org-1"] });
    const team = makeTeam({ created_by_profile_id: "creator-1", members: [MEMBER] });

    expect(canManageTeam(event, team, "org-1")).toBe(true);
    expect(canManageTeam(event, team, "creator-1")).toBe(true);
    expect(canManageTeam(event, team, "profile-1")).toBe(true);
    expect(canManageTeam(event, team, "stranger")).toBe(false);
  });

  it("can upload results if organizer or team member", () => {
    const event = makeEvent({ organizer_profile_ids: ["org-1"] });
    const team = makeTeam({ members: [MEMBER] });

    expect(canUploadResults(event, team, "org-1")).toBe(true);
    expect(canUploadResults(event, team, "profile-1")).toBe(true);
    expect(canUploadResults(event, team, "stranger")).toBe(false);
  });

  it("can submit reflection only if team member", () => {
    const team = makeTeam({ members: [MEMBER] });

    expect(canSubmitReflection(team, "profile-1")).toBe(true);
    expect(canSubmitReflection(team, "stranger")).toBe(false);
  });
});