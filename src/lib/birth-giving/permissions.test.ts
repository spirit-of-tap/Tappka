import { describe, expect, it } from "vitest";

import type {
  BirthGivingEventOrganizer,
  BirthGivingTeamMember,
} from "./types";
import {
  canFormBirthGivingTeams,
  canManageBirthGivingAssignment,
  canManageBirthGivingEventDetails,
  canManageBirthGivingResult,
  canMarkBirthGivingAssignmentMissing,
  canMarkBirthGivingResultMissing,
  getBirthGivingMembership,
  isBirthGivingOrganizer,
  isBirthGivingTeamMember,
} from "./permissions";
import type {
  BirthGivingEventDetail,
  BirthGivingMemberWithProfile,
  BirthGivingTeamDetail,
} from "./types";

const NOW = new Date("2026-08-19T12:00:00.000Z");
const STARTS_AT = "2026-08-19T08:00:00.000Z";
const ENDS_AT = new Date("2026-08-19T16:00:00.000Z");

const ORGANIZER: BirthGivingEventOrganizer = {
  event_id: "event-1",
  profile_id: "org-1",
  created_at: "",
  updated_at: "",
  created_by_profile_id: "org-1",
  updated_by_profile_id: "org-1",
};

const MEMBER_ROW: BirthGivingTeamMember = {
  id: "member-row-1",
  event_id: "event-1",
  team_id: "team-1",
  profile_id: "member-1",
  confirmed_at: STARTS_AT,
  frozen_at: null,
  created_at: "",
  updated_at: "",
  created_by_profile_id: "org-1",
  updated_by_profile_id: "org-1",
};

const MEMBER: BirthGivingMemberWithProfile = {
  ...MEMBER_ROW,
  profile: { id: "member-1", name: "Member", picture: null },
  reflection: null,
};

function makeTeam(overrides: Partial<BirthGivingTeamDetail> = {}): BirthGivingTeamDetail {
  return {
    id: "team-1",
    event_id: "event-1",
    name: "Tým Alfa",
    status: "forming",
    result_state: "pending",
    cancelled_at: null,
    cancellation_reason: null,
    created_at: "",
    updated_at: "",
    created_by_profile_id: "org-1",
    updated_by_profile_id: "org-1",
    members: [],
    proposals: [],
    result_files: [],
    ...overrides,
  } as BirthGivingTeamDetail;
}

function makeEvent(overrides: Partial<BirthGivingEventDetail> = {}): BirthGivingEventDetail {
  return {
    id: "event-1",
    name: "First BG",
    normalized_name: "first bg",
    customer: "Customer A",
    normalized_customer: "customer a",
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
    created_at: "",
    updated_at: "",
    created_by_profile_id: "org-1",
    updated_by_profile_id: "org-1",
    assignment: null,
    organizers: [{ ...ORGANIZER }],
    teams: [],
    team_searches: [],
    ...overrides,
  } as unknown as BirthGivingEventDetail;
}

describe("isBirthGivingOrganizer", () => {
  it("is true for a named organizer", () => {
    expect(isBirthGivingOrganizer(makeEvent(), "org-1")).toBe(true);
  });

  it("is false for a non-organizer", () => {
    expect(isBirthGivingOrganizer(makeEvent(), "member-1")).toBe(false);
  });
});

describe("getBirthGivingMembership", () => {
  it("returns the membership of the profile across all teams", () => {
    const event = makeEvent({ teams: [makeTeam({ members: [{ ...MEMBER }] })] });
    expect(getBirthGivingMembership(event, "member-1")?.team_id).toBe("team-1");
  });

  it("returns null when the profile has no membership", () => {
    const event = makeEvent({ teams: [makeTeam()] });
    expect(getBirthGivingMembership(event, "member-1")).toBeNull();
  });
});

describe("isBirthGivingTeamMember", () => {
  it("is true for a confirmed member of the given team", () => {
    const team = makeTeam({ members: [{ ...MEMBER }] });
    expect(isBirthGivingTeamMember(team, "member-1")).toBe(true);
  });

  it("is false for an outsider", () => {
    const team = makeTeam({ members: [{ ...MEMBER }] });
    expect(isBirthGivingTeamMember(team, "org-1")).toBe(false);
  });
});

describe("canFormBirthGivingTeams", () => {
  it("is true for a published event with open joining before the start", () => {
    expect(
      canFormBirthGivingTeams(makeEvent(), new Date("2026-08-19T07:00:00.000Z")),
    ).toBe(true);
  });

  it("is false once the event started", () => {
    expect(canFormBirthGivingTeams(makeEvent(), NOW)).toBe(false);
  });

  it("is false when joining is closed", () => {
    expect(
      canFormBirthGivingTeams(makeEvent({ joining_open: false }), new Date("2026-08-19T07:00:00.000Z")),
    ).toBe(false);
  });

  it("is false for a draft", () => {
    expect(
      canFormBirthGivingTeams(makeEvent({ status: "draft" }), new Date("2026-08-19T07:00:00.000Z")),
    ).toBe(false);
  });
});

describe("canManageBirthGivingAssignment", () => {
  it("is true for an organizer before the event ends", () => {
    expect(
      canManageBirthGivingAssignment(makeEvent(), "org-1", new Date("2026-08-19T15:00:00.000Z")),
    ).toBe(true);
  });

  it("is true for an organizer of a draft", () => {
    expect(
      canManageBirthGivingAssignment(makeEvent({ status: "draft" }), "org-1", new Date("2026-08-19T15:00:00.000Z")),
    ).toBe(true);
  });

  it("is false for an organizer after the event ends", () => {
    expect(canManageBirthGivingAssignment(makeEvent(), "org-1", ENDS_AT)).toBe(false);
  });

  it("is false for a non-organizer", () => {
    expect(
      canManageBirthGivingAssignment(makeEvent(), "member-1", new Date("2026-08-19T15:00:00.000Z")),
    ).toBe(false);
  });
});

describe("canMarkBirthGivingAssignmentMissing", () => {
  it("is true for an organizer after the event ends", () => {
    expect(canMarkBirthGivingAssignmentMissing(makeEvent(), "org-1", ENDS_AT)).toBe(true);
  });

  it("is false before the event ends", () => {
    expect(canMarkBirthGivingAssignmentMissing(makeEvent(), "org-1", NOW)).toBe(false);
  });

  it("is false for a non-organizer", () => {
    expect(canMarkBirthGivingAssignmentMissing(makeEvent(), "member-1", ENDS_AT)).toBe(false);
  });
});

describe("canManageBirthGivingEventDetails", () => {
  it("is true for an organizer before the event ends", () => {
    expect(canManageBirthGivingEventDetails(makeEvent(), "org-1", NOW)).toBe(true);
  });

  it("is false after the event ends", () => {
    expect(canManageBirthGivingEventDetails(makeEvent(), "org-1", ENDS_AT)).toBe(false);
  });

  it("is false for a non-organizer", () => {
    expect(canManageBirthGivingEventDetails(makeEvent(), "member-1", NOW)).toBe(false);
  });
});

describe("canManageBirthGivingResult", () => {
  it("is true for a confirmed team member once the event started", () => {
    const team = makeTeam({ members: [{ ...MEMBER }] });
    expect(canManageBirthGivingResult(makeEvent(), team, "member-1", NOW)).toBe(true);
  });

  it("is false for a confirmed team member before the event starts", () => {
    const team = makeTeam({ members: [{ ...MEMBER }] });
    expect(
      canManageBirthGivingResult(makeEvent(), team, "member-1", new Date("2026-08-19T07:00:00.000Z")),
    ).toBe(false);
  });

  it("is true for an organizer after the event ends", () => {
    expect(canManageBirthGivingResult(makeEvent(), makeTeam(), "org-1", ENDS_AT)).toBe(true);
  });

  it("is false for an outsider during the event", () => {
    expect(canManageBirthGivingResult(makeEvent(), makeTeam(), "org-1", NOW)).toBe(false);
  });
});

describe("canMarkBirthGivingResultMissing", () => {
  it("is true for a manager after the event ends", () => {
    expect(canMarkBirthGivingResultMissing(makeEvent(), makeTeam(), "org-1", ENDS_AT)).toBe(true);
  });

  it("is false during the event despite manage rights", () => {
    const team = makeTeam({ members: [{ ...MEMBER }] });
    expect(canMarkBirthGivingResultMissing(makeEvent(), team, "member-1", NOW)).toBe(false);
  });
});