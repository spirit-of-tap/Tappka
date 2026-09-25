import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

import {
  getAuthorsApprovedBookPoints,
  getEssayViewers,
  getEssayVoters,
  getTeamBookPointsStats,
  getUserBookPointsStats,
  matchesResolvedPointsBucket,
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

  not(column: string, operator: string, value: unknown): this {
    this.calls.push({ method: "not", args: [column, operator, value] });
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

  then<T>(onFulfilled: (result: { data: unknown; error: unknown; count: unknown }) => T): Promise<T> {
    return Promise.resolve(onFulfilled({ data: this.data, error: this.error, count: this.count }));
  }
}

function fakeSupabase(queues: Record<string, { data?: unknown; error?: unknown; count?: unknown }[]>) {
  const client = {
    from(table: string) {
      const entry = queues[table]?.shift() ?? {};
      return new FakeChain(entry.data, entry.error, entry.count);
    },
  };
  return client as unknown as SupabaseClient<Database>;
}

describe("getUserBookPointsStats", () => {
  it("uses frozen_book_points over the book's live book_points when set", async () => {
    const client = fakeSupabase({
      essays: [
        {
          data: [
            {
              book_id: "book-1",
              frozen_book_points: "2.00",
              published_at: "2026-08-01T00:00:00Z",
              books: { book_points: "0.00", list_status: "shortlist" },
            },
          ],
        },
        { data: [] }, // content_source essays (none)
        { count: 1 }, // essay_count
      ],
    });

    const result = await getUserBookPointsStats(client, "profile-1");

    expect(result.approved_points).toBe(2);
  });

  it("falls back to live book_points when frozen_book_points is null", async () => {
    const client = fakeSupabase({
      essays: [
        {
          data: [
            {
              book_id: "book-1",
              frozen_book_points: null,
              published_at: "2026-09-05T00:00:00Z",
              books: { book_points: "3.00", list_status: "shortlist" },
            },
          ],
        },
        { data: [] },
        { count: 1 },
      ],
    });

    const result = await getUserBookPointsStats(client, "profile-1");

    expect(result.approved_points).toBe(3);
  });

  it("credits the same book only once, using the earliest essay's value regardless of row order", async () => {
    const client = fakeSupabase({
      essays: [
        {
          // Later essay (higher points, post-cutover) returned FIRST — must not win.
          data: [
            {
              book_id: "book-1",
              frozen_book_points: null,
              published_at: "2026-09-10T00:00:00Z",
              books: { book_points: "3.00", list_status: "shortlist" },
            },
            {
              book_id: "book-1",
              frozen_book_points: "1.00",
              published_at: "2026-08-01T00:00:00Z",
              books: { book_points: "3.00", list_status: "shortlist" },
            },
          ],
        },
        { data: [] },
        { count: 2 },
      ],
    });

    const result = await getUserBookPointsStats(client, "profile-1");

    expect(result.approved_points).toBe(1);
  });

  it("counts a frozen essay even when its book is now archived — earned credit is immune to later archival", async () => {
    const client = fakeSupabase({
      essays: [
        {
          data: [
            {
              book_id: "book-1",
              frozen_book_points: "2.00",
              published_at: "2026-08-01T00:00:00Z",
              books: { book_points: "0.00", list_status: "archived" },
            },
          ],
        },
        { data: [] },
        { count: 1 },
      ],
    });

    const result = await getUserBookPointsStats(client, "profile-1");

    expect(result.approved_points).toBe(2);
  });

  it("still zeroes a live (unfrozen) essay when its book is archived", async () => {
    const client = fakeSupabase({
      essays: [
        {
          data: [
            {
              book_id: "book-1",
              frozen_book_points: null,
              published_at: "2026-09-05T00:00:00Z",
              books: { book_points: "3.00", list_status: "archived" },
            },
          ],
        },
        { data: [] },
        { count: 1 },
      ],
    });

    const result = await getUserBookPointsStats(client, "profile-1");

    expect(result.approved_points).toBe(0);
  });

  it("counts a frozen essay with no book_id at all — the old-system book was never imported", async () => {
    const client = fakeSupabase({
      essays: [
        { data: [] }, // book essays (none)
        { data: [] }, // content-source essays (none)
        {
          data: [{ id: "essay-1", frozen_book_points: "2.00", published_at: "2026-08-01T00:00:00Z" }],
        },
        { count: 1 },
      ],
    });

    const result = await getUserBookPointsStats(client, "profile-1");

    expect(result.approved_points).toBe(2);
  });
});

describe("getAuthorsApprovedBookPoints", () => {
  it("credits the earliest essay's value per (author, book) when rows are out of order", async () => {
    const client = fakeSupabase({
      essays: [
        {
          data: [
            {
              author_profile_id: "author-1",
              book_id: "book-1",
              frozen_book_points: null,
              published_at: "2026-09-10T00:00:00Z",
              books: { book_points: "3.00", list_status: "shortlist" },
            },
            {
              author_profile_id: "author-1",
              book_id: "book-1",
              frozen_book_points: "1.00",
              published_at: "2026-08-01T00:00:00Z",
              books: { book_points: "3.00", list_status: "shortlist" },
            },
          ],
        },
        { data: [] },
      ],
    });

    const result = await getAuthorsApprovedBookPoints(client, ["author-1"]);

    expect(result["author-1"]).toBe(1);
  });

  it("falls back to live book_points when frozen_book_points is null (post-cutover essay)", async () => {
    const client = fakeSupabase({
      essays: [
        {
          data: [
            {
              author_profile_id: "author-1",
              book_id: "book-1",
              frozen_book_points: null,
              published_at: "2026-09-05T00:00:00Z",
              books: { book_points: "3.00", list_status: "shortlist" },
            },
          ],
        },
        { data: [] },
      ],
    });

    const result = await getAuthorsApprovedBookPoints(client, ["author-1"]);

    expect(result["author-1"]).toBe(3);
  });

  it("counts a frozen essay with no book_id at all — the old-system book was never imported", async () => {
    const client = fakeSupabase({
      essays: [
        { data: [] }, // book essays (none)
        { data: [] }, // content-source essays (none)
        {
          data: [{ id: "essay-1", author_profile_id: "author-1", frozen_book_points: "2.00" }],
        },
      ],
    });

    const result = await getAuthorsApprovedBookPoints(client, ["author-1"]);

    expect(result["author-1"]).toBe(2);
  });
});

describe("matchesResolvedPointsBucket", () => {
  it("matches exact 1/2/3 buckets and nothing else", () => {
    expect(matchesResolvedPointsBucket(2, "2")).toBe(true);
    expect(matchesResolvedPointsBucket(1, "2")).toBe(false);
    expect(matchesResolvedPointsBucket(3, "2")).toBe(false);
    expect(matchesResolvedPointsBucket(0, "2")).toBe(false);
    expect(matchesResolvedPointsBucket(0.33, "2")).toBe(false);
  });

  it("buckets 0, fractional and other non-1/2/3 values under '0'", () => {
    expect(matchesResolvedPointsBucket(0, "0")).toBe(true);
    expect(matchesResolvedPointsBucket(0.33, "0")).toBe(true);
    expect(matchesResolvedPointsBucket(1, "0")).toBe(false);
    expect(matchesResolvedPointsBucket(2, "0")).toBe(false);
    expect(matchesResolvedPointsBucket(3, "0")).toBe(false);
  });
});

describe("getTeamBookPointsStats", () => {
  it("credits the earliest essay's frozen value per (profile, book)", async () => {
    const client = fakeSupabase({
      profiles: [{ data: [{ id: "profile-1", name: "Test Student", picture: null }] }],
      essays: [
        {
          data: [
            {
              author_profile_id: "profile-1",
              book_id: "book-1",
              frozen_book_points: null,
              published_at: "2026-09-10T00:00:00Z",
              books: { book_points: "3.00", list_status: "shortlist" },
            },
            {
              author_profile_id: "profile-1",
              book_id: "book-1",
              frozen_book_points: "1.00",
              published_at: "2026-08-01T00:00:00Z",
              books: { book_points: "3.00", list_status: "shortlist" },
            },
          ],
        },
        { data: [] },
      ],
    });

    const result = await getTeamBookPointsStats(client, "team-1");

    expect(result).toEqual([
      { profile: { id: "profile-1", name: "Test Student", picture: null }, approved_points: 1, pending_points: 0 },
    ]);
  });

  it("falls back to live book_points when frozen_book_points is null (post-cutover essay)", async () => {
    const client = fakeSupabase({
      profiles: [{ data: [{ id: "profile-1", name: "Test Student", picture: null }] }],
      essays: [
        {
          data: [
            {
              author_profile_id: "profile-1",
              book_id: "book-1",
              frozen_book_points: null,
              published_at: "2026-09-05T00:00:00Z",
              books: { book_points: "3.00", list_status: "shortlist" },
            },
          ],
        },
        { data: [] },
      ],
    });

    const result = await getTeamBookPointsStats(client, "team-1");

    expect(result).toEqual([
      { profile: { id: "profile-1", name: "Test Student", picture: null }, approved_points: 3, pending_points: 0 },
    ]);
  });

  it("counts an approved source-only essay (no book) toward approved_points", async () => {
    const client = fakeSupabase({
      profiles: [{ data: [{ id: "profile-1", name: "Test Student", picture: null }] }],
      essays: [
        { data: [] }, // book essays (none)
        {
          data: [
            {
              author_profile_id: "profile-1",
              content_source_id: "cs-1",
              content_sources: { points: 2, status: "approved" },
            },
          ],
        },
      ],
    });

    const result = await getTeamBookPointsStats(client, "team-1");

    expect(result).toEqual([
      { profile: { id: "profile-1", name: "Test Student", picture: null }, approved_points: 2, pending_points: 0 },
    ]);
  });

  it("counts a pending_review source-only essay toward pending_points, not approved_points", async () => {
    const client = fakeSupabase({
      profiles: [{ data: [{ id: "profile-1", name: "Test Student", picture: null }] }],
      essays: [
        { data: [] }, // book essays (none)
        {
          data: [
            {
              author_profile_id: "profile-1",
              content_source_id: "cs-1",
              content_sources: { points: 2, status: "pending_review" },
            },
          ],
        },
      ],
    });

    const result = await getTeamBookPointsStats(client, "team-1");

    expect(result).toEqual([
      { profile: { id: "profile-1", name: "Test Student", picture: null }, approved_points: 0, pending_points: 1 },
    ]);
  });

  it("counts a frozen essay with no book_id at all — the old-system book was never imported", async () => {
    const client = fakeSupabase({
      profiles: [{ data: [{ id: "profile-1", name: "Test Student", picture: null }] }],
      essays: [
        { data: [] }, // book essays (none)
        { data: [] }, // content-source essays (none)
        {
          data: [{ id: "essay-1", author_profile_id: "profile-1", frozen_book_points: "2.00" }],
        },
      ],
    });

    const result = await getTeamBookPointsStats(client, "team-1");

    expect(result).toEqual([
      { profile: { id: "profile-1", name: "Test Student", picture: null }, approved_points: 2, pending_points: 0 },
    ]);
  });
});

describe("getEssayViewers", () => {
  it("fetches essay viewers and normalizes team object", async () => {
    const mockViewers = [
      {
        viewer_profile_id: "viewer-1",
        first_viewed_at: "2026-09-20T10:00:00Z",
        last_viewed_at: "2026-09-24T12:00:00Z",
        viewer: {
          id: "viewer-1",
          name: "Viewer One",
          picture: null,
          role: "student",
          team: [{ id: "team-1", name: "Alpha Team" }],
        },
      },
    ];

    const client = fakeSupabase({
      essay_views: [{ data: mockViewers }],
    });

    const result = await getEssayViewers(client, "essay-123");

    expect(result).toEqual([
      {
        viewer_profile_id: "viewer-1",
        first_viewed_at: "2026-09-20T10:00:00Z",
        last_viewed_at: "2026-09-24T12:00:00Z",
        viewer: {
          id: "viewer-1",
          name: "Viewer One",
          picture: null,
          role: "student",
          team: { id: "team-1", name: "Alpha Team" },
        },
      },
    ]);
  });

  it("handles empty viewers list", async () => {
    const client = fakeSupabase({
      essay_views: [{ data: [] }],
    });

    const result = await getEssayViewers(client, "essay-123");
    expect(result).toEqual([]);
  });
});

describe("getEssayVoters", () => {
  it("fetches essay voters and normalizes team object", async () => {
    const mockVoters = [
      {
        voter_profile_id: "voter-1",
        created_at: "2026-09-23T15:00:00Z",
        voter: {
          id: "voter-1",
          name: "Voter One",
          picture: null,
          role: "coach",
          team: { id: "team-2", name: "Beta Team" },
        },
      },
    ];

    const client = fakeSupabase({
      essay_votes: [{ data: mockVoters }],
    });

    const result = await getEssayVoters(client, "essay-123");

    expect(result).toEqual([
      {
        voter_profile_id: "voter-1",
        created_at: "2026-09-23T15:00:00Z",
        voter: {
          id: "voter-1",
          name: "Voter One",
          picture: null,
          role: "coach",
          team: { id: "team-2", name: "Beta Team" },
        },
      },
    ]);
  });

  it("handles empty voters list", async () => {
    const client = fakeSupabase({
      essay_votes: [{ data: [] }],
    });

    const result = await getEssayVoters(client, "essay-123");
    expect(result).toEqual([]);
  });
});

