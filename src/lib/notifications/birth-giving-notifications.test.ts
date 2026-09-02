import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("./send-email", () => ({ sendEmail: mocks.sendEmail }));

import {
  assignmentReleaseEmail,
  notifyParticipantsOfAssignment,
  processBirthGiving,
} from "./birth-giving-notifications";

const EVENT_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_EVENT_ID = "00000000-0000-4000-8000-000000000002";
const UPLOADED_AT = "2026-08-24T09:00:00.000Z";
const REPLACEMENT_UPLOADED_AT = "2026-08-24T10:00:00.000Z";
const STORAGE_PATH = "/events/00000000-0000-4000-8000-000000000001/assignment.pdf";
const REPLACEMENT_STORAGE_PATH = "/events/00000000-0000-4000-8000-000000000001/assignment-v2.pdf";
const STARTS_AT = "2026-08-24T08:00:00.000Z"; // before the frozen "now"
const FUTURE_STARTS_AT = "2026-08-24T20:00:00.000Z";
const BETA_GRANTED_AT = "2026-08-01T00:00:00.000Z";

interface FakeEventRow {
  id: string;
  name: string;
  customer: string;
  status: "draft" | "published";
  starts_at: string;
  removed_at: string | null;
  assignment_state: "none" | "missing" | "present";
  assignment_uploaded_at: string | null;
  assignment_storage_path: string | null;
}

interface EmailMember {
  profile: {
    access_removed_at: string | null;
    beta_access_granted_at: string | null;
    beta_cohort?: string | null;
    user: { verified_work_email: string | null };
  };
}

interface QuerySnapshot {
  selectCols: string;
  filters: Array<{ method: string; column: string; value: unknown }>;
}

interface QueryResult {
  data: unknown;
  error: Error | null;
}

/**
 * Chainable stand-in for a single PostgREST query builder. Every chain is
 * awaitable (via `then`), and the snapshot passed to the resolver records the
 * columns and filters the query issued, so tests can assert the exact query.
 */
class FakeQuery {
  private cols = "";
  private readonly filters: QuerySnapshot["filters"] = [];

  constructor(private readonly resolve: (snapshot: QuerySnapshot) => QueryResult) {}

  select(cols: string): this {
    this.cols = cols;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ method: "eq", column, value });
    return this;
  }

  is(column: string, value: unknown): this {
    this.filters.push({ method: "is", column, value });
    return this;
  }

  lte(column: string, value: unknown): this {
    this.filters.push({ method: "lte", column, value });
    return this;
  }

  maybeSingle(): Promise<QueryResult> {
    return Promise.resolve(this.snapshotResult());
  }

  then<TResult = QueryResult, TRejected = never>(
    onfulfilled?: ((value: QueryResult) => TResult | PromiseLike<TResult>) | null,
    onrejected?: ((reason: unknown) => TRejected | PromiseLike<TRejected>) | null,
  ): Promise<TResult | TRejected> {
    return Promise.resolve(this.snapshotResult()).then(onfulfilled, onrejected);
  }

  private snapshot(): QuerySnapshot {
    return { selectCols: this.cols, filters: [...this.filters] };
  }

  private snapshotResult(): QueryResult {
    return this.resolve(this.snapshot());
  }
}

/**
 * Builds a fake admin client where every `.from(...)` chain is an independent
 * `FakeQuery`, mirroring the real PostgREST builder lifecycle. Event queries
 * are recorded into `eventSnapshots` and member queries into
 * `memberSnapshots` so tests can assert the exact columns and filters used.
 */
function makeAdminClient(options: {
  events: Record<string, FakeEventRow | undefined>;
  members: EmailMember[];
  listRows?: Array<{ id: string }>;
  eventError?: Error;
  memberError?: Error;
  listError?: Error;
}) {
  const { events, members, listRows = [], eventError, memberError, listError } = options;
  const eventSnapshots: QuerySnapshot[] = [];
  const memberSnapshots: QuerySnapshot[] = [];

  const resolveEvent = (snapshot: QuerySnapshot): QueryResult => {
    eventSnapshots.push(snapshot);
    if (snapshot.selectCols === "id") {
      return listError ? { data: null, error: listError } : { data: listRows, error: null };
    }
    if (eventError) return { data: null, error: eventError };
    const idFilter = snapshot.filters.find((filter) => filter.method === "eq" && filter.column === "id");
    const row = idFilter ? events[idFilter.value as string] : undefined;
    return { data: row ?? null, error: null };
  };

  const resolveMembers = (snapshot: QuerySnapshot): QueryResult => {
    memberSnapshots.push(snapshot);
    if (memberError) return { data: null, error: memberError };
    return { data: members, error: null };
  };

  return {
    from: (table: string) =>
      table === "birth_giving_team_members"
        ? new FakeQuery(resolveMembers)
        : new FakeQuery(resolveEvent),
    eventSnapshots,
    memberSnapshots,
  };
}

function dueEvent(overrides: Partial<FakeEventRow> = {}): FakeEventRow {
  return {
    id: EVENT_ID,
    name: "Hackathon",
    customer: "Client",
    status: "published",
    starts_at: STARTS_AT,
    removed_at: null,
    assignment_state: "present",
    assignment_uploaded_at: UPLOADED_AT,
    assignment_storage_path: STORAGE_PATH,
    ...overrides,
  };
}

const activeMember = (email: string | null): EmailMember => ({
  profile: {
    access_removed_at: null,
    beta_access_granted_at: BETA_GRANTED_AT,
    beta_cohort: "B",
    user: { verified_work_email: email },
  },
});

const members = (emails: Array<string | null>): EmailMember[] => emails.map(activeMember);

const sentEmailKey = (email: string, storagePath = STORAGE_PATH) =>
  `bg-assignment-${EVENT_ID}-${storagePath}-${email}`;

describe("Birth Giving notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T12:00:00.000Z"));
    process.env.APP_URL = "https://canonical.example";
    mocks.sendEmail.mockResolvedValue({ id: "email-1" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("escapes dynamic release content and links to event URL", () => {
    const content = assignmentReleaseEmail({
      eventName: 'Akce <script> "x"',
      customer: "Klient & partner",
      eventUrl: "https://canonical.example/birth-giving/event-id",
    });

    expect(content.subject).toContain("Zadání je dostupné");
    expect(content.html).toContain("Akce &lt;script&gt; &quot;x&quot;");
    expect(content.html).toContain("Klient &amp; partner");
    expect(content.html).toContain('href="https://canonical.example/birth-giving/event-id"');
  });

  it("sends to current members of a published, due event with a present assignment", async () => {
    const admin = makeAdminClient({
      events: { [EVENT_ID]: dueEvent() },
      members: members(["user1@example.com", "user2@example.com", null]),
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const sent = await notifyParticipantsOfAssignment(EVENT_ID);

    expect(sent).toBe(2);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user1@example.com",
        subject: expect.stringContaining("Hackathon"),
      }),
      expect.objectContaining({ idempotencyKey: sentEmailKey("user1@example.com") }),
    );
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user2@example.com" }),
      expect.objectContaining({ idempotencyKey: sentEmailKey("user2@example.com") }),
    );
  });

  it.each([
    ["a draft event", dueEvent({ status: "draft" })],
    ["a future event", dueEvent({ starts_at: FUTURE_STARTS_AT })],
    ["a removed event", dueEvent({ removed_at: "2026-08-24T11:00:00.000Z" })],
    [
      "an event whose assignment is missing",
      dueEvent({
        assignment_state: "missing",
        assignment_uploaded_at: null,
        assignment_storage_path: null,
      }),
    ],
  ])("sends nothing for %s", async (_label, eventRow) => {
    const admin = makeAdminClient({ events: { [EVENT_ID]: eventRow }, members: members(["user1@example.com"]) });
    mocks.createAdminClient.mockReturnValue(admin);

    const sent = await notifyParticipantsOfAssignment(EVENT_ID);

    expect(sent).toBe(0);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("sends nothing when the event does not exist", async () => {
    const admin = makeAdminClient({ events: {}, members: members(["user1@example.com"]) });
    mocks.createAdminClient.mockReturnValue(admin);

    const sent = await notifyParticipantsOfAssignment(EVENT_ID);

    expect(sent).toBe(0);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("queries members through the profile FK hint to disambiguate the embed", async () => {
    const admin = makeAdminClient({
      events: { [EVENT_ID]: dueEvent() },
      members: members(["user1@example.com"]),
    });
    mocks.createAdminClient.mockReturnValue(admin);

    await notifyParticipantsOfAssignment(EVENT_ID);

    expect(admin.memberSnapshots[0].selectCols).toBe(
      "profile:profiles!birth_giving_team_members_profile_id_fkey!inner(access_removed_at,beta_access_granted_at,beta_cohort,user:users!inner(verified_work_email))",
    );
    expect(admin.memberSnapshots[0].filters).toContainEqual({ method: "eq", column: "event_id", value: EVENT_ID });
  });

  it("bases the idempotency key on the stable storage path, not the rotating upload timestamp", async () => {
    // Re-confirming the same object (retry/double-submit) rotates
    // assignment_uploaded_at via the RPC but leaves the storage path unchanged,
    // so the provider idempotency key must stay the same to avoid duplicates.
    const admin = makeAdminClient({
      events: { [EVENT_ID]: dueEvent({ assignment_uploaded_at: REPLACEMENT_UPLOADED_AT }) },
      members: members(["user1@example.com"]),
    });
    mocks.createAdminClient.mockReturnValue(admin);

    await notifyParticipantsOfAssignment(EVENT_ID);

    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user1@example.com" }),
      expect.objectContaining({ idempotencyKey: sentEmailKey("user1@example.com") }),
    );
  });

  it("derives a new idempotency key after a replacement assignment upload", async () => {
    const admin = makeAdminClient({
      events: { [EVENT_ID]: dueEvent({ assignment_storage_path: REPLACEMENT_STORAGE_PATH }) },
      members: members(["user1@example.com"]),
    });
    mocks.createAdminClient.mockReturnValue(admin);

    await notifyParticipantsOfAssignment(EVENT_ID);

    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user1@example.com" }),
      expect.objectContaining({ idempotencyKey: sentEmailKey("user1@example.com", REPLACEMENT_STORAGE_PATH) }),
    );
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.not.objectContaining({ idempotencyKey: sentEmailKey("user1@example.com") }),
    );
  });

  it("skips members whose profile is not active (access removed or beta access not granted)", async () => {
    const admin = makeAdminClient({
      events: { [EVENT_ID]: dueEvent() },
      members: [
        {
          profile: {
            access_removed_at: "2026-08-24T10:00:00.000Z",
            beta_access_granted_at: BETA_GRANTED_AT,
            beta_cohort: "B",
            user: { verified_work_email: "gone@example.com" },
          },
        },
        {
          profile: {
            access_removed_at: null,
            beta_access_granted_at: null,
            beta_cohort: "B",
            user: { verified_work_email: "no-beta@example.com" },
          },
        },
        {
          profile: {
            access_removed_at: null,
            beta_access_granted_at: BETA_GRANTED_AT,
            beta_cohort: "A",
            user: { verified_work_email: "cohort-a@example.com" },
          },
        },
        activeMember("active@example.com"),
      ],
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const sent = await notifyParticipantsOfAssignment(EVENT_ID);

    expect(sent).toBe(1);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "active@example.com" }),
      expect.objectContaining({ idempotencyKey: sentEmailKey("active@example.com") }),
    );
  });

  it("keeps sending to the remaining recipients when one send fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const admin = makeAdminClient({
      events: { [EVENT_ID]: dueEvent() },
      members: members(["user1@example.com", "user2@example.com", "user3@example.com"]),
    });
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.sendEmail
      .mockRejectedValueOnce(new Error("provider down"))
      .mockResolvedValueOnce({ id: "email-2" })
      .mockResolvedValueOnce({ id: "email-3" });

    const sent = await notifyParticipantsOfAssignment(EVENT_ID);

    expect(sent).toBe(2);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(3);
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user2@example.com" }),
      expect.objectContaining({ idempotencyKey: sentEmailKey("user2@example.com") }),
    );
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user3@example.com" }),
      expect.objectContaining({ idempotencyKey: sentEmailKey("user3@example.com") }),
    );
    errorSpy.mockRestore();
  });

  it("throws when the event query fails instead of silently sending nothing", async () => {
    const admin = makeAdminClient({
      events: {},
      members: [],
      eventError: new Error("event query down"),
    });
    mocks.createAdminClient.mockReturnValue(admin);

    await expect(notifyParticipantsOfAssignment(EVENT_ID)).rejects.toThrow("event query down");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("throws when the members query fails instead of silently sending nothing", async () => {
    const admin = makeAdminClient({
      events: { [EVENT_ID]: dueEvent() },
      members: [],
      memberError: new Error("members query down"),
    });
    mocks.createAdminClient.mockReturnValue(admin);

    await expect(notifyParticipantsOfAssignment(EVENT_ID)).rejects.toThrow("members query down");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("counts sends from due events and queries only published, non-removed, present events up to now", async () => {
    const admin = makeAdminClient({
      events: {
        [EVENT_ID]: dueEvent(),
        [OTHER_EVENT_ID]: dueEvent({ id: OTHER_EVENT_ID, name: "Second" }),
      },
      members: members(["user1@example.com"]),
      listRows: [{ id: EVENT_ID }, { id: OTHER_EVENT_ID }],
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const result = await processBirthGiving();

    expect(result).toEqual({ sent: 2 });
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);

    const listSnapshot = admin.eventSnapshots.find((r) => r.selectCols === "id");
    expect(listSnapshot?.filters).toContainEqual({ method: "eq", column: "status", value: "published" });
    expect(listSnapshot?.filters).toContainEqual({ method: "is", column: "removed_at", value: null });
    expect(listSnapshot?.filters).toContainEqual({ method: "eq", column: "assignment_state", value: "present" });
    expect(listSnapshot?.filters).toContainEqual({
      method: "lte",
      column: "starts_at",
      value: "2026-08-24T12:00:00.000Z",
    });
  });

  it("throws when the cron enumeration query fails instead of reporting a false success", async () => {
    const admin = makeAdminClient({
      events: {},
      members: [],
      listError: new Error("list query down"),
    });
    mocks.createAdminClient.mockReturnValue(admin);

    await expect(processBirthGiving()).rejects.toThrow("list query down");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("does not count sends for events that are due in the query but not yet released", async () => {
    const admin = makeAdminClient({
      events: {
        [EVENT_ID]: dueEvent(),
        [OTHER_EVENT_ID]: dueEvent({ id: OTHER_EVENT_ID, starts_at: FUTURE_STARTS_AT }),
      },
      members: members(["user1@example.com"]),
      listRows: [{ id: EVENT_ID }, { id: OTHER_EVENT_ID }],
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const result = await processBirthGiving();

    expect(result).toEqual({ sent: 1 });
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user1@example.com" }),
      expect.objectContaining({ idempotencyKey: sentEmailKey("user1@example.com") }),
    );
  });
});
