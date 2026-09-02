# Frozen Book Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect students from retroactively losing book-points credit when `books.book_points` was rescored, by freezing each pre-2026-09-03 essay to the point value its book had under the old (retired) system.

**Architecture:** Add a nullable `essays.frozen_book_points` column. `NULL` means "use the live `books.book_points`" (new essay, or a book with no legacy value to protect); a set value overrides it. Every read site that currently reads `book_points` for scoring switches to `COALESCE(frozen_book_points, book_points)`. A one-time backfill script populates the column for existing pre-cutover essays by tracing each one back to the old system's own `Sources.csv` records. A small UI badge shows when an essay's points are frozen.

**Tech Stack:** Next.js/TypeScript, Supabase (Postgres + PostgREST), Drizzle (schema source of truth, migrations only), Vitest (unit tests), Node scripts (`.mjs`, no build step) for the one-time backfill.

**Spec:** `docs/superpowers/specs/2026-09-02-frozen-book-points-design.md`

## Global Constraints

- New column type: `numeric(3,2)` — matches `books.book_points` exactly (range 0–3 per `books_book_points_check`).
- Never hand-write a migration for the column itself — edit `db/schema/essays.ts`, then **prompt the user to run `pnpm db:migrate`** (this repo's CRITICAL rule — do not run it unattended, and ask the user to check the generated migration for drops before it's applied).
- `book_points`/`frozen_book_points` come back from PostgREST as **strings**, not numbers (see `src/lib/books/points.ts` — `pointsNumber()`/`formatPoints()` already handle this coercion; reuse them, don't re-implement).
- `content_sources` / `essays.content_source_id` are out of scope — that table doesn't exist in production yet. Do not touch any `content_source` code path.
- No new restriction on deleting/removing essays with frozen points (see spec's non-goal reasoning).

---

## Task 1: Schema — add `frozen_book_points`

**Files:**
- Modify: `db/schema/essays.ts:9-23` (the `essays` table definition)

**Interfaces:**
- Produces: DB column `essays.frozen_book_points` (`numeric(3,2)`, nullable) — every later task reads/writes this column.

- [ ] **Step 1: Add the column to the Drizzle schema**

In `db/schema/essays.ts`, add `frozenBookPoints` to the `essays` table's column list (after `bookId`, before `contentSourceId` — keep it next to `bookId` since it's a per-essay override of the book's points):

```ts
export const essays = pgTable("essays", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	externalId: text("external_id"),
	authorProfileId: uuid("author_profile_id").notNull(),
	bookId: uuid("book_id"),
	frozenBookPoints: numeric("frozen_book_points", { precision: 3, scale: 2 }),
	contentSourceId: uuid("content_source_id"),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	pinnedAt: timestamp("pinned_at", { withTimezone: true, mode: 'string' }),
	pinnedByProfileId: uuid("pinned_by_profile_id"),
	removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
```

Add `numeric` to the existing `drizzle-orm/pg-core` import at the top of the file (it currently imports `pgTable, foreignKey, pgPolicy, uuid, text, jsonb, integer, timestamp, index, check, primaryKey` — add `numeric` to that list).

- [ ] **Step 2: Ask the user to generate and review the migration**

Do not run `pnpm db:migrate` yourself. Tell the user:

> "Schema updated with `essays.frozen_book_points` (nullable `numeric(3,2)`). Please run `pnpm db:migrate` — it will generate the migration, apply it locally, and regenerate `src/lib/supabase/database.types.ts`. Let me know once it's done, or let me check the generated migration file for anything unexpected (it should be a single additive `ALTER TABLE essays ADD COLUMN frozen_book_points numeric(3,2)`, no drops)."

Wait for the user to confirm before starting Task 2 — later tasks reference the regenerated `database.types.ts`.

- [ ] **Step 3: Commit**

```bash
git add db/schema/essays.ts
git commit -m "feat: add frozen_book_points column to essays schema"
```

(The generated migration file and `database.types.ts` are committed separately by/with the user per this repo's schema-change convention — don't commit those yourself in this step if the user is running the migrate command themselves.)

---

## Task 2: App-facing `Essay` type

**Files:**
- Modify: `src/lib/essays/types.ts:9-25` (the `Essay` interface)
- Modify: `src/lib/essays/queries.ts` (the `EssayRawRow` interface, ~line 54-73)

**Interfaces:**
- Consumes: `essays.frozen_book_points` column (Task 1).
- Produces: `Essay.frozen_book_points: string | null` — every later task (query logic, UI badge) reads this field.

- [ ] **Step 1: Add the field to `Essay`**

In `src/lib/essays/types.ts`, add to the `Essay` interface (after `book_id`, mirroring the DB column order from Task 1):

```ts
export interface Essay {
  id: string;
  author_profile_id: string;
  book_id: string | null;
  /** Points frozen from the old system for pre-2026-09-03 essays; null uses the book's live book_points. */
  frozen_book_points: string | null;
  content_source_id: string | null;
  title: string;
  content_json: object;
  /** Plain text derived from `content_json` for snippets (not stored). */
  content_text: string;
  published_at: string | null;
  view_count: number;
  vote_count: number;
  created_at: string;
  updated_at: string;
  pinned_at: string | null;
  pinned_by_profile_id: string | null;
  removed_at: string | null;
}
```

- [ ] **Step 2: Add the field to `EssayRawRow` so the mapper's `...rest` spread type-checks**

In `src/lib/essays/queries.ts`, add `frozen_book_points: string | null;` to the `EssayRawRow` interface (it's already selected via `ESSAY_DETAIL_SELECT`'s leading `*`, so no query changes are needed — this is purely a type declaration so `mapEssayRows`'s `...rest` spread, which already passes the column through at runtime, also type-checks and exposes it on the returned `EssayWithDetails`):

```ts
interface EssayRawRow {
  id: string;
  author_profile_id: string;
  book_id: string | null;
  frozen_book_points: string | null;
  published_at: string | null;
  pinned_at: string | null;
  pinned_by_profile_id: string | null;
  removed_at: string | null;
  created_at: string;
  updated_at: string;
  created_by_profile_id: string;
  updated_by_profile_id: string;
  essay_revisions?: EssayRevisionEmbed[] | null;
  essay_votes?: CountEmbed[] | null;
  essay_views?: CountEmbed[] | null;
  essay_comments?: CountEmbed[] | null;
  author: EssayWithDetails['author'];
  book: (Omit<NonNullable<EssayWithDetails['book']>, 'highlight_category'> & {
    highlight_category?: HighlightCategory | HighlightCategory[] | null;
  }) | null;
  content_source_id: string | null;
  content_source: EssayWithDetails['content_source'];
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no new errors. (`mapEssayRows`'s `...rest` already includes the field at runtime; this step only adds the type declaration, so no other code in this file needs to change.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/essays/types.ts src/lib/essays/queries.ts
git commit -m "feat: expose frozen_book_points on the Essay type"
```

---

## Task 3: `getUserBookPointsStats` — prefer frozen value, earliest-essay dedup

**Files:**
- Modify: `src/lib/essays/queries.ts:1281-1360`
- Create: `src/lib/essays/queries.test.ts`

**Interfaces:**
- Consumes: `Essay.frozen_book_points` (Task 2); `pointsNumber` from `@/lib/books/points`.
- Produces: unchanged public signature `getUserBookPointsStats(supabase, profileId, now?)` — behavior only.

- [ ] **Step 1: Write the failing test**

Create `src/lib/essays/queries.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

import { getUserBookPointsStats } from "./queries";

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/essays/queries.test.ts`
Expected: FAIL — first two assertions fail with `2 !== 0` / `3 !== 3` mismatch-shaped errors is wrong, re-check: first test expects `2`, current code reads `books.book_points` directly (`"0.00"` → `0`), so it fails with `expected 0 to be 2`. Third test fails because current code has no ordering logic and picks whichever row the loop visits last (`3`, not `1`).

- [ ] **Step 3: Implement**

In `src/lib/essays/queries.ts`, replace the `getUserBookPointsStats` body (lines ~1293-1330) — add `frozen_book_points` to the select, track the winning row's `published_at` per key so a later row only overwrites an earlier one if it's actually earlier, and compute the point value with `pointsNumber(row.frozen_book_points ?? row.books.book_points)`:

```ts
  const { data: bookEssays, error } = await supabase
    .from('essays')
    .select('book_id, frozen_book_points, published_at, books!inner(book_points, list_status)')
    .eq('author_profile_id', profileId)
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .not('book_id', 'is', null);

  if (error) throw error;

  const { data: sourceEssays, error: sourceError } = await supabase
    .from('essays')
    .select('content_source_id, published_at, content_sources!inner(points, status)')
    .eq('author_profile_id', profileId)
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .not('content_source_id', 'is', null);

  if (sourceError) throw sourceError;

  type BookRow = {
    book_id: string;
    frozen_book_points: string | null;
    published_at: string;
    books: { book_points: number | string; list_status: string };
  };
  type SourceRow = { content_source_id: string; published_at: string; content_sources: { points: number; status: string } };

  const ELIGIBLE = new Set<string>(POINTS_ELIGIBLE_LIST_STATUSES);
  const approved = new Map<string, number>();
  const approvedAt = new Map<string, string>(); // key -> published_at of the row currently credited, for earliest-wins
  const pending = new Set<string>();
  const semesterApproved = new Set<string>();
  const { start: semesterStart } = getCurrentSemesterRange(now);

  for (const row of (bookEssays ?? []) as unknown as BookRow[]) {
    if (!row.book_id) continue;
    const key = `book:${row.book_id}`;
    if (ELIGIBLE.has(row.books.list_status)) {
      const existingAt = approvedAt.get(key);
      if (!existingAt || row.published_at < existingAt) {
        approved.set(key, pointsNumber(row.frozen_book_points ?? row.books.book_points));
        approvedAt.set(key, row.published_at);
      }
      if (new Date(row.published_at) >= semesterStart) semesterApproved.add(key);
    } else if (row.books.list_status === 'processing') {
      pending.add(key);
    }
  }
```

Leave the `sourceEssays` loop and everything after unchanged (out of scope per Global Constraints). Add `pointsNumber` to this file's imports:

```ts
import { pointsNumber } from '@/lib/books/points';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/essays/queries.test.ts`
Expected: PASS (all 3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/essays/queries.ts src/lib/essays/queries.test.ts
git commit -m "feat: getUserBookPointsStats prefers frozen_book_points, earliest essay wins dedup"
```

---

## Task 4: `getAuthorsApprovedBookPoints` — same fix

**Files:**
- Modify: `src/lib/essays/queries.ts:1365-1416`
- Modify: `src/lib/essays/queries.test.ts` (append)

**Interfaces:**
- Consumes: same as Task 3.
- Produces: unchanged public signature `getAuthorsApprovedBookPoints(supabase, authorProfileIds)`.

- [ ] **Step 1: Write the failing test**

First, update the existing top-of-file import in `src/lib/essays/queries.test.ts` (added in Task 3) from:

```ts
import { getUserBookPointsStats } from "./queries";
```

to:

```ts
import { getAuthorsApprovedBookPoints, getUserBookPointsStats } from "./queries";
```

Then append this new `describe` block to the end of the file (no new `import` line — the import above already covers it):

```ts
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/essays/queries.test.ts -t "getAuthorsApprovedBookPoints"`
Expected: FAIL — `expected 3 to be 1` (no ordering logic yet).

- [ ] **Step 3: Implement**

In `src/lib/essays/queries.ts`, update `getAuthorsApprovedBookPoints` (lines ~1371-1409):

```ts
  const { data: bookEssays, error } = await supabase
    .from('essays')
    .select('author_profile_id, book_id, frozen_book_points, published_at, books!inner(book_points, list_status)')
    .in('author_profile_id', authorProfileIds)
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .not('book_id', 'is', null);

  if (error) throw error;

  const { data: sourceEssays, error: sourceError } = await supabase
    .from('essays')
    .select('author_profile_id, content_source_id, content_sources!inner(points, status)')
    .in('author_profile_id', authorProfileIds)
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .not('content_source_id', 'is', null);

  if (sourceError) throw sourceError;

  type BookRow = {
    author_profile_id: string;
    book_id: string;
    frozen_book_points: string | null;
    published_at: string;
    books: { book_points: number | string; list_status: string };
  };
  type SourceRow = { author_profile_id: string; content_source_id: string; content_sources: { points: number; status: string } };

  const ELIGIBLE = new Set<string>(POINTS_ELIGIBLE_LIST_STATUSES);
  const pointsByAuthor: Record<string, Map<string, number>> = {};
  const atByAuthor: Record<string, Map<string, string>> = {};
  for (const authorId of authorProfileIds) {
    pointsByAuthor[authorId] = new Map();
    atByAuthor[authorId] = new Map();
  }

  for (const row of (bookEssays ?? []) as unknown as BookRow[]) {
    if (!row.book_id || !ELIGIBLE.has(row.books.list_status)) continue;
    const key = `book:${row.book_id}`;
    const at = atByAuthor[row.author_profile_id];
    const points = pointsByAuthor[row.author_profile_id];
    if (!at || !points) continue;
    const existingAt = at.get(key);
    if (!existingAt || row.published_at < existingAt) {
      points.set(key, pointsNumber(row.frozen_book_points ?? row.books.book_points));
      at.set(key, row.published_at);
    }
  }
```

Leave the `sourceEssays` loop and the final reduction unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/essays/queries.test.ts`
Expected: PASS (all tests, this file)

- [ ] **Step 5: Commit**

```bash
git add src/lib/essays/queries.ts src/lib/essays/queries.test.ts
git commit -m "feat: getAuthorsApprovedBookPoints prefers frozen_book_points, earliest essay wins dedup"
```

---

## Task 5: `getTeamBookPointsStats` — restructure to carry per-essay value

**Files:**
- Modify: `src/lib/essays/queries.ts:1418-1522`
- Modify: `src/lib/essays/queries.test.ts` (append)

**Interfaces:**
- Consumes: same as Task 3.
- Produces: unchanged public signature `getTeamBookPointsStats(supabase, teamId)`.

This function currently only tracks *which* books a profile wrote about (`Set<"book:<id>">`), then looks up a flat `book_id → book_points` map afterward — it has no per-essay granularity, so it can't currently distinguish frozen vs. live per essay. It needs restructuring to carry the resolved value through, the same way Tasks 3–4 do.

- [ ] **Step 1: Write the failing test**

First, update the existing top-of-file import in `src/lib/essays/queries.test.ts` (from Tasks 3–4) from:

```ts
import { getAuthorsApprovedBookPoints, getUserBookPointsStats } from "./queries";
```

to:

```ts
import { getAuthorsApprovedBookPoints, getTeamBookPointsStats, getUserBookPointsStats } from "./queries";
```

Then append this new `describe` block to the end of the file:

```ts
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/essays/queries.test.ts -t "getTeamBookPointsStats"`
Expected: FAIL — either a query-shape mismatch (current code does a separate `books` lookup with no `.in('id', ...)` args wired to this fake, so `approvedBooks` queue is empty) or `approved_points` computed as `3` instead of `1`. Either failure confirms the restructuring is needed.

- [ ] **Step 3: Implement**

Replace `getTeamBookPointsStats` (lines ~1418-1522) — drop the separate `approvedBooks` lookup entirely and carry the per-essay value directly, mirroring Tasks 3–4's pattern:

```ts
export async function getTeamBookPointsStats(
  supabase: SupabaseClient<Database>,
  teamId: string,
): Promise<{ profile: { id: string; name: string; picture: string | null }; approved_points: number; pending_points: number }[]> {
  const { data: teamProfiles, error: teamError } = await supabase
    .from('profiles')
    .select('id, name, picture')
    .eq('team_id', teamId)
    .is('access_removed_at', null);

  if (teamError) throw teamError;
  if (!teamProfiles || teamProfiles.length === 0) return [];

  const profileIds = teamProfiles.map((p: { id: string }) => p.id);

  const { data: bookEssays, error: essayError } = await supabase
    .from('essays')
    .select('author_profile_id, book_id, frozen_book_points, published_at, books!inner(book_points, list_status)')
    .in('author_profile_id', profileIds)
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .not('book_id', 'is', null);

  if (essayError) throw essayError;

  const { data: sourceEssays, error: sourceError } = await supabase
    .from('essays')
    .select('author_profile_id, content_source_id, content_sources!inner(points, status)')
    .in('author_profile_id', profileIds)
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .not('content_source_id', 'is', null);

  if (sourceError) throw sourceError;

  type BookRow = {
    author_profile_id: string;
    book_id: string;
    frozen_book_points: string | null;
    published_at: string;
    books: { book_points: number | string; list_status: string };
  };
  type SourceRow = { author_profile_id: string; content_source_id: string; content_sources: { points: number; status: string } };

  const ELIGIBLE = new Set<string>(POINTS_ELIGIBLE_LIST_STATUSES);
  const byProfile: Record<string, { approved: Map<string, number>; approvedAt: Map<string, string>; pending: Set<string> }> = {};
  for (const profileId of profileIds) {
    byProfile[profileId] = { approved: new Map(), approvedAt: new Map(), pending: new Set() };
  }

  for (const essay of (bookEssays ?? []) as unknown as BookRow[]) {
    const bucket = byProfile[essay.author_profile_id];
    if (!bucket || !essay.book_id) continue;
    const key = `book:${essay.book_id}`;
    if (ELIGIBLE.has(essay.books.list_status)) {
      const existingAt = bucket.approvedAt.get(key);
      if (!existingAt || essay.published_at < existingAt) {
        bucket.approved.set(key, pointsNumber(essay.frozen_book_points ?? essay.books.book_points));
        bucket.approvedAt.set(key, essay.published_at);
      }
    } else if (essay.books.list_status === 'processing') {
      bucket.pending.add(key);
    }
  }

  for (const essay of (sourceEssays ?? []) as unknown as SourceRow[]) {
    const bucket = byProfile[essay.author_profile_id];
    if (!bucket || !essay.content_source_id) continue;
    const key = `source:${essay.content_source_id}`;
    if (essay.content_sources.status === 'approved') {
      if (!bucket.approved.has(key)) bucket.approved.set(key, pointsNumber(essay.content_sources.points));
    } else if (essay.content_sources.status === 'pending_review') {
      bucket.pending.add(key);
    }
  }

  return teamProfiles.map((profile) => {
    const bucket = byProfile[profile.id];
    const approved_points = Array.from(bucket.approved.values()).reduce((sum, p) => sum + p, 0);

    return {
      profile: {
        id: profile.id,
        name: profile.name ?? '',
        picture: profile.picture,
      },
      approved_points,
      pending_points: bucket.pending.size,
    };
  });
}
```

Note this drops the separate `approvedSources`/`approvedBooks` lookup queries and the `pointsMap` construction entirely — content_source points are now read directly off the embedded `essay.content_sources.points`, same pattern as `getUserBookPointsStats`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/essays/queries.test.ts`
Expected: PASS (all tests, this file)

- [ ] **Step 5: Run the full test suite to catch any other caller relying on the old two-query shape**

Run: `pnpm test`
Expected: PASS. If any other test mocks `getTeamBookPointsStats`'s old `books`/`content_sources` lookup queries, update that test's fixture to match the new query shape (one fewer round trip).

- [ ] **Step 6: Commit**

```bash
git add src/lib/essays/queries.ts src/lib/essays/queries.test.ts
git commit -m "feat: getTeamBookPointsStats carries per-essay frozen_book_points, drops flat book lookup"
```

---

## Task 6: Portfolio API routes — prefer frozen value

**Files:**
- Modify: `src/app/api/portfolio/data/route.ts:58,87,105`
- Modify: `src/app/api/portfolio/generate/route.ts:47,73,95`

**Interfaces:**
- Consumes: `frozen_book_points` selected on the essay row (needs adding to both routes' select lists).

No dedup here — these routes list individual essays (portfolio entries), not aggregate totals, so each essay just shows its own resolved value.

- [ ] **Step 1: Update `src/app/api/portfolio/data/route.ts`**

Add `frozen_book_points` to the essay select alongside the existing `book_points` (near line 58 — find the `.select(...)` call that lists `book_points` as a nested field under the essay query and add `frozen_book_points` as a top-level essay column in the same select string). Update the row type at line ~87 to include it:

```ts
      frozen_book_points: string | null;
```

Then change line 105 from:

```ts
      points: Number(book?.book_points ?? contentSource?.points ?? 0),
```

to:

```ts
      points: pointsNumber(essay.frozen_book_points ?? book?.book_points ?? contentSource?.points),
```

Add the import: `import { pointsNumber } from '@/lib/books/points';` (check the existing imports at the top of the file first — if `Number(...)` is used elsewhere in this file for a different purpose, only replace this specific points computation, don't blanket-replace).

- [ ] **Step 2: Apply the identical change to `src/app/api/portfolio/generate/route.ts`**

Same select addition, same row type addition, same line-95 change from `Number(book?.book_points ?? contentSource?.points ?? 0)` to `pointsNumber(essay.frozen_book_points ?? book?.book_points ?? contentSource?.points)`, same import.

- [ ] **Step 3: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification**

Run the dev server (`pnpm dev`), sign in as a user with at least one published book essay, open the portfolio generation flow, and confirm the point value shown still matches what it did before this change (no visible regression) — there's no automated test harness for these two routes (they're excluded from integration coverage per this repo's testing docs: route coverage belongs to E2E). Note this in the PR/commit description as manually verified rather than test-covered.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/portfolio/data/route.ts src/app/api/portfolio/generate/route.ts
git commit -m "feat: portfolio routes prefer frozen_book_points per essay"
```

---

## Task 7: UI — gentle legacy-points badge

**Files:**
- Modify: `src/app/(main)/cteni/eseje/[essayId]/page.tsx:168`
- Modify: `src/components/essays/social-essay-feed-card.tsx:181-183`

**Interfaces:**
- Consumes: `Essay.frozen_book_points` (Task 2) — already flows through both call sites' existing `ESSAY_DETAIL_SELECT`-backed queries, no query changes needed here.

- [ ] **Step 1: Add the badge to the essay detail page**

In `src/app/(main)/cteni/eseje/[essayId]/page.tsx`, find the existing points badge (line 168):

```tsx
<Badge variant="secondary" className="shrink-0">{formatPoints(essay.book.book_points)} b.</Badge>
```

Change to show the frozen value when present, and add a title attribute as the gentle indicator (no separate tooltip component needed — a native `title` attribute is sufficient and matches "gentle", non-blocking):

```tsx
<Badge
  variant="secondary"
  className="shrink-0"
  title={essay.frozen_book_points != null ? 'Body za tuto esej jsou zamčené ze staršího systému.' : undefined}
>
  {formatPoints(essay.frozen_book_points ?? essay.book.book_points)} b.
</Badge>
```

- [ ] **Step 2: Apply the same change to the feed card**

In `src/components/essays/social-essay-feed-card.tsx` (lines ~181-183), the existing code:

```tsx
{essay.book.list_status !== 'archived' && pointsNumber(essay.book.book_points) > 0 && (
  <Badge ...>{formatPoints(essay.book.book_points)} b.</Badge>
)}
```

Change both the visibility check and the rendered value to account for the frozen override, plus the same `title` indicator:

```tsx
{essay.book.list_status !== 'archived' && pointsNumber(essay.frozen_book_points ?? essay.book.book_points) > 0 && (
  <Badge
    variant="secondary"
    className="shrink-0"
    title={essay.frozen_book_points != null ? 'Body za tuto esej jsou zamčené ze staršího systému.' : undefined}
  >
    {formatPoints(essay.frozen_book_points ?? essay.book.book_points)} b.
  </Badge>
)}
```

(Keep the existing `Badge` props exactly as they are today other than adding `title` — only the point-value expressions and visibility condition change.)

- [ ] **Step 3: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Component test check**

Run: `pnpm vitest run src/components/essays/social-essay-feed-card.test.tsx` (if this file exists — check first with `ls src/components/essays/*.test.tsx`)
Expected: PASS. If a snapshot test breaks because of the new `title` attribute, update the snapshot (`pnpm vitest run --update` scoped to that file) rather than the assertion logic.

- [ ] **Step 5: Manual verification**

Run `pnpm dev`, open an essay whose `frozen_book_points` is set (any pre-cutover essay once Task 8's backfill has run) and confirm the badge tooltip shows the legacy-points message on hover; open a post-cutover essay and confirm no tooltip appears (native `title` renders nothing when `undefined`).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(main)/cteni/eseje/[essayId]/page.tsx" src/components/essays/social-essay-feed-card.tsx
git commit -m "feat: show a gentle indicator on essays with frozen legacy points"
```

---

## Task 8: One-time backfill script

**Files:**
- Create: `scripts/essayimport/backfill_frozen_book_points.mjs`

**Interfaces:**
- Consumes: `data/02_09_2026/Essays.csv`, `data/02_09_2026/Sources.csv` (old system export), production `essays`/`books` tables via `.env.transfer.local`'s `PRODUCTION_SUPABASE_URL`/`PRODUCTION_SERVICE_ROLE_KEY`.
- Produces: `essays.frozen_book_points` populated in production for every essay with `published_at < '2026-09-03'` that traces to an old-system `BookPoints` value.

This mirrors the dry-run/`DRY=false` convention already used by `scripts/essayimport/import_prod_final_248.mjs` and `scripts/essayimport/import_21_missing_essays.mjs`.

- [ ] **Step 1: Write the script**

Create `scripts/essayimport/backfill_frozen_book_points.mjs`:

```js
// One-time backfill: freeze essays.frozen_book_points for every pre-cutover
// essay, resolving each one's book back to its old-system BookPoints value.
// See docs/superpowers/specs/2026-09-02-frozen-book-points-design.md.
//
// Resolution order per essay:
//   1. essay.external_id -> old Essays.csv row -> its SourceID -> Sources.csv.BookPoints
//   2. essay.book_id -> books.external_id -> Sources.csv.BookPoints (numeric external_id only)
//   3. essay.book_id -> books.title_cs, normalized-exact-matched against Sources.csv titles
//   4. unresolved -> leave frozen_book_points untouched (stays NULL)
//
// Usage:
//   npx tsx scripts/essayimport/backfill_frozen_book_points.mjs           (dry run)
//   DRY=false npx tsx scripts/essayimport/backfill_frozen_book_points.mjs (writes)

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ROOT = "/Users/kulo/development/timii/Tappka";
const CUTOVER = "2026-09-03";

const envText = readFileSync(`${ROOT}/.env.transfer.local`, "utf-8");
for (const line of envText.split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[m[1]]) process.env[m[1]] = v;
}
const PROD_URL = process.env.PRODUCTION_SUPABASE_URL;
const PROD_KEY = process.env.PRODUCTION_SERVICE_ROLE_KEY;
const supabase = createClient(PROD_URL, PROD_KEY, { auth: { persistSession: false } });

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) { row.push(field); field = ""; continue; }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v.trim().length > 0)) rows.push(row);
      row = [];
      continue;
    }
    field += char;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); if (row.some((v) => v.trim().length > 0)) rows.push(row); }
  return rows;
}

function stripDiacritics(s) {
  return s.normalize("NFD").replace(/\p{Mn}/gu, "");
}

function normalizeTitle(s) {
  if (!s) return "";
  return stripDiacritics(s.trim().toLowerCase()).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function parsePoints(raw) {
  const s = (raw ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// --- Load old-system CSVs ---
const essaysCsvText = readFileSync(`${ROOT}/data/02_09_2026/Essays.csv`, "utf-8");
const essaysCsvRows = parseCsv(essaysCsvText);
const essaysHeader = essaysCsvRows[0].map((h) => h.replace(/^﻿/, "").trim());
const oldEssayIdIdx = essaysHeader.findIndex((h) => h.toLowerCase() === "id");
const oldSourceIdIdx = essaysHeader.findIndex((h) => h.toLowerCase() === "sourceid");
const oldEssayBySourceId = new Map(); // old essay ID -> old SourceID
for (const row of essaysCsvRows.slice(1)) {
  const id = row[oldEssayIdIdx]?.trim();
  const sourceId = row[oldSourceIdIdx]?.trim();
  if (id) oldEssayBySourceId.set(id, sourceId || null);
}

const sourcesCsvText = readFileSync(`${ROOT}/data/02_09_2026/Sources.csv`, "utf-8");
const sourcesCsvRows = parseCsv(sourcesCsvText);
const sourcesHeader = sourcesCsvRows[0].map((h) => h.replace(/^﻿/, "").trim());
const srcIdIdx = sourcesHeader.findIndex((h) => h.toLowerCase() === "id");
const srcTitleIdx = sourcesHeader.findIndex((h) => h.toLowerCase() === "title");
const srcPointsIdx = sourcesHeader.findIndex((h) => h.toLowerCase() === "bookpoints");
const pointsBySourceId = new Map(); // old SourceID -> points
const sourceIdByNormTitle = new Map(); // normalized title -> old SourceID (first match wins)
for (const row of sourcesCsvRows.slice(1)) {
  const id = row[srcIdIdx]?.trim();
  if (!id) continue;
  const points = parsePoints(row[srcPointsIdx]);
  if (points !== null) pointsBySourceId.set(id, points);
  const normTitle = normalizeTitle(row[srcTitleIdx]);
  if (normTitle && !sourceIdByNormTitle.has(normTitle)) sourceIdByNormTitle.set(normTitle, id);
}

// --- Load production data ---
async function fetchAll(table, select) {
  let all = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + step - 1);
    if (error) throw error;
    all = all.concat(data);
    if (data.length < step) break;
    from += step;
  }
  return all;
}

const essays = await fetchAll("essays", "id,external_id,book_id,published_at,frozen_book_points");
const books = await fetchAll("books", "id,external_id,title_cs");
const bookById = new Map(books.map((b) => [b.id, b]));

console.log(`Loaded ${essays.length} prod essays, ${books.length} prod books`);
console.log(`Loaded ${oldEssayBySourceId.size} old essays, ${pointsBySourceId.size} old source point values`);

const target = essays.filter((e) => e.published_at && e.published_at < CUTOVER && e.frozen_book_points === null && e.book_id);
console.log(`Target: ${target.length} pre-cutover, book-linked essays with no frozen_book_points yet`);

let viaEssayTrace = 0, viaBookExternalId = 0, viaTitleFallback = 0, unresolved = 0;
const updates = [];

for (const essay of target) {
  let points = null;

  // 1. Essay-level trace (only for essays migrated from the old system)
  if (essay.external_id && oldEssayBySourceId.has(essay.external_id)) {
    const sourceId = oldEssayBySourceId.get(essay.external_id);
    if (sourceId && pointsBySourceId.has(sourceId)) {
      points = pointsBySourceId.get(sourceId);
      viaEssayTrace++;
    }
  }

  // 2. Book-level trace via external_id
  if (points === null) {
    const book = bookById.get(essay.book_id);
    if (book?.external_id && pointsBySourceId.has(book.external_id)) {
      points = pointsBySourceId.get(book.external_id);
      viaBookExternalId++;
    }
  }

  // 3. Book-level trace via normalized title fallback
  if (points === null) {
    const book = bookById.get(essay.book_id);
    if (book?.title_cs) {
      const normTitle = normalizeTitle(book.title_cs);
      const sourceId = sourceIdByNormTitle.get(normTitle);
      if (sourceId && pointsBySourceId.has(sourceId)) {
        points = pointsBySourceId.get(sourceId);
        viaTitleFallback++;
      }
    }
  }

  if (points === null) {
    unresolved++;
    continue;
  }

  updates.push({ id: essay.id, points });
}

console.log(`\nResolved via essay trace: ${viaEssayTrace}`);
console.log(`Resolved via book external_id: ${viaBookExternalId}`);
console.log(`Resolved via title fallback: ${viaTitleFallback}`);
console.log(`Unresolved (left NULL): ${unresolved}`);
console.log(`Total to write: ${updates.length}`);

const dryRun = process.env.DRY !== "false";
if (dryRun) {
  console.log("\nDRY RUN — no writes. Set DRY=false to execute.");
  process.exit(0);
}

console.log("\nLIVE — writing to PRODUCTION.");
let written = 0, errored = 0;
for (const { id, points } of updates) {
  const { error } = await supabase.from("essays").update({ frozen_book_points: points }).eq("id", id);
  if (error) { console.error(`  ERROR ${id}: ${error.message}`); errored++; continue; }
  written++;
  if (written % 500 === 0) console.log(`  ${written}/${updates.length} written`);
}
console.log(`\nDone. written=${written} errored=${errored}`);
```

- [ ] **Step 2: Dry run**

Run: `npx tsx scripts/essayimport/backfill_frozen_book_points.mjs`

Expected: prints the resolution breakdown (essay trace / book external_id / title fallback / unresolved counts) and exits without writing. Sanity-check the numbers: given 528 books already traced during the design phase and ~6499 active pre-cutover essays currently in production (both counts established during the design investigation), expect the large majority to resolve via essay trace (most essays were migrated from the old system directly) — if `unresolved` is unexpectedly high (e.g., over half), stop and investigate before proceeding rather than writing.

- [ ] **Step 3: Show the user the dry-run output and get explicit confirmation before writing**

This is a production write affecting the scoring shown to every student — do not proceed to Step 4 without the user explicitly confirming the dry-run numbers look right, mirroring how every other production write in this project's history (descriptions, rocket-model flags, the 21 missing essays) was confirmed before executing.

- [ ] **Step 4: Live run (only after user confirmation)**

Run: `DRY=false npx tsx scripts/essayimport/backfill_frozen_book_points.mjs`
Expected: `errored=0`; `written` matches the dry run's "Total to write" count.

- [ ] **Step 5: Independent verification**

Spot-check a handful of updated essays directly against production (not just trusting the script's own success log) — fetch 5-10 essay ids from the `updates` this run touched and confirm `frozen_book_points` now holds the expected value by comparing against the same `Sources.csv` trace done independently (e.g. via a short one-off Python check, same pattern used throughout this project's prior production writes).

- [ ] **Step 6: Commit**

```bash
git add scripts/essayimport/backfill_frozen_book_points.mjs
git commit -m "feat: add one-time backfill script for essays.frozen_book_points"
```

(The script's production writes themselves are not a git-tracked change — only the script file is committed.)

---

## Self-Review Notes

- **Spec coverage:** §1 (new column) → Task 1. §2 (backfill, 3-tier resolution) → Task 8. §3 (query changes at all 5 confirmed call sites: `getUserBookPointsStats`, `getAuthorsApprovedBookPoints`, `getTeamBookPointsStats`, both portfolio routes) → Tasks 3–6. §4 (dedup tie-break) → Tasks 3–5. §5 (UI badge) → Task 7. Rollout order (schema → app changes → user merges/deploys → backfill) → Task ordering 1→7 before 8, with Task 8 explicitly written to run against production only after the schema has shipped there.
- **Type consistency:** `frozen_book_points` is `string | null` throughout (PostgREST numeric-as-string, per `src/lib/books/points.ts`'s own documented convention) — consistent across Task 2's type additions, Tasks 3–5's `BookRow` types, and Task 6/7's usage. `pointsNumber()` is the single coercion point used everywhere a raw string needs to become a number for arithmetic or display, never a bare `Number(...)` on the new field.
- **Task 5's query-shape change** (dropping the separate `books`/`content_sources` lookup) is a bigger structural change than Tasks 3–4's — flagged explicitly in Task 5 with an extra full-suite test run (Step 5) to catch any other test relying on the old two-query shape, since this is the one place a fresh reviewer might reasonably want to slow down and check more carefully.
