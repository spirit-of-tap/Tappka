import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  birthGivingMutationErrorResponse: vi.fn(),
  refreshedEventResponse: vi.fn(),
  requireBirthGivingApiContext: vi.fn(),
}));

vi.mock("@/app/api/birth-giving/_shared", () => ({
  birthGivingMutationErrorResponse: mocks.birthGivingMutationErrorResponse,
  isBirthGivingApiGateFailure: () => false,
  refreshedEventResponse: mocks.refreshedEventResponse,
  requireBirthGivingApiContext: mocks.requireBirthGivingApiContext,
  validateBirthGivingRouteIds: () => null,
}));

import { POST } from "@/app/api/birth-giving/proposals/[proposalId]/[action]/route";

const PROPOSAL_ID = "00000000-0000-4000-8000-000000000001";
const VISIBLE_EVENT_ID = "00000000-0000-4000-8000-000000000002";
const RPC_EVENT_ID = "00000000-0000-4000-8000-000000000003";
const ERROR_RESPONSE = new Response(null, { status: 409 });
const SUCCESS_RESPONSE = new Response(null, { status: 200 });

interface SupabaseFixtureOptions {
  preReadData: { event_id: string } | null;
  preReadError?: { message: string } | null;
  rpcData?: string | null;
  rpcError?: { code: string; message: string } | null;
}

function createSupabaseFixture({
  preReadData,
  preReadError = null,
  rpcData = null,
  rpcError = null,
}: SupabaseFixtureOptions) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: preReadData, error: preReadError });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn().mockResolvedValue({ data: rpcData, error: rpcError });
  const supabase = { from, rpc };

  return { eq, from, maybeSingle, rpc, select, supabase };
}

describe("Birth Giving proposal action route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.birthGivingMutationErrorResponse.mockResolvedValue(ERROR_RESPONSE);
    mocks.refreshedEventResponse.mockResolvedValue(SUCCESS_RESPONSE);
  });

  it("passes an RLS-visible event ID to canonical error refresh", async () => {
    const fixture = createSupabaseFixture({
      preReadData: { event_id: VISIBLE_EVENT_ID },
      rpcError: { code: "55000", message: "Proposal is missing or already resolved" },
    });
    mocks.requireBirthGivingApiContext.mockResolvedValue({ supabase: fixture.supabase });

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ proposalId: PROPOSAL_ID, action: "accept" }),
    });

    expect(fixture.from).toHaveBeenCalledWith("birth_giving_team_proposals");
    expect(fixture.select).toHaveBeenCalledWith("event_id");
    expect(fixture.eq).toHaveBeenCalledWith("id", PROPOSAL_ID);
    expect(fixture.maybeSingle).toHaveBeenCalledOnce();
    expect(mocks.birthGivingMutationErrorResponse).toHaveBeenCalledWith(
      { code: "55000", message: "Proposal is missing or already resolved" },
      fixture.supabase,
      VISIBLE_EVENT_ID,
    );
    expect(response).toBe(ERROR_RESPONSE);
  });

  it("continues to the RPC when the optional pre-read cannot see the proposal", async () => {
    const rpcError = { code: "55000", message: "Proposal is missing or already resolved" };
    const fixture = createSupabaseFixture({
      preReadData: null,
      preReadError: { message: "not visible" },
      rpcError,
    });
    mocks.requireBirthGivingApiContext.mockResolvedValue({ supabase: fixture.supabase });

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ proposalId: PROPOSAL_ID, action: "reject" }),
    });

    expect(fixture.rpc).toHaveBeenCalledWith("birth_giving_resolve_proposal", {
      p_action: "reject",
      p_proposal_id: PROPOSAL_ID,
    });
    expect(mocks.birthGivingMutationErrorResponse).toHaveBeenCalledWith(
      rpcError,
      fixture.supabase,
      undefined,
    );
    expect(response).toBe(ERROR_RESPONSE);
  });

  it("refreshes the event ID returned by a successful RPC", async () => {
    const fixture = createSupabaseFixture({
      preReadData: { event_id: VISIBLE_EVENT_ID },
      rpcData: RPC_EVENT_ID,
    });
    mocks.requireBirthGivingApiContext.mockResolvedValue({ supabase: fixture.supabase });

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ proposalId: PROPOSAL_ID, action: "cancel" }),
    });

    expect(mocks.refreshedEventResponse).toHaveBeenCalledWith(fixture.supabase, RPC_EVENT_ID);
    expect(response).toBe(SUCCESS_RESPONSE);
  });
});
