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

import { DELETE as deleteEvent, GET as readEvent, PATCH as patchEvent } from "@/app/api/birth-giving/events/[eventId]/route";
import { POST as createEvent } from "@/app/api/birth-giving/events/route";
import { POST as publishEvent } from "@/app/api/birth-giving/events/[eventId]/publish/route";
import { PUT as saveReflection } from "@/app/api/birth-giving/events/[eventId]/reflection/route";
import { POST as createTeam } from "@/app/api/birth-giving/events/[eventId]/teams/route";
import { DELETE as deleteTeam, PATCH as updateTeam } from "@/app/api/birth-giving/events/[eventId]/teams/[teamId]/route";

const EVENT_ID = "00000000-0000-4000-8000-000000000001";
const TEAM_ID = "00000000-0000-4000-8000-000000000002";
const PROFILE_ID = "00000000-0000-4000-8000-000000000003";
const INVALID_ID = "not-a-uuid";
const SUCCESS_RESPONSE = new Response(null, { status: 200 });
const MUTATION_ERROR_RESPONSE = new Response(null, { status: 409 });

type RpcError = { code: string; message: string; details: string; hint: string };

function request(body?: unknown, method = "POST"): Request {
  return new Request("http://localhost", body === undefined ? undefined : {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method,
  });
}

function createSupabase(rpcData: unknown = null, rpcError: RpcError | null = null) {
  // The real supabase-js rpc() reads `this.rest`; the call must stay bound to
  // the client object (calling the method value detached throws TypeError).
  const rpc = vi.fn(function (this: unknown, ..._args: unknown[]) {
    if (!this) throw new TypeError("Cannot read properties of undefined (reading 'rest')");
    return Promise.resolve({ data: rpcData, error: rpcError });
  });
  return { rpc, supabase: { rpc } };
}

describe("Birth Giving dynamic routes", () => {
  let defaultRpcMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    const fixture = createSupabase();
    defaultRpcMock = fixture.rpc;
    mocks.requireBirthGivingApiContext.mockResolvedValue({
      profileId: PROFILE_ID,
      supabase: fixture.supabase,
    });
    mocks.refreshedEventResponse.mockResolvedValue(SUCCESS_RESPONSE);
    mocks.birthGivingMutationErrorResponse.mockResolvedValue(MUTATION_ERROR_RESPONSE);
  });

  describe("route ID validation", () => {
    it.each([
      ["event patch", () => patchEvent(request({ name: "Changed" }, "PATCH") as never, { params: Promise.resolve({ eventId: INVALID_ID }) })],
      ["event delete", () => deleteEvent(new Request("http://localhost") as never, { params: Promise.resolve({ eventId: INVALID_ID }) })],
      ["publish", () => publishEvent(new Request("http://localhost") as never, { params: Promise.resolve({ eventId: INVALID_ID }) })],
      ["reflection", () => saveReflection(request({ contribution: "A", learning: "B" }) as never, { params: Promise.resolve({ eventId: INVALID_ID }) })],
      ["team create", () => createTeam(request({ name: "Team" }) as never, { params: Promise.resolve({ eventId: INVALID_ID }) })],
      ["team update", () => updateTeam(request({ isWinner: true }, "PATCH") as never, { params: Promise.resolve({ eventId: EVENT_ID, teamId: INVALID_ID }) })],
      ["team delete", () => deleteTeam(new Request("http://localhost") as never, { params: Promise.resolve({ eventId: EVENT_ID, teamId: INVALID_ID }) })],
    ])("rejects a malformed ID in %s without calling any RPC", async (_name, invoke) => {
      const response = await invoke();

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ code: "INVALID_ID" });
      expect(defaultRpcMock).not.toHaveBeenCalled();
    });
  });

  it("keeps the event detail read query-based", async () => {
    mocks.getBirthGivingEvent.mockResolvedValue({ id: EVENT_ID });

    const response = await readEvent(new Request("http://localhost") as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(response.status).toBe(200);
    expect(mocks.getBirthGivingEvent).toHaveBeenCalled();
  });

  it("creates an event through birth_giving_save_event and refreshes it", async () => {
    const { rpc, supabase } = createSupabase(EVENT_ID);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await createEvent(
      request({
        name: "BG pro knihovnu",
        customer: "Městská knihovna",
        startsAt: "2026-09-01T08:00:00.000Z",
        duration: "8h",
        organizerProfileIds: [PROFILE_ID],
      }) as never,
    );

    expect(rpc).toHaveBeenCalledWith("birth_giving_save_event", {
      p_event_id: null,
      p_name: "BG pro knihovnu",
      p_customer: "Městská knihovna",
      p_starts_at: "2026-09-01T08:00:00.000Z",
      p_duration: "8h",
      p_organizer_profile_ids: [PROFILE_ID],
    });
    expect(mocks.refreshedEventResponse).toHaveBeenCalledWith(supabase, EVENT_ID, 201);
    expect(response.status).toBe(200);
  });

  it("routes event create RPC errors to the mutation error response", async () => {
    const rpcError = { code: "23505", message: "duplicate", details: "", hint: "" };
    const { supabase } = createSupabase(null, rpcError);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await createEvent(
      request({
        name: "BG pro knihovnu",
        customer: "Městská knihovna",
        startsAt: "2026-09-01T08:00:00.000Z",
        duration: "8h",
        organizerProfileIds: [PROFILE_ID],
      }) as never,
    );

    expect(mocks.birthGivingMutationErrorResponse).toHaveBeenCalledWith(rpcError, supabase);
    expect(mocks.refreshedEventResponse).not.toHaveBeenCalled();
    expect(response.status).toBe(409);
  });

  it("does not treat a missing event create RPC result as success", async () => {
    const { supabase } = createSupabase(null);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await createEvent(
      request({
        name: "BG pro knihovnu",
        customer: "Městská knihovna",
        startsAt: "2026-09-01T08:00:00.000Z",
        duration: "8h",
        organizerProfileIds: [PROFILE_ID],
      }) as never,
    );

    expect(response.status).toBe(500);
    expect(mocks.refreshedEventResponse).not.toHaveBeenCalled();
  });

  it("patches an event by merging the payload with the stored event", async () => {
    const { rpc, supabase } = createSupabase(EVENT_ID);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });
    mocks.getBirthGivingEvent.mockResolvedValue({
      id: EVENT_ID,
      name: "Původní",
      customer: "Městská knihovna",
      starts_at: "2026-09-01T08:00:00.000Z",
      duration: "8h",
      organizer_profile_ids: [PROFILE_ID],
    });

    const response = await patchEvent(request({ name: "Nový název" }, "PATCH") as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(rpc).toHaveBeenCalledWith("birth_giving_save_event", {
      p_event_id: EVENT_ID,
      p_name: "Nový název",
      p_customer: "Městská knihovna",
      p_starts_at: "2026-09-01T08:00:00.000Z",
      p_duration: "8h",
      p_organizer_profile_ids: [PROFILE_ID],
    });
    expect(mocks.refreshedEventResponse).toHaveBeenCalledWith(supabase, EVENT_ID);
    expect(response.status).toBe(200);
  });

  it("returns 404 from event patch when the event is not visible", async () => {
    mocks.getBirthGivingEvent.mockResolvedValue(null);

    const response = await patchEvent(request({ name: "Nový název" }, "PATCH") as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(response.status).toBe(404);
  });

  it("deletes an event through birth_giving_remove_event", async () => {
    const { rpc, supabase } = createSupabase();
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await deleteEvent(new Request("http://localhost") as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(rpc).toHaveBeenCalledWith("birth_giving_remove_event", { p_event_id: EVENT_ID });
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(response.status).toBe(200);
  });

  it("publishes an event through birth_giving_publish_event", async () => {
    const { rpc, supabase } = createSupabase();
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await publishEvent(new Request("http://localhost") as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(rpc).toHaveBeenCalledWith("birth_giving_publish_event", { p_event_id: EVENT_ID });
    expect(mocks.refreshedEventResponse).toHaveBeenCalledWith(supabase, EVENT_ID);
    expect(response.status).toBe(200);
  });

  it("routes publish RPC errors to the mutation error response", async () => {
    const rpcError = { code: "23514", message: "invalid state", details: "", hint: "" };
    const { supabase } = createSupabase(null, rpcError);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await publishEvent(new Request("http://localhost") as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(mocks.birthGivingMutationErrorResponse).toHaveBeenCalledWith(
      rpcError,
      supabase,
      EVENT_ID,
    );
    expect(response.status).toBe(409);
  });

  it("creates a team through birth_giving_create_team with the exact member set", async () => {
    const { rpc, supabase } = createSupabase(TEAM_ID);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await createTeam(request({ name: "Tým Aurora", memberProfileIds: [PROFILE_ID] }) as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(rpc).toHaveBeenCalledWith("birth_giving_create_team", {
      p_event_id: EVENT_ID,
      p_name: "Tým Aurora",
      p_member_profile_ids: [PROFILE_ID],
    });
    expect(mocks.refreshedEventResponse).toHaveBeenCalledWith(supabase, EVENT_ID, 201);
    expect(response.status).toBe(200);
  });

  it("creates a solo team with an empty member list", async () => {
    const { rpc, supabase } = createSupabase(TEAM_ID);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await createTeam(request({ name: "Sólo", memberProfileIds: [] }) as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(rpc).toHaveBeenCalledWith("birth_giving_create_team", {
      p_event_id: EVENT_ID,
      p_name: "Sólo",
      p_member_profile_ids: [],
    });
    expect(response.status).toBe(200);
  });

  it("does not treat a missing team create RPC result as success", async () => {
    const { supabase } = createSupabase(null);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await createTeam(request({ name: "Tým Aurora", memberProfileIds: [] }) as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(response.status).toBe(500);
    expect(mocks.refreshedEventResponse).not.toHaveBeenCalled();
  });

  it("updates a team through birth_giving_update_team keeping omitted fields null", async () => {
    const { rpc, supabase } = createSupabase();
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await updateTeam(request({ isWinner: true }, "PATCH") as never, {
      params: Promise.resolve({ eventId: EVENT_ID, teamId: TEAM_ID }),
    });

    expect(rpc).toHaveBeenCalledWith("birth_giving_update_team", {
      p_event_id: EVENT_ID,
      p_team_id: TEAM_ID,
      p_name: null,
      p_member_profile_ids: null,
      p_is_winner: true,
    });
    expect(mocks.refreshedEventResponse).toHaveBeenCalledWith(supabase, EVENT_ID);
    expect(response.status).toBe(200);
  });

  it("deletes a team through birth_giving_delete_team", async () => {
    const { rpc, supabase } = createSupabase();
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await deleteTeam(new Request("http://localhost") as never, {
      params: Promise.resolve({ eventId: EVENT_ID, teamId: TEAM_ID }),
    });

    expect(rpc).toHaveBeenCalledWith("birth_giving_delete_team", {
      p_event_id: EVENT_ID,
      p_team_id: TEAM_ID,
    });
    expect(mocks.refreshedEventResponse).toHaveBeenCalledWith(supabase, EVENT_ID);
    expect(response.status).toBe(200);
  });

  it("saves a reflection through birth_giving_upsert_reflection", async () => {
    const { rpc, supabase } = createSupabase();
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await saveReflection(
      request({ contribution: " Kódování ", learning: " Testování " }, "PUT") as never,
      { params: Promise.resolve({ eventId: EVENT_ID }) },
    );

    expect(rpc).toHaveBeenCalledWith("birth_giving_upsert_reflection", {
      p_event_id: EVENT_ID,
      p_contribution: "Kódování",
      p_learning: "Testování",
    });
    expect(mocks.refreshedEventResponse).toHaveBeenCalledWith(supabase, EVENT_ID);
    expect(response.status).toBe(200);
  });
});
