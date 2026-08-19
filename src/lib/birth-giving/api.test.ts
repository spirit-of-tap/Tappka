import { describe, expect, it } from "vitest";

import {
  birthGivingDraftSchema,
  birthGivingEventPatchSchema,
  birthGivingHistoricalTeamSchema,
  birthGivingJoiningSchema,
  birthGivingLookingForTeamSchema,
  birthGivingProposalSchema,
  birthGivingReflectionSchema,
  birthGivingTeamSchema,
  mapBirthGivingPostgresError,
} from "./api";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const EVENT_ID = "33333333-3333-4333-8333-333333333333";
const TEAM_ID = "44444444-4444-4444-8444-444444444444";

describe("Birth Giving API payload schemas", () => {
  it("parses and trims a strict draft payload", () => {
    expect(
      birthGivingDraftSchema.parse({
        name: "  BG pro knihovnu  ",
        customer: "  Městská knihovna  ",
        startsAt: "2026-09-01T08:00:00.000Z",
        duration: "8h",
        minimumTeamSize: 2,
        maximumTeamSize: 5,
        joiningOpen: true,
        organizerProfileIds: [PROFILE_ID, OTHER_PROFILE_ID],
      }),
    ).toEqual({
      name: "BG pro knihovnu",
      customer: "Městská knihovna",
      startsAt: "2026-09-01T08:00:00.000Z",
      duration: "8h",
      minimumTeamSize: 2,
      maximumTeamSize: 5,
      joiningOpen: true,
      organizerProfileIds: [PROFILE_ID, OTHER_PROFILE_ID],
    });
  });

  it("rejects invalid draft ranges, duplicate organizers, and unknown keys", () => {
    const payload = {
      name: "BG",
      customer: "Klientstvo",
      startsAt: "2026-09-01T08:00:00.000Z",
      duration: "24h",
      minimumTeamSize: 5,
      maximumTeamSize: 2,
      joiningOpen: false,
      organizerProfileIds: [PROFILE_ID, PROFILE_ID],
      unexpected: true,
    };

    expect(birthGivingDraftSchema.safeParse(payload).success).toBe(false);
  });

  it("accepts only non-empty partial event patches", () => {
    expect(birthGivingEventPatchSchema.parse({ name: "  Nový název  " })).toEqual({
      name: "Nový název",
    });
    expect(birthGivingEventPatchSchema.parse({ joiningOpen: false })).toEqual({
      joiningOpen: false,
    });
    expect(birthGivingEventPatchSchema.safeParse({}).success).toBe(false);
    expect(birthGivingEventPatchSchema.safeParse({ unknown: true }).success).toBe(false);
  });

  it("parses joining, team-search, team, and proposal payloads", () => {
    expect(birthGivingJoiningSchema.parse({ joiningOpen: false })).toEqual({ joiningOpen: false });
    expect(birthGivingLookingForTeamSchema.parse({ looking: true })).toEqual({ looking: true });
    expect(birthGivingTeamSchema.parse({ name: "  Tým Aurora  " })).toEqual({ name: "Tým Aurora" });
    expect(
      birthGivingProposalSchema.parse({
        teamId: TEAM_ID,
        candidateProfileId: PROFILE_ID,
        direction: "join_request",
        acknowledgeMove: false,
      }),
    ).toEqual({
      teamId: TEAM_ID,
      candidateProfileId: PROFILE_ID,
      direction: "join_request",
      acknowledgeMove: false,
    });
    expect(
      birthGivingProposalSchema.safeParse({
        teamId: TEAM_ID,
        candidateProfileId: PROFILE_ID,
        direction: "join_request",
      }).success,
    ).toBe(false);
  });

  it("parses historical team correction and reflection payloads", () => {
    expect(
      birthGivingHistoricalTeamSchema.parse({
        name: "  Tým Atlas  ",
        memberProfileIds: [PROFILE_ID, OTHER_PROFILE_ID],
        resultState: "missing",
      }),
    ).toEqual({
      name: "Tým Atlas",
      memberProfileIds: [PROFILE_ID, OTHER_PROFILE_ID],
      resultState: "missing",
    });
    expect(
      birthGivingReflectionSchema.parse({ contribution: "  Výzkum  ", learning: "  Facilitace  " }),
    ).toEqual({ contribution: "Výzkum", learning: "Facilitace" });
  });

  it("rejects malformed identifiers, empty text, and unsupported enum values", () => {
    expect(
      birthGivingProposalSchema.safeParse({
        teamId: EVENT_ID,
        candidateProfileId: "not-a-uuid",
        direction: "move",
        acknowledgeMove: false,
      }).success,
    ).toBe(false);
    expect(birthGivingTeamSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(
      birthGivingHistoricalTeamSchema.safeParse({
        name: "Tým",
        memberProfileIds: [],
        resultState: "pending",
      }).success,
    ).toBe(false);
    expect(birthGivingReflectionSchema.safeParse({ contribution: "", learning: "Poznatek" }).success).toBe(false);
  });
});

describe("mapBirthGivingPostgresError", () => {
  it.each([
    ["55000", "Team formation is closed for this event", "FORMATION_CLOSED", 409],
    ["55000", "Joining can only change before the event start", "FORMATION_CLOSED", 409],
    ["23514", "Target team is at maximum capacity", "TEAM_FULL", 409],
    ["55000", "Proposal is missing or already resolved", "PROPOSAL_RESOLVED", 409],
    ["23505", "Profile already belongs to a team in this event", "ALREADY_JOINED", 409],
    ["23505", "duplicate key value violates unique constraint birth_giving_team_members_event_profile_key", "ALREADY_JOINED", 409],
    ["55000", "Assignment is not released yet", "ASSIGNMENT_NOT_RELEASED", 409],
    ["55000", "Assignment is locked after event end", "ASSIGNMENT_LOCKED", 409],
    ["55000", "Only an active event can be updated before it has ended", "EVENT_LOCKED", 409],
    ["55000", "Started event lifecycle fields are immutable and joining must remain closed", "EVENT_LOCKED", 409],
    ["23505", "duplicate key value violates unique constraint birth_giving_events_identity_key", "DUPLICATE_EVENT", 409],
    ["55000", "MOVE_REQUIRES_ACKNOWLEDGEMENT", "MOVE_REQUIRES_ACKNOWLEDGEMENT", 409],
    ["23503", "Target team does not belong to the open event", "INVALID_RELATION", 409],
    ["23514", "Every retrospective team requires a result state and valid team size", "PUBLICATION_INVALID", 422],
    ["55000", "Only an active draft can be published", "PUBLICATION_INVALID", 422],
    ["23514", "Historical team size is outside event capacity", "PUBLICATION_INVALID", 422],
    ["22023", "Internal organizer validation details", "VALIDATION_ERROR", 422],
  ] as const)("maps %s %s to %s", (code, message, expectedCode, expectedStatus) => {
    expect(mapBirthGivingPostgresError({ code, message })).toMatchObject({
      code: expectedCode,
      status: expectedStatus,
    });
  });

  it("returns null for an unexpected database error", () => {
    expect(mapBirthGivingPostgresError({ code: "XX000", message: "Unexpected failure" })).toBeNull();
  });

  it("does not expose SQL validation details", () => {
    expect(
      mapBirthGivingPostgresError({ code: "22023", message: "Sensitive internal SQL details" }),
    ).toEqual({
      code: "VALIDATION_ERROR",
      message: "Zadané údaje nejsou platné.",
      status: 422,
    });
  });
});
