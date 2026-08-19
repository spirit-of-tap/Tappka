import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  birthGivingMutationErrorResponse: vi.fn(),
  refreshedEventResponse: vi.fn(),
  requireBirthGivingApiContext: vi.fn(),
}));

vi.mock("@/app/api/birth-giving/_shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/api/birth-giving/_shared")>()),
  birthGivingMutationErrorResponse: mocks.birthGivingMutationErrorResponse,
  isBirthGivingApiGateFailure: () => false,
  refreshedEventResponse: mocks.refreshedEventResponse,
  requireBirthGivingApiContext: mocks.requireBirthGivingApiContext,
}));

import { PATCH as patchEvent } from "@/app/api/birth-giving/events/[eventId]/route";
import { POST as publishEvent } from "@/app/api/birth-giving/events/[eventId]/publish/route";
import { PUT as saveReflection } from "@/app/api/birth-giving/events/[eventId]/reflection/route";
import { PUT as setLooking } from "@/app/api/birth-giving/events/[eventId]/looking-for-team/route";
import { PATCH as setJoining } from "@/app/api/birth-giving/events/[eventId]/joining/route";
import { POST as createTeam } from "@/app/api/birth-giving/events/[eventId]/teams/route";
import { POST as createHistoricalTeam } from "@/app/api/birth-giving/events/[eventId]/historical-teams/route";
import { PATCH as correctHistoricalTeam } from "@/app/api/birth-giving/events/[eventId]/historical-teams/[teamId]/route";
import { POST as createProposal } from "@/app/api/birth-giving/events/[eventId]/proposals/route";
import { POST as resolveProposal } from "@/app/api/birth-giving/proposals/[proposalId]/[action]/route";

const EVENT_ID = "00000000-0000-4000-8000-000000000001";
const INVALID_ID = "not-a-uuid";
const SUCCESS_RESPONSE = new Response(null, { status: 200 });

function request(body?: unknown): Request {
  return new Request("http://localhost", body === undefined ? undefined : {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

describe("Birth Giving dynamic routes", () => {
  const rpc = vi.fn().mockResolvedValue({ data: EVENT_ID, error: null });
  const from = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireBirthGivingApiContext.mockResolvedValue({ supabase: { from, rpc } });
    mocks.refreshedEventResponse.mockResolvedValue(SUCCESS_RESPONSE);
  });

  it.each([
    ["event patch", (id: string) => patchEvent(request({ name: "Changed" }) as never, { params: Promise.resolve({ eventId: id }) })],
    ["publish", (id: string) => publishEvent(request(), { params: Promise.resolve({ eventId: id }) })],
    ["reflection", (id: string) => saveReflection(request({ contribution: "A", learning: "B" }) as never, { params: Promise.resolve({ eventId: id }) })],
    ["team search", (id: string) => setLooking(request({ looking: true }) as never, { params: Promise.resolve({ eventId: id }) })],
    ["joining", (id: string) => setJoining(request({ joiningOpen: false }) as never, { params: Promise.resolve({ eventId: id }) })],
    ["team", (id: string) => createTeam(request({ name: "Team" }) as never, { params: Promise.resolve({ eventId: id }) })],
    ["historical team", (id: string) => createHistoricalTeam(request({ name: "Team", memberProfileIds: [EVENT_ID], resultState: "missing" }) as never, { params: Promise.resolve({ eventId: id }) })],
    ["proposal", (id: string) => createProposal(request({ teamId: EVENT_ID, candidateProfileId: EVENT_ID, direction: "join_request", acknowledgeMove: false }) as never, { params: Promise.resolve({ eventId: id }) })],
  ])("rejects a malformed %s event ID before Supabase", async (_name, invoke) => {
    const response = await invoke(INVALID_ID);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_ID" });
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects malformed nested team and proposal IDs before Supabase", async () => {
    const teamResponse = await correctHistoricalTeam(
      request({ name: "Team", memberProfileIds: [EVENT_ID], resultState: "missing" }) as never,
      { params: Promise.resolve({ eventId: EVENT_ID, teamId: INVALID_ID }) },
    );
    const proposalResponse = await resolveProposal(request(), {
      params: Promise.resolve({ proposalId: INVALID_ID, action: "accept" }),
    });

    expect(teamResponse.status).toBe(400);
    expect(proposalResponse.status).toBe(400);
    await expect(teamResponse.json()).resolves.toMatchObject({ code: "INVALID_ID" });
    await expect(proposalResponse.json()).resolves.toMatchObject({ code: "INVALID_ID" });
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("passes only provided event PATCH values to the RPC", async () => {
    await patchEvent(request({ name: "Changed" }) as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(rpc).toHaveBeenCalledWith("birth_giving_update_event", {
      p_customer: undefined,
      p_duration: undefined,
      p_event_id: EVENT_ID,
      p_joining_open: undefined,
      p_maximum_team_size: undefined,
      p_minimum_team_size: undefined,
      p_name: "Changed",
      p_organizer_profile_ids: undefined,
      p_starts_at: undefined,
    });
  });
});
