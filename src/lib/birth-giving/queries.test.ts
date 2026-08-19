import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

import {
  applyBirthGivingParticipationValidityFilters,
  buildBirthGivingEventIndexWindow,
  countProfileBirthGivingParticipations,
  getBirthGivingEvent,
  listBirthGivingEvents,
  listPendingBirthGivingEventProposals,
  listProfileBirthGivingHistory,
} from "./queries";

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

  select(select: string): this {
    this.calls.push({ method: "select", args: [select] });
    return this;
  }

  eq(column: string, value: unknown): this {
    this.calls.push({ method: "eq", args: [column, value] });
    return this;
  }

  is(column: string, value: unknown): this {
    this.calls.push({ method: "is", args: [column, value] });
    return this;
  }

  not(column: string, operator: string, value: unknown): this {
    this.calls.push({ method: "not", args: [column, operator, value] });
    return this;
  }

  gte(column: string, value: unknown): this {
    this.calls.push({ method: "gte", args: [column, value] });
    return this;
  }

  lt(column: string, value: unknown): this {
    this.calls.push({ method: "lt", args: [column, value] });
    return this;
  }

  order(column: string, options?: unknown): this {
    this.calls.push({ method: "order", args: [column, options] });
    return this;
  }

  limit(count: number): this {
    this.calls.push({ method: "limit", args: [count] });
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

function fakeSupabase(
  queues: Record<string, { data?: unknown; error?: unknown; count?: unknown }[]> = {},
) {
  const chains: { table: string; chain: FakeChain }[] = [];
  const client = {
    from(table: string) {
      const entry = queues[table]?.shift() ?? {};
      const chain = new FakeChain(entry.data, entry.error, entry.count);
      chains.push({ table, chain });
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, chains };
}

function callsOf(chain: FakeChain, method: string): unknown[][] {
  return chain.calls.filter((call) => call.method === method).map((call) => call.args);
}

function selectOf(chain: FakeChain): string {
  return callsOf(chain, "select")[0][0] as string;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("applyBirthGivingParticipationValidityFilters", () => {
  it("applies every production history and count validity predicate", () => {
    const calls: string[] = [];
    const query = {
      not(column: "frozen_at", operator: "is", value: null) {
        calls.push(`not:${column}:${operator}:${String(value)}`);
        return this;
      },
      eq(
        column: "team.status" | "team.event.status",
        value: "confirmed" | "published",
      ) {
        calls.push(`eq:${column}:${value}`);
        return this;
      },
      is(column: "team.event.removed_at", value: null) {
        calls.push(`is:${column}:${String(value)}`);
        return this;
      },
    };

    expect(applyBirthGivingParticipationValidityFilters(query)).toBe(query);
    expect(calls).toEqual([
      "not:frozen_at:is:null",
      "eq:team.status:confirmed",
      "eq:team.event.status:published",
      "is:team.event.removed_at:null",
    ]);
  });
});

describe("listProfileBirthGivingHistory", () => {
  it("selects memberships with nested event, team and organizer profiles, filtered to valid participation", async () => {
    const { client, chains } = fakeSupabase();

    const items = await listProfileBirthGivingHistory(client, "profile-1");

    expect(items).toEqual([]);
    expect(chains).toHaveLength(1);
    expect(chains[0].table).toBe("birth_giving_team_members");
    const chain = chains[0].chain;

    expect(callsOf(chain, "eq")).toEqual([
      ["profile_id", "profile-1"],
      ["team.status", "confirmed"],
      ["team.event.status", "published"],
    ]);
    expect(callsOf(chain, "not")).toEqual([["frozen_at", "is", null]]);
    expect(callsOf(chain, "is")).toEqual([["team.event.removed_at", null]]);

    const select = selectOf(chain);
    expect(select).toContain("team:birth_giving_teams!inner");
    expect(select).toContain("event:birth_giving_events!inner");
    expect(select).toContain(
      "organizers:birth_giving_event_organizers(profile:profiles!birth_giving_event_organizers_profile_id_fkey(id, name, picture))",
    );
    expect(callsOf(chain, "order")).toEqual([["confirmed_at", { ascending: false }]]);
  });

  it("maps rows into profile history items with team and organizers", async () => {
    const { client } = fakeSupabase({
      birth_giving_team_members: [
        {
          data: [
            {
              id: "member-1",
              team_id: "team-1",
              profile_id: "profile-1",
              confirmed_at: "2026-08-19T07:00:00.000Z",
              frozen_at: "2026-08-19T08:00:00.000Z",
              team: {
                id: "team-1",
                name: "Tým Alfa",
                status: "confirmed",
                event: {
                  id: "event-1",
                  name: "First BG",
                  customer: "Zákazník A",
                  starts_at: "2026-08-19T08:00:00.000Z",
                  duration: "8h",
                  status: "published",
                  organizers: [
                    {
                      event_id: "event-1",
                      profile_id: "org-1",
                      profile: { id: "org-1", name: "Org One", picture: null },
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    });

    const items = await listProfileBirthGivingHistory(client, "profile-1");

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("First BG");
    expect(items[0].customer).toBe("Zákazník A");
    expect(items[0].team).toEqual({ id: "team-1", name: "Tým Alfa", status: "confirmed" });
    expect(items[0].membership.frozen_at).toBe("2026-08-19T08:00:00.000Z");
    expect(items[0].organizers).toHaveLength(1);
    expect(items[0].organizers[0].profile.name).toBe("Org One");
  });

  it("returns an empty list for an unknown profile", async () => {
    const { client } = fakeSupabase();

    const items = await listProfileBirthGivingHistory(client, "nobody");

    expect(items).toEqual([]);
  });
});

describe("countProfileBirthGivingParticipations", () => {
  it("counts only valid published participations for the profile", async () => {
    const { client, chains } = fakeSupabase({
      birth_giving_team_members: [{ data: [], count: 3 }],
    });

    const count = await countProfileBirthGivingParticipations(client, "profile-1");

    expect(count).toBe(3);
    expect(chains).toHaveLength(1);
    expect(chains[0].table).toBe("birth_giving_team_members");
    const chain = chains[0].chain;
    expect(selectOf(chain)).toContain("team:birth_giving_teams!inner(status, event:birth_giving_events!inner(status, removed_at))");
    expect(callsOf(chain, "eq")).toEqual([
      ["profile_id", "profile-1"],
      ["team.status", "confirmed"],
      ["team.event.status", "published"],
    ]);
    expect(callsOf(chain, "not")).toEqual([["frozen_at", "is", null]]);
    expect(callsOf(chain, "is")).toEqual([["team.event.removed_at", null]]);
  });
});

describe("buildBirthGivingEventIndexWindow", () => {
  it("bounds the history window to the named number of days", () => {
    const now = new Date("2026-08-19T12:00:00.000Z");

    const window = buildBirthGivingEventIndexWindow(now);

    expect(window.nowIso).toBe("2026-08-19T12:00:00.000Z");
    expect(window.historyStartIso).toBe("2026-05-21T12:00:00.000Z");
  });
});

describe("listBirthGivingEvents", () => {
  const NOW_ISO = "2026-08-19T12:00:00.000Z";

  function eventRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "event-1",
      name: "First BG",
      normalized_name: "first bg",
      customer: "Zákazník A",
      normalized_customer: "zakaznik a",
      starts_at: "2026-08-19T08:00:00.000Z",
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
      organizers: [{ profile_id: "org-1" }],
      teams: [],
      ...overrides,
    };
  }

  it("queries recent history and active upcoming events with bounded nested rows", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_ISO));
    const { client, chains } = fakeSupabase();

    await listBirthGivingEvents(client);

    expect(chains).toHaveLength(2);
    const history = chains.find(({ chain }) => callsOf(chain, "lt").length > 0)!;
    const upcoming = chains.find(({ chain }) => callsOf(chain, "lt").length === 0)!;
    expect(history.table).toBe("birth_giving_events");
    expect(upcoming.table).toBe("birth_giving_events");

    for (const { chain } of [history, upcoming]) {
      expect(callsOf(chain, "eq")).toEqual([["status", "published"]]);
      expect(callsOf(chain, "is")).toEqual([["removed_at", null]]);
      expect(selectOf(chain)).toContain(
        "members:birth_giving_team_members(profile_id, limit=50)",
      );
      expect(selectOf(chain)).toContain(
        "proposals:birth_giving_team_proposals(candidate_profile_id, state, limit=50)",
      );
    }

    expect(callsOf(history.chain, "lt")).toEqual([["starts_at", NOW_ISO]]);
    expect(callsOf(history.chain, "gte")).toEqual([
      ["starts_at", "2026-05-21T12:00:00.000Z"],
    ]);
    expect(callsOf(history.chain, "order")).toEqual([
      ["starts_at", { ascending: false }],
    ]);
    expect(callsOf(history.chain, "limit")).toEqual([[20]]);

    expect(callsOf(upcoming.chain, "lt")).toEqual([]);
    expect(callsOf(upcoming.chain, "gte")).toEqual([["starts_at", NOW_ISO]]);
    expect(callsOf(upcoming.chain, "order")).toEqual([
      ["starts_at", { ascending: true }],
    ]);
    expect(callsOf(upcoming.chain, "limit")).toEqual([[50]]);
  });

  it("derives team and participant counts from bounded rows and sorts the merge", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_ISO));
    const pastEvent = eventRow({
      id: "past-1",
      starts_at: "2026-08-10T08:00:00.000Z",
      teams: [
        {
          id: "team-1",
          status: "confirmed",
          members: [{ profile_id: "member-1" }, { profile_id: "member-2" }],
          proposals: [
            { candidate_profile_id: "candidate-1", state: "pending" },
            { candidate_profile_id: "candidate-1", state: "pending" },
            { candidate_profile_id: "candidate-2", state: "accepted" },
          ],
        },
        {
          id: "team-2",
          status: "cancelled",
          members: [{ profile_id: "ghost-1" }],
          proposals: [{ candidate_profile_id: "ghost-2", state: "pending" }],
        },
      ],
    });
    const futureEvent = eventRow({
      id: "future-1",
      starts_at: "2026-09-01T08:00:00.000Z",
    });
    const { client } = fakeSupabase({
      birth_giving_events: [{ data: [pastEvent] }, { data: [futureEvent] }],
    });

    const events = await listBirthGivingEvents(client);

    expect(events.map((event) => event.id)).toEqual(["past-1", "future-1"]);
    const past = events[0];
    expect(past.organizer_profile_ids).toEqual(["org-1"]);
    expect(past.team_count).toBe(1);
    expect(past.participant_profile_ids).toEqual(["member-1", "member-2"]);
    expect(past.pending_proposal_profile_ids).toEqual(["candidate-1"]);
    expect(past).not.toHaveProperty("teams");
    expect(past).not.toHaveProperty("organizers");
  });
});

describe("listPendingBirthGivingEventProposals", () => {
  it("filters pending proposals server-side for the given event", async () => {
    const { client, chains } = fakeSupabase();

    await listPendingBirthGivingEventProposals(client, "event-1");

    expect(chains).toHaveLength(1);
    expect(chains[0].table).toBe("birth_giving_team_proposals");
    const chain = chains[0].chain;
    expect(callsOf(chain, "eq")).toEqual([
      ["state", "pending"],
      ["team.event_id", "event-1"],
    ]);
    const select = selectOf(chain);
    expect(select).toContain("candidate:profiles!birth_giving_team_proposals_candidate_profile_id_fkey");
    expect(select).toContain("initiator:profiles!birth_giving_team_proposals_initiated_by_profile_id_fkey");
    expect(select).toContain("team:birth_giving_teams!inner(event_id)");
    expect(callsOf(chain, "order")).toEqual([["created_at", { ascending: true }]]);
  });
});

describe("getBirthGivingEvent", () => {
  function eventRow() {
    return {
      id: "event-1",
      name: "First BG",
      customer: "Zákazník A",
      starts_at: "2026-08-19T08:00:00.000Z",
      status: "published",
      assignment: null,
      organizers: [],
      team_searches: [],
      teams: [
        { id: "team-1", name: "Tým Alfa", status: "forming", members: [], result_files: [] },
        { id: "team-2", name: "Tým Beta", status: "forming", members: [], result_files: [] },
        { id: "team-3", name: "Tým Gama", status: "forming", members: [], result_files: [] },
      ],
    };
  }

  it("no longer embeds proposals into the detail query", async () => {
    const { client, chains } = fakeSupabase({
      birth_giving_events: [{ data: eventRow() }],
    });

    await getBirthGivingEvent(client, "event-1");

    expect(chains).toHaveLength(2);
    expect(chains[0].table).toBe("birth_giving_events");
    expect(selectOf(chains[0].chain)).not.toContain("proposals");
    expect(callsOf(chains[0].chain, "maybeSingle")).toEqual([[]]);
  });

  it("merges only pending proposals into their teams", async () => {
    const { client } = fakeSupabase({
      birth_giving_events: [{ data: eventRow() }],
      birth_giving_team_proposals: [
        {
          data: [
            {
              id: "proposal-1",
              event_id: "event-1",
              team_id: "team-1",
              candidate_profile_id: "candidate-1",
              initiated_by_profile_id: "member-1",
              direction: "join_request",
              state: "pending",
              created_at: "2026-08-19T09:00:00.000Z",
              candidate: { id: "candidate-1", name: "Candidate One", picture: null },
              initiator: { id: "member-1", name: "Member One", picture: null },
            },
            {
              id: "proposal-2",
              event_id: "event-1",
              team_id: "team-2",
              candidate_profile_id: "candidate-2",
              initiated_by_profile_id: "member-2",
              direction: "invitation",
              state: "pending",
              created_at: "2026-08-19T09:30:00.000Z",
              candidate: { id: "candidate-2", name: "Candidate Two", picture: null },
              initiator: { id: "member-2", name: "Member Two", picture: null },
            },
          ],
        },
      ],
    });

    const event = await getBirthGivingEvent(client, "event-1");

    expect(event?.teams.find((team) => team.id === "team-1")?.proposals).toEqual([
      expect.objectContaining({ id: "proposal-1" }),
    ]);
    expect(event?.teams.find((team) => team.id === "team-2")?.proposals).toEqual([
      expect.objectContaining({ id: "proposal-2" }),
    ]);
    expect(event?.teams.find((team) => team.id === "team-3")?.proposals).toEqual([]);
  });

  it("returns null when the event does not exist", async () => {
    const { client } = fakeSupabase({
      birth_giving_events: [{ data: null }],
    });

    const event = await getBirthGivingEvent(client, "missing-1");

    expect(event).toBeNull();
  });
});
