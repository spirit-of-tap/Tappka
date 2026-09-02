import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

import { getAuthorsApprovedBookPoints, getTeamBookPointsStats, getUserBookPointsStats } from "./queries";

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
});
