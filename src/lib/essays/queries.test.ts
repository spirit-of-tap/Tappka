import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

import {
  collectPagedResults,
  getAllEssays,
  getAuthorsApprovedBookPoints,
  getEssayViewers,
  getEssayVoters,
  getTeamBookPointsStats,
  getUserBookPointsStats,
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

  range(from: number, to: number): this {
    this.calls.push({ method: "range", args: [from, to] });
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
              id: "essay-1",
              book_id: "book-1",
              frozen_book_points: "2.00",
              published_at: "2026-08-01T00:00:00Z",
              books: { book_points: "0.00", list_status: "shortlist" },
            },
          ],
        },
        { data: [] }, // content_source essays (none)
        { data: [] }, // orphan frozen essays (none)
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
              id: "essay-1",
              book_id: "book-1",
              frozen_book_points: null,
              published_at: "2026-09-05T00:00:00Z",
              books: { book_points: "3.00", list_status: "shortlist" },
            },
          ],
        },
        { data: [] },
        { data: [] },
        { count: 1 },
      ],
    });

    const result = await getUserBookPointsStats(client, "profile-1");

    expect(result.approved_points).toBe(3);
  });

  it("credits the same book only once when both essays are live (unfrozen)", async () => {
    const client = fakeSupabase({
      essays: [
        {
          // Later essay (higher points) returned FIRST — must not win.
          data: [
            {
              id: "essay-late",
              book_id: "book-1",
              frozen_book_points: null,
              published_at: "2026-09-10T00:00:00Z",
              books: { book_points: "3.00", list_status: "shortlist" },
            },
            {
              id: "essay-early",
              book_id: "book-1",
              frozen_book_points: null,
              published_at: "2026-09-01T00:00:00Z",
              books: { book_points: "1.00", list_status: "shortlist" },
            },
          ],
        },
        { data: [] },
        { data: [] },
        { count: 2 },
      ],
    });

    const result = await getUserBookPointsStats(client, "profile-1");

    expect(result.approved_points).toBe(1);
  });

  it("counts a frozen essay separately from a live essay on the same book", async () => {
    const client = fakeSupabase({
      essays: [
        {
          data: [
            {
              id: "essay-live",
              book_id: "book-1",
              frozen_book_points: null,
              published_at: "2026-09-10T00:00:00Z",
              books: { book_points: "3.00", list_status: "shortlist" },
            },
            {
              id: "essay-frozen",
              book_id: "book-1",
              frozen_book_points: "1.00",
              published_at: "2026-08-01T00:00:00Z",
              books: { book_points: "3.00", list_status: "shortlist" },
            },
          ],
        },
        { data: [] },
        { data: [] },
        { count: 2 },
      ],
    });

    const result = await getUserBookPointsStats(client, "profile-1");

    expect(result.approved_points).toBe(4);
  });

  it("counts every frozen essay individually even when they share one book — legacy podcast episodes", async () => {
    const episodes = Array.from({ length: 9 }, (_, i) => ({
      id: `episode-${i + 1}`,
      book_id: "book-diary-ceo",
      frozen_book_points: "0.33",
      published_at: `2026-0${(i % 8) + 1}-01T00:00:00Z`,
      books: { book_points: "2.00", list_status: "shortlist" },
    }));

    const client = fakeSupabase({
      essays: [
        { data: episodes },
        { data: [] },
        { data: [] },
        { count: 9 },
      ],
    });

    const result = await getUserBookPointsStats(client, "profile-1");

    expect(result.approved_points).toBeCloseTo(2.97, 5);
  });

  it("counts every frozen source-linked essay individually, using the frozen value over the source's points", async () => {
    const client = fakeSupabase({
      essays: [
        { data: [] }, // book essays (none)
        {
          data: [
            {
              id: "essay-1",
              content_source_id: "cs-1",
              frozen_book_points: "0.33",
              published_at: "2026-08-01T00:00:00Z",
              content_sources: { points: 2, status: "approved" },
            },
            {
              id: "essay-2",
              content_source_id: "cs-1",
              frozen_book_points: "0.33",
              published_at: "2026-08-02T00:00:00Z",
              content_sources: { points: 2, status: "approved" },
            },
          ],
        },
        { data: [] },
        { count: 2 },
      ],
    });

    const result = await getUserBookPointsStats(client, "profile-1");

    expect(result.approved_points).toBeCloseTo(0.66, 5);
  });

  it("counts a frozen essay even when its book is now archived — earned credit is immune to later archival", async () => {
    const client = fakeSupabase({
      essays: [
        {
          data: [
            {
              id: "essay-1",
              book_id: "book-1",
              frozen_book_points: "2.00",
              published_at: "2026-08-01T00:00:00Z",
              books: { book_points: "0.00", list_status: "archived" },
            },
          ],
        },
        { data: [] },
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
              id: "essay-1",
              book_id: "book-1",
              frozen_book_points: null,
              published_at: "2026-09-05T00:00:00Z",
              books: { book_points: "3.00", list_status: "archived" },
            },
          ],
        },
        { data: [] },
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
  it("counts live essays once per (author, book) using the earliest row", async () => {
    const client = fakeSupabase({
      essays: [
        {
          data: [
            {
              id: "essay-late",
              author_profile_id: "author-1",
              book_id: "book-1",
              frozen_book_points: null,
              published_at: "2026-09-10T00:00:00Z",
              books: { book_points: "3.00", list_status: "shortlist" },
            },
            {
              id: "essay-early",
              author_profile_id: "author-1",
              book_id: "book-1",
              frozen_book_points: null,
              published_at: "2026-09-01T00:00:00Z",
              books: { book_points: "1.00", list_status: "shortlist" },
            },
          ],
        },
        { data: [] },
        { data: [] },
      ],
    });

    const result = await getAuthorsApprovedBookPoints(client, ["author-1"]);

    expect(result["author-1"]).toBe(1);
  });

  it("counts a frozen essay separately from a live essay on the same book", async () => {
    const client = fakeSupabase({
      essays: [
        {
          data: [
            {
              id: "essay-live",
              author_profile_id: "author-1",
              book_id: "book-1",
              frozen_book_points: null,
              published_at: "2026-09-10T00:00:00Z",
              books: { book_points: "3.00", list_status: "shortlist" },
            },
            {
              id: "essay-frozen",
              author_profile_id: "author-1",
              book_id: "book-1",
              frozen_book_points: "1.00",
              published_at: "2026-08-01T00:00:00Z",
              books: { book_points: "3.00", list_status: "shortlist" },
            },
          ],
        },
        { data: [] },
        { data: [] },
      ],
    });

    const result = await getAuthorsApprovedBookPoints(client, ["author-1"]);

    expect(result["author-1"]).toBe(4);
  });

  it("counts every frozen essay individually even when they share one book", async () => {
    const client = fakeSupabase({
      essays: [
        {
          data: [
            {
              id: "essay-1",
              author_profile_id: "author-1",
              book_id: "book-1",
              frozen_book_points: "0.33",
              published_at: "2026-08-01T00:00:00Z",
              books: { book_points: "2.00", list_status: "shortlist" },
            },
            {
              id: "essay-2",
              author_profile_id: "author-1",
              book_id: "book-1",
              frozen_book_points: "0.33",
              published_at: "2026-08-02T00:00:00Z",
              books: { book_points: "2.00", list_status: "shortlist" },
            },
          ],
        },
        { data: [] },
        { data: [] },
      ],
    });

    const result = await getAuthorsApprovedBookPoints(client, ["author-1"]);

    expect(result["author-1"]).toBeCloseTo(0.66, 5);
  });

  it("falls back to live book_points when frozen_book_points is null (post-cutover essay)", async () => {
    const client = fakeSupabase({
      essays: [
        {
          data: [
            {
              id: "essay-1",
              author_profile_id: "author-1",
              book_id: "book-1",
              frozen_book_points: null,
              published_at: "2026-09-05T00:00:00Z",
              books: { book_points: "3.00", list_status: "shortlist" },
            },
          ],
        },
        { data: [] },
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

describe("getTeamBookPointsStats", () => {
  it("counts live essays once per (profile, book) using the earliest row", async () => {
    const client = fakeSupabase({
      profiles: [{ data: [{ id: "profile-1", name: "Test Student", picture: null }] }],
      essays: [
        {
          data: [
            {
              id: "essay-late",
              author_profile_id: "profile-1",
              book_id: "book-1",
              frozen_book_points: null,
              published_at: "2026-09-10T00:00:00Z",
              books: { book_points: "3.00", list_status: "shortlist" },
            },
            {
              id: "essay-early",
              author_profile_id: "profile-1",
              book_id: "book-1",
              frozen_book_points: null,
              published_at: "2026-09-01T00:00:00Z",
              books: { book_points: "1.00", list_status: "shortlist" },
            },
          ],
        },
        { data: [] },
        { data: [] },
      ],
    });

    const result = await getTeamBookPointsStats(client, "team-1");

    expect(result).toEqual([
      { profile: { id: "profile-1", name: "Test Student", picture: null }, approved_points: 1, pending_points: 0 },
    ]);
  });

  it("counts a frozen essay separately from a live essay on the same book", async () => {
    const client = fakeSupabase({
      profiles: [{ data: [{ id: "profile-1", name: "Test Student", picture: null }] }],
      essays: [
        {
          data: [
            {
              id: "essay-live",
              author_profile_id: "profile-1",
              book_id: "book-1",
              frozen_book_points: null,
              published_at: "2026-09-10T00:00:00Z",
              books: { book_points: "3.00", list_status: "shortlist" },
            },
            {
              id: "essay-frozen",
              author_profile_id: "profile-1",
              book_id: "book-1",
              frozen_book_points: "1.00",
              published_at: "2026-08-01T00:00:00Z",
              books: { book_points: "3.00", list_status: "shortlist" },
            },
          ],
        },
        { data: [] },
        { data: [] },
      ],
    });

    const result = await getTeamBookPointsStats(client, "team-1");

    expect(result).toEqual([
      { profile: { id: "profile-1", name: "Test Student", picture: null }, approved_points: 4, pending_points: 0 },
    ]);
  });

  it("counts every frozen essay individually even when they share one book", async () => {
    const client = fakeSupabase({
      profiles: [{ data: [{ id: "profile-1", name: "Test Student", picture: null }] }],
      essays: [
        {
          data: [
            {
              id: "essay-1",
              author_profile_id: "profile-1",
              book_id: "book-1",
              frozen_book_points: "0.33",
              published_at: "2026-08-01T00:00:00Z",
              books: { book_points: "2.00", list_status: "shortlist" },
            },
            {
              id: "essay-2",
              author_profile_id: "profile-1",
              book_id: "book-1",
              frozen_book_points: "0.33",
              published_at: "2026-08-02T00:00:00Z",
              books: { book_points: "2.00", list_status: "shortlist" },
            },
          ],
        },
        { data: [] },
        { data: [] },
      ],
    });

    const result = await getTeamBookPointsStats(client, "team-1");

    expect(result[0].approved_points).toBeCloseTo(0.66, 5);
  });

  it("falls back to live book_points when frozen_book_points is null (post-cutover essay)", async () => {
    const client = fakeSupabase({
      profiles: [{ data: [{ id: "profile-1", name: "Test Student", picture: null }] }],
      essays: [
        {
          data: [
            {
              id: "essay-1",
              author_profile_id: "profile-1",
              book_id: "book-1",
              frozen_book_points: null,
              published_at: "2026-09-05T00:00:00Z",
              books: { book_points: "3.00", list_status: "shortlist" },
            },
          ],
        },
        { data: [] },
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
              id: "essay-1",
              author_profile_id: "profile-1",
              content_source_id: "cs-1",
              frozen_book_points: null,
              content_sources: { points: 2, status: "approved" },
            },
          ],
        },
        { data: [] }, // orphan frozen essays (none)
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
              id: "essay-1",
              author_profile_id: "profile-1",
              content_source_id: "cs-1",
              frozen_book_points: null,
              content_sources: { points: 2, status: "pending_review" },
            },
          ],
        },
        { data: [] }, // orphan frozen essays (none)
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

describe("collectPagedResults", () => {
  it("walks pages until a short page and concatenates them in order", async () => {
    const pages = [["a1", "b1"], ["a2", "b2"], ["a3"]];

    const result = await collectPagedResults(async (page) => pages[page - 1] ?? [], 2);

    expect(result).toEqual(["a1", "b1", "a2", "b2", "a3"]);
  });

  it("makes one final request when the last full page is an exact multiple", async () => {
    const requestedPages: number[] = [];

    const result = await collectPagedResults(async (page) => {
      requestedPages.push(page);
      return page <= 2 ? [`a${page}`, `b${page}`] : [];
    }, 2);

    expect(result).toEqual(["a1", "b1", "a2", "b2"]);
    expect(requestedPages).toEqual([1, 2, 3]);
  });
});

describe("getAllEssays", () => {
  function essayRow(id: string, createdAt: string, votes: number, views: number) {
    return {
      id,
      author_profile_id: "profile-1",
      book_id: null,
      content_source_id: null,
      frozen_book_points: null,
      published_at: createdAt,
      pinned_at: null,
      pinned_by_profile_id: null,
      removed_at: null,
      created_at: createdAt,
      updated_at: createdAt,
      created_by_profile_id: "profile-1",
      updated_by_profile_id: "profile-1",
      essay_revisions: [
        {
          title: id,
          content_json: { type: "doc", content: [{ type: "paragraph" }] },
          revision_no: 1,
          invalid_since: null,
          created_at: createdAt,
          updated_at: createdAt,
        },
      ],
      essay_votes: [{ count: votes }],
      essay_views: [{ count: views }],
      essay_comments: [{ count: 0 }],
      author: { id: "profile-1", name: "Author", picture: null, role: "student", team_id: null },
      book: null,
      content_source: null,
    };
  }

  it("keeps recency order for the default sort", async () => {
    const rows = [
      essayRow("newest", "2026-09-03T00:00:00Z", 0, 0),
      essayRow("middle", "2026-09-02T00:00:00Z", 0, 0),
      essayRow("oldest", "2026-09-01T00:00:00Z", 0, 0),
    ];
    const client = fakeSupabase({ essays: [{ data: rows }] });

    const result = await getAllEssays(client, { authorProfileId: "profile-1" });

    expect(result.map((essay) => essay.id)).toEqual(["newest", "middle", "oldest"]);
  });

  it("ranks the complete set by popularity for the best sort", async () => {
    const rows = [
      essayRow("unvoted", "2026-09-03T00:00:00Z", 0, 0),
      essayRow("popular", "2026-09-01T00:00:00Z", 4, 1),
      essayRow("middling", "2026-09-02T00:00:00Z", 1, 2),
    ];
    const client = fakeSupabase({ essays: [{ data: rows }] });

    const result = await getAllEssays(client, { authorProfileId: "profile-1", sort: "best" });

    expect(result.map((essay) => essay.id)).toEqual(["popular", "middling", "unvoted"]);
  });
});

