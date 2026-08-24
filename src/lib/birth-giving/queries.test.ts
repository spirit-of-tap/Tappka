import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

import {
  countProfileBirthGivingParticipations,
  getBirthGivingEvent,
  listBirthGivingEvents,
  listProfileBirthGivingHistory,
} from "./queries";

// Pairing guard for the Task 5 column grants: these seven assignment columns
// are revoked from authenticated and must never appear in an event projection.
const SEVEN_ASSIGNMENT_COLUMNS = [
  "assignment_state",
  "assignment_storage_path",
  "assignment_file_name",
  "assignment_mime_type",
  "assignment_file_size",
  "assignment_uploaded_at",
  "assignment_uploaded_by_profile_id",
] as const;

// The 13 columns authenticated callers may select directly (mirrors the SQL
// pairing guard in birth-giving-authorization.int.test.ts).
const THIRTEEN_SAFE_EVENT_COLUMNS = [
  "id",
  "name",
  "customer",
  "starts_at",
  "duration",
  "status",
  "organizer_profile_ids",
  "removed_at",
  "removed_by_profile_id",
  "created_at",
  "updated_at",
  "created_by_profile_id",
  "updated_by_profile_id",
] as const;

const VISIBILITY_RPC = "birth_giving_get_visible_assignment";

interface RecordedCall {
  method: string;
  args: unknown[];
}

class FakeChain {
  readonly calls: RecordedCall[] = [];
  data: unknown;
  count: unknown;
  error: unknown;

  constructor(data: unknown = [], error: unknown = null, count: unknown = null) {
    this.data = data;
    this.error = error;
    this.count = count;
  }

  select(select: string, options?: unknown): this {
    this.calls.push({ method: "select", args: [select, options] });
    return this;
  }

  eq(column: string, value: unknown): this {
    this.calls.push({ method: "eq", args: [column, value] });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.calls.push({ method: "in", args: [column, values] });
    return this;
  }

  is(column: string, value: unknown): this {
    this.calls.push({ method: "is", args: [column, value] });
    return this;
  }

  order(column: string, options?: unknown): this {
    this.calls.push({ method: "order", args: [column, options] });
    return this;
  }

  rpc(functionName: string, args?: Record<string, unknown>): this {
    this.calls.push({ method: "rpc", args: [functionName, args] });
    return this;
  }

  maybeSingle(): this {
    this.calls.push({ method: "maybeSingle", args: [] });
    return this;
  }

  then<T>(onFulfilled: (result: { data: unknown; error: unknown; count: unknown }) => T): Promise<T> {
    return Promise.resolve(onFulfilled({ data: this.data, error: this.error, count: this.count }));
  }
}

interface FakeChainEntry {
  table: string;
  chain: FakeChain;
}

function fakeSupabase(
  queues: Record<string, { data?: unknown; error?: unknown; count?: unknown }[]> = {},
) {
  const chains: FakeChainEntry[] = [];
  const rpcCalls: { functionName: string; args?: Record<string, unknown> }[] = [];
  const client = {
    from(table: string) {
      const entry = queues[table]?.shift() ?? {};
      const chain = new FakeChain(entry.data, entry.error, entry.count);
      chains.push({ table, chain });
      return chain;
    },
    rpc(functionName: string, args?: Record<string, unknown>) {
      const entry = queues[`rpc:${functionName}`]?.shift() ?? {};
      const chain = new FakeChain(entry.data, entry.error, entry.count);
      chains.push({ table: `rpc:${functionName}`, chain });
      rpcCalls.push({ functionName, args });
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, chains, rpcCalls };
}

function selectCallsOf(chains: FakeChainEntry[], tables: string[]): string[] {
  return chains
    .filter(({ table }) => tables.includes(table))
    .flatMap(({ chain }) =>
      chain.calls
        .filter((call) => call.method === "select")
        .map((call) => call.args[0] as string),
    );
}

describe("Birth Giving queries", () => {
  it("selects only the safe event columns in list, detail, and history (never the seven assignment columns)", async () => {
    // Regression guard for the Task 5 DB grants: every event projection must
    // use the 13-column safe list, because the seven assignment columns are
    // revoked from authenticated and reachable only via the visibility RPC.
    const { client, chains } = fakeSupabase();
    await listBirthGivingEvents(client);
    await getBirthGivingEvent(client, "event-1");
    await listProfileBirthGivingHistory(client, "p1");

    const eventSelects = selectCallsOf(chains, [
      "birth_giving_events",
      "birth_giving_team_members",
    ]);
    expect(eventSelects.length).toBeGreaterThanOrEqual(3);

    for (const select of eventSelects) {
      for (const column of SEVEN_ASSIGNMENT_COLUMNS) {
        expect(select).not.toContain(column);
      }
      for (const column of THIRTEEN_SAFE_EVENT_COLUMNS) {
        expect(select).toMatch(new RegExp(`\\b${column}\\b`));
      }
    }
  });

  it("listBirthGivingEvents fills redacted assignment defaults without calling the visibility RPC", async () => {
    const rawEvent: Record<string, unknown> = {
      id: "event-1",
      name: "Event 1",
      customer: "Customer A",
      starts_at: "2026-08-19T08:00:00.000Z",
      duration: "8h",
      status: "published",
      organizer_profile_ids: ["org-1"],
      removed_at: null,
      removed_by_profile_id: null,
      created_at: "2026-08-19T06:00:00.000Z",
      updated_at: "2026-08-19T06:00:00.000Z",
      created_by_profile_id: "org-1",
      updated_by_profile_id: "org-1",
      teams: [
        {
          id: "team-1",
          cancelled_at: null,
          members: [{ profile_id: "p1" }, { profile_id: "p2" }],
        },
      ],
    };

    const { client, rpcCalls } = fakeSupabase({
      birth_giving_events: [{ data: [rawEvent] }],
    });

    const result = await listBirthGivingEvents(client);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("event-1");
    expect(result[0].team_count).toBe(1);
    expect(result[0].participant_count).toBe(2);
    expect(result[0].participant_profile_ids).toEqual(["p1", "p2"]);
    expect(result[0].assignment_state).toBe("none");
    expect(result[0].assignment_storage_path).toBeNull();
    expect(result[0].assignment_file_name).toBeNull();
    expect(result[0].assignment_mime_type).toBeNull();
    expect(result[0].assignment_file_size).toBeNull();
    expect(result[0].assignment_uploaded_at).toBeNull();
    expect(result[0].assignment_uploaded_by_profile_id).toBeNull();
    expect(rpcCalls).toHaveLength(0);
  });

  it("getBirthGivingEvent calls the visibility RPC once and merges the returned assignment row", async () => {
    const rawEvent: Record<string, unknown> = {
      id: "event-1",
      name: "Event 1",
      customer: "Customer A",
      starts_at: "2026-08-19T08:00:00.000Z",
      duration: "8h",
      status: "published",
      organizer_profile_ids: ["org-1"],
      removed_at: null,
      removed_by_profile_id: null,
      created_at: "2026-08-19T06:00:00.000Z",
      updated_at: "2026-08-19T06:00:00.000Z",
      created_by_profile_id: "org-1",
      updated_by_profile_id: "org-1",
      teams: [
        {
          id: "team-1",
          event_id: "event-1",
          name: "Team A",
          is_winner: true,
          result_state: "present",
          result_files: [],
          cancelled_at: null,
          cancellation_reason: null,
          created_at: "2026-08-19T06:30:00.000Z",
          updated_at: "2026-08-19T06:30:00.000Z",
          created_by_profile_id: "org-1",
          updated_by_profile_id: "org-1",
          members: [
            {
              id: "m1",
              event_id: "event-1",
              team_id: "team-1",
              profile_id: "p1",
              confirmed_at: "2026-08-19T08:00:00.000Z",
              reflection_contribution: "Contribution",
              reflection_learning: "Learning",
              reflection_submitted_at: "2026-08-19T09:00:00.000Z",
              profile: { id: "p1", name: "Participant 1", picture: null },
            },
          ],
        },
      ],
    };

    const assignmentRow = {
      assignment_state: "present",
      assignment_storage_path: "birth-giving/assignments/event-1/zadani.pdf",
      assignment_file_name: "zadani.pdf",
      assignment_mime_type: "application/pdf",
      assignment_file_size: "2048",
      assignment_uploaded_at: "2026-08-19T09:00:00.000Z",
      assignment_uploaded_by_profile_id: "org-1",
    };

    const { client, rpcCalls } = fakeSupabase({
      birth_giving_events: [{ data: rawEvent }],
      profiles: [{ data: [{ id: "org-1", name: "Organizer", picture: null }] }],
      [`rpc:${VISIBILITY_RPC}`]: [{ data: [assignmentRow] }],
    });

    const result = await getBirthGivingEvent(client, "event-1");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("event-1");
    expect(result?.teams[0].is_winner).toBe(true);
    expect(result?.teams[0].members[0].reflection_contribution).toBe("Contribution");
    expect(result?.organizers).toEqual([{ id: "org-1", name: "Organizer", picture: null }]);
    expect(result?.assignment_state).toBe("present");
    expect(result?.assignment_storage_path).toBe(
      "birth-giving/assignments/event-1/zadani.pdf",
    );
    expect(result?.assignment_file_name).toBe("zadani.pdf");
    expect(result?.assignment_mime_type).toBe("application/pdf");
    expect(result?.assignment_file_size).toBe(2048);
    expect(result?.assignment_uploaded_at).toBe("2026-08-19T09:00:00.000Z");
    expect(result?.assignment_uploaded_by_profile_id).toBe("org-1");
    expect(rpcCalls).toEqual([{ functionName: VISIBILITY_RPC, args: { p_event_id: "event-1" } }]);
  });

  it("getBirthGivingEvent falls back to redacted 'none' assignment fields when the RPC returns no row", async () => {
    const rawEvent: Record<string, unknown> = {
      id: "event-1",
      name: "Event 1",
      customer: "Customer A",
      starts_at: "2026-08-19T08:00:00.000Z",
      duration: "8h",
      status: "published",
      organizer_profile_ids: ["org-1"],
      removed_at: null,
      removed_by_profile_id: null,
      created_at: "2026-08-19T06:00:00.000Z",
      updated_at: "2026-08-19T06:00:00.000Z",
      created_by_profile_id: "org-1",
      updated_by_profile_id: "org-1",
      teams: [],
    };

    const { client, rpcCalls } = fakeSupabase({
      birth_giving_events: [{ data: rawEvent }],
      profiles: [{ data: [] }],
      [`rpc:${VISIBILITY_RPC}`]: [{ data: [] }],
    });

    const result = await getBirthGivingEvent(client, "event-1");
    expect(result).not.toBeNull();
    expect(result?.assignment_state).toBe("none");
    expect(result?.assignment_storage_path).toBeNull();
    expect(result?.assignment_file_name).toBeNull();
    expect(result?.assignment_mime_type).toBeNull();
    expect(result?.assignment_file_size).toBeNull();
    expect(result?.assignment_uploaded_at).toBeNull();
    expect(result?.assignment_uploaded_by_profile_id).toBeNull();
    expect(rpcCalls).toHaveLength(1);
  });

  it("countProfileBirthGivingParticipations counts only valid participations (cancelled team and draft event excluded)", async () => {
    // Seeds model the rows PostgREST sees server-side; the head-count the mock
    // reports (2) is the count the server returns once the validity filters
    // asserted below are applied. Only m-valid-1 and m-valid-2 satisfy the same
    // validity predicate as listProfileBirthGivingHistory (team NOT cancelled
    // AND event published AND event NOT removed); m-cancelled has a cancelled
    // team and m-draft belongs to a draft event.
    const memberships = [
      { id: "m-valid-1", event_id: "e-valid-1" },
      { id: "m-valid-2", event_id: "e-valid-2" },
      { id: "m-cancelled", event_id: "e-cancelled" },
      { id: "m-draft", event_id: "e-draft" },
    ];

    const { client, chains } = fakeSupabase({
      birth_giving_team_members: [{ data: memberships, count: 2 }],
    });

    const count = await countProfileBirthGivingParticipations(client, "p1");
    expect(count).toBe(2);

    const memberChain = chains.find(
      ({ table }) => table === "birth_giving_team_members",
    );
    expect(memberChain).toBeDefined();
    const calls = memberChain!.chain.calls;

    // Head count with the aliased `!inner` embeds so the nested validity filters
    // resolve and force inner joins (same shape as listProfileBirthGivingHistory).
    const selectCall = calls.find((call) => call.method === "select");
    expect(selectCall).toBeDefined();
    const projection = selectCall!.args[0] as string;
    expect(projection).toContain("team:birth_giving_teams!inner");
    expect(projection).toContain("event:birth_giving_events!inner");
    expect(selectCall!.args[1]).toEqual({ count: "exact", head: true });

    expect(calls).toContainEqual({ method: "eq", args: ["profile_id", "p1"] });
    // Validity predicate shared with listProfileBirthGivingHistory.
    expect(calls).toContainEqual({ method: "is", args: ["team.cancelled_at", null] });
    expect(calls).toContainEqual({ method: "eq", args: ["team.event.status", "published"] });
    expect(calls).toContainEqual({ method: "is", args: ["team.event.removed_at", null] });
  });

  it("listProfileBirthGivingHistory returns profile participations with redacted assignment defaults and no visibility RPC", async () => {
    const rawMemberships = [
      {
        id: "m1",
        event_id: "e1",
        team_id: "t1",
        profile_id: "p1",
        confirmed_at: "2026-08-19T08:00:00.000Z",
        reflection_contribution: null,
        reflection_learning: null,
        reflection_submitted_at: null,
        team: {
          id: "t1",
          name: "Team 1",
          is_winner: true,
          cancelled_at: null,
          event: {
            id: "e1",
            name: "Event 1",
            customer: "Customer 1",
            starts_at: "2026-08-19T08:00:00.000Z",
            duration: "8h",
            status: "published",
            organizer_profile_ids: ["org-1"],
            removed_at: null,
            removed_by_profile_id: null,
            created_at: "2026-08-19T06:00:00.000Z",
            updated_at: "2026-08-19T06:00:00.000Z",
            created_by_profile_id: "org-1",
            updated_by_profile_id: "org-1",
          },
        },
      },
    ];

    const { client, rpcCalls } = fakeSupabase({
      birth_giving_team_members: [{ data: rawMemberships }],
    });

    const history = await listProfileBirthGivingHistory(client, "p1");
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe("e1");
    expect(history[0].team.is_winner).toBe(true);
    expect(history[0].organizers).toEqual([]);
    expect(history[0].assignment_state).toBe("none");
    expect(history[0].assignment_storage_path).toBeNull();
    expect(history[0].assignment_file_name).toBeNull();
    expect(history[0].assignment_mime_type).toBeNull();
    expect(history[0].assignment_file_size).toBeNull();
    expect(history[0].assignment_uploaded_at).toBeNull();
    expect(history[0].assignment_uploaded_by_profile_id).toBeNull();
    expect(rpcCalls).toHaveLength(0);
  });
});