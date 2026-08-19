import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  birthGivingMutationErrorResponse: vi.fn(),
  getBirthGivingEvent: vi.fn(),
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
vi.mock("@/lib/birth-giving/queries", () => ({ getBirthGivingEvent: mocks.getBirthGivingEvent }));

import { GET as readEvent, PATCH as patchEvent } from "@/app/api/birth-giving/events/[eventId]/route";
import { POST as createEvent } from "@/app/api/birth-giving/events/route";
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
    vi.resetAllMocks();
    rpc.mockResolvedValue({ data: EVENT_ID, error: null });
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

  it("surfaces the real conflicting event when a PATCH identity collides instead of echoing the edited draft", async () => {
    const conflictingId = "20000000-0000-4000-8000-000000000002";
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "23505",
          message: "duplicate key value violates unique constraint birth_giving_events_identity_key",
        },
      })
      .mockResolvedValueOnce({
        data: [{ id: conflictingId, status: "published" }],
        error: null,
      });
    mocks.getBirthGivingEvent.mockResolvedValue({
      id: EVENT_ID,
      name: "Current name",
      customer: "Current customer",
      starts_at: "2026-09-01T08:00:00.000Z",
    } as never);

    const response = await patchEvent(request({ name: "Changed" }) as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "DUPLICATE_EVENT",
      error: "Stejná Birth Giving událost už existuje.",
      data: {
        id: conflictingId,
        status: "published",
        identity: {
          eventName: "changed",
          customer: "current customer",
          startsAt: "2026-09-01T08:00:00.000Z",
        },
      },
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "birth_giving_find_event_conflict", {
      p_normalized_customer: "current customer",
      p_normalized_name: "changed",
      p_starts_at: "2026-09-01T08:00:00.000Z",
    });
    expect(mocks.refreshedEventResponse).not.toHaveBeenCalled();
  });

  it("degrades a hidden 23505 PATCH identity collision to a generic duplicate error without an id", async () => {
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "23505",
          message: "duplicate key value violates unique constraint birth_giving_events_identity_key",
        },
      })
      .mockResolvedValueOnce({ data: [{ id: null, status: null }], error: null });
    mocks.getBirthGivingEvent.mockResolvedValue({
      id: EVENT_ID,
      name: "Current name",
      customer: "Current customer",
      starts_at: "2026-09-01T08:00:00.000Z",
    } as never);

    const response = await patchEvent(request({ name: "Changed" }) as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "DUPLICATE_EVENT",
      error: "Stejná událost s těmito údaji už existuje.",
    });
    expect(mocks.refreshedEventResponse).not.toHaveBeenCalled();
  });

  it("recovers an exact private draft duplicate through metadata-only RPC", async () => {
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "23505",
          message: "duplicate key value violates unique constraint birth_giving_events_identity_key",
        },
      })
      .mockResolvedValueOnce({ data: [{ id: EVENT_ID, status: "draft" }], error: null });

    const response = await createEvent(request({
      name: "  Event Name  ",
      customer: "  Customer Name  ",
      startsAt: "2026-09-01T08:00:00.000Z",
      duration: "8h",
      minimumTeamSize: 1,
      maximumTeamSize: 3,
      joiningOpen: true,
      organizerProfileIds: [EVENT_ID],
    }) as never);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "DUPLICATE_EVENT",
      error: "Stejná Birth Giving událost už existuje.",
      data: {
        id: EVENT_ID,
        status: "draft",
        identity: {
          eventName: "event name",
          customer: "customer name",
          startsAt: "2026-09-01T08:00:00.000Z",
        },
      },
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "birth_giving_find_event_conflict", {
      p_normalized_customer: "customer name",
      p_normalized_name: "event name",
      p_starts_at: "2026-09-01T08:00:00.000Z",
    });
    expect(from).not.toHaveBeenCalled();
    expect(mocks.refreshedEventResponse).not.toHaveBeenCalled();
  });
});

describe("Birth Giving canonical event refresh route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireBirthGivingApiContext.mockResolvedValue({ supabase: { from: vi.fn(), rpc: vi.fn() } });
  });

  it("rejects a malformed event ID before reading the event", async () => {
    const response = await readEvent(new Request("http://localhost") as never, {
      params: Promise.resolve({ eventId: INVALID_ID }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_ID" });
    expect(mocks.getBirthGivingEvent).not.toHaveBeenCalled();
  });

  it("returns the canonical draft used by the retrospective wizard", async () => {
    mocks.getBirthGivingEvent.mockResolvedValue({ id: EVENT_ID, name: "First BG", status: "draft" });

    const response = await readEvent(new Request("http://localhost") as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { id: EVENT_ID, name: "First BG", status: "draft" },
    });
    expect(mocks.getBirthGivingEvent).toHaveBeenCalledWith(expect.anything(), EVENT_ID);
  });

  it("returns 404 when the draft no longer exists", async () => {
    mocks.getBirthGivingEvent.mockResolvedValue(null);

    const response = await readEvent(new Request("http://localhost") as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(response.status).toBe(404);
  });
});
