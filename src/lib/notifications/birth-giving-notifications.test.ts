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
const STARTS_AT = "2026-08-24T08:00:00.000Z"; // before the frozen "now"
const FUTURE_STARTS_AT = "2026-08-24T20:00:00.000Z";

interface FakeEventRow {
  id: string;
  name: string;
  customer: string;
  status: "draft" | "published";
  starts_at: string;
  removed_at: string | null;
  assignment_state: "none" | "missing" | "present";
  assignment_uploaded_at: string | null;
}

interface EmailMember {
  profile: { user: { verified_work_email: string | null } };
}

interface QuerySnapshot {
  selectCols: string;
  filters: Array<{ method: string; column: string; value: unknown }>;
}

interface QueryResult {
  data: unknown;
  error: null;
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
 * are recorded into `eventSnapshots` so tests can assert the filters used.
 */
function makeAdminClient(options: {
  events: Record<string, FakeEventRow | undefined>;
  members: EmailMember[];
  listRows?: Array<{ id: string }>;
}) {
  const { events, members, listRows = [] } = options;
  const eventSnapshots: QuerySnapshot[] = [];

  const resolveEvent = (snapshot: QuerySnapshot): QueryResult => {
    eventSnapshots.push(snapshot);
    if (snapshot.selectCols === "id") {
      return { data: listRows, error: null };
    }
    const idFilter = snapshot.filters.find((filter) => filter.column === "id");
    const row = idFilter ? events[idFilter.value as string] : undefined;
    return { data: row ?? null, error: null };
  };

  const resolveMembers = (): QueryResult => ({ data: members, error: null });

  return {
    from: (table: string) =>
      table === "birth_giving_team_members"
        ? new FakeQuery(resolveMembers)
        : new FakeQuery(resolveEvent),
    eventSnapshots,
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
    ...overrides,
  };
}

const members = (emails: Array<string | null>): EmailMember[] =>
  emails.map((email) => ({ profile: { user: { verified_work_email: email } } }));

const sentEmailKey = (email: string, uploadedAt = UPLOADED_AT) =>
  `bg-assignment-${EVENT_ID}-${uploadedAt}-${email}`;

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
    ["an event whose assignment is missing", dueEvent({ assignment_state: "missing", assignment_uploaded_at: null })],
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

  it("derives a different idempotency key after a replacement assignment upload", async () => {
    const admin = makeAdminClient({
      events: { [EVENT_ID]: dueEvent({ assignment_uploaded_at: REPLACEMENT_UPLOADED_AT }) },
      members: members(["user1@example.com"]),
    });
    mocks.createAdminClient.mockReturnValue(admin);

    await notifyParticipantsOfAssignment(EVENT_ID);

    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user1@example.com" }),
      expect.objectContaining({ idempotencyKey: sentEmailKey("user1@example.com", REPLACEMENT_UPLOADED_AT) }),
    );
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.not.objectContaining({ idempotencyKey: sentEmailKey("user1@example.com") }),
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