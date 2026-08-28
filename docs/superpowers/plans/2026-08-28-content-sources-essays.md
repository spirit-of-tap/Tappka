# Content Sources for Essays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let students write essays about podcasts, conferences, and programs (not just books), earning points the same way book essays do, without touching the existing `books` table or its code.

**Architecture:** A new `content_sources` table (generic shape: title/creator/description/link/points/status) parallel to `books`. `essays` gets a second nullable FK, `content_source_id`, alongside the existing `book_id`, guarded by a check constraint so an essay is about at most one thing. Points aggregation, the essay editor, essay display, and the discovery page are extended to read from whichever source is set, via one small display helper rather than scattered branching.

**Tech Stack:** Next.js App Router, Drizzle (schema-only, migration generation), Supabase (Postgres + RLS + supabase-js), TypeScript, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-28-content-sources-essays-design.md`

## Global Constraints

- TypeScript strict mode — no `any`; DB-derived row types use `type` (via `Tables<'x'>`), everything else `interface`.
- Naming: PascalCase components/types, camelCase vars/functions, UPPER_SNAKE_CASE constants, kebab-case files.
- Prefer `??` over `||`.
- Czech user-facing copy must be gender-neutral (colon pairs like `autor:ka`, never parentheses/slashes).
- Never hand-write DB row types — derive via `Tables<'x'>` / `Database['public']['Enums']['x']`.
- Schema changes go in `db/schema/*.ts` only; never hand-edit `supabase/migrations/*`. After editing schema, **prompt the user to run `pnpm db:migrate` and to review the generated migration for drops** — do not run it yourself unless the user explicitly insists, and then only via `pnpm db:up`.
- Every new table gets RLS enabled.
- Realtime, if ever added here, must use `broadcast`, never `postgres_changes` (not needed by this plan — no realtime surface is introduced).
- Test placement: pure logic → unit (`*.test.ts` next to source), React rendering → component (`*.test.tsx` next to component), DB schema/constraints/RLS → integration (`tests/integration/*.int.test.ts`), user flows → E2E. supabase-js query/route code is not integration-testable (PostgREST doesn't run in the test container) — its coverage is E2E, which is out of scope for this plan (see "Out of scope").

---

## File Structure

New files:
- `db/schema/content-sources.ts` — enums, `content_sources` table, RLS.
- `src/lib/content-sources/types.ts` — `ContentSource`, `CreateContentSourceInput`, kind/status labels, icon map.
- `src/lib/content-sources/points.ts` — allowed point values + podcast default.
- `src/lib/content-sources/queries.ts` — `getContentSources`, `getContentSourceById`.
- `src/lib/essays/validate-source.ts` — pure mutual-exclusivity check shared by both essay API routes.
- `src/lib/essays/source-display.ts` — `getEssaySourceDisplay`, the single place that branches on `book` vs `content_source`.
- `src/components/content-sources/content-source-illustration.tsx` — kind → icon tile (replaces a cover image).
- `src/components/content-sources/content-source-form.tsx` — submission form (kind, title, creator, description, link, points).
- `src/components/content-sources/content-source-card.tsx` — catalog list card.
- `src/components/content-sources/content-source-picker.tsx` — search/select/create-inline widget used by the essay editor.
- `src/components/content-sources/content-source-review-list.tsx` — coach review queue (approve/archive + point override).
- `src/app/api/content-sources/route.ts` — `GET` (list/catalog), `POST` (submit).
- `src/app/api/content-sources/search/route.ts` — `GET` quick search for the picker.
- `src/app/api/content-sources/[id]/route.ts` — `GET` one, `PATCH` (coach review decision).
- `src/app/(main)/cteni/zdroje/page.tsx` — catalog/browse.
- `src/app/(main)/cteni/zdroje/nova/page.tsx` — submission page.
- `src/app/(main)/cteni/zdroje/ke-schvaleni/page.tsx` — coach review queue page.
- `tests/integration/content-sources.int.test.ts`.

Modified files:
- `db/schema/essays.ts` — add `content_source_id` FK + check constraint.
- `src/lib/essays/types.ts` — extend `EssayWithDetails`, `CreateEssayInput`, `UpdateEssayInput`.
- `src/lib/essays/queries.ts` — extend the join/mapping and the three points-aggregation functions.
- `src/app/api/essays/route.ts`, `src/app/api/essays/[id]/route.ts` — accept/validate `content_source_id`.
- `src/components/essays/essay-card.tsx` — source-agnostic rendering.
- `src/components/essays/essay-editor-form.tsx` — kind toggle + content-source picker.
- `src/components/essays/essay-editor-form.test.tsx` — fixture gains `content_source: null`.
- `src/components/cteni/cteni-tab-bar.tsx`, `.test.tsx` — route new `/cteni/zdroje/*` paths to the right tab.
- `src/app/(main)/cteni/sprava/page.tsx` — link to the new review queue.
- `src/app/(main)/cteni/hledat/page.tsx`, `src/components/search/search-page-client.tsx` — new, separate "Ostatní zdroje" section.

---

### Task 1: Schema — `content_sources` table

**Files:**
- Create: `db/schema/content-sources.ts`

**Interfaces:**
- Produces: `contentSourceKind` (pgEnum: `podcast|conference|program|other`), `contentSourceStatus` (pgEnum: `pending_review|approved|archived`), `contentSources` (pgTable).

- [ ] **Step 1: Write the schema file**

```typescript
// db/schema/content-sources.ts
// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// Please look at CONTRIBUTING.md for more information on how to change the schema.
import { pgTable, foreignKey, pgPolicy, uuid, text, numeric, timestamp, index, check, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profiles } from "./profiles"

export const contentSourceKind = pgEnum("content_source_kind", ['podcast', 'conference', 'program', 'other'])
export const contentSourceStatus = pgEnum("content_source_status", ['pending_review', 'approved', 'archived'])

export const contentSources = pgTable("content_sources", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	kind: contentSourceKind().notNull(),
	title: text().notNull(),
	creator: text(),
	description: text(),
	externalUrl: text("external_url"),
	points: numeric("points", { precision: 3, scale: 2 }),
	status: contentSourceStatus().default('pending_review').notNull(),
	statusChangedAt: timestamp("status_changed_at", { withTimezone: true, mode: 'string' }),
	statusChangedByProfileId: uuid("status_changed_by_profile_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("content_sources_created_by_idx").using("btree", table.createdByProfileId.asc().nullsLast().op("uuid_ops")),
	index("content_sources_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "content_sources_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "content_sources_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.statusChangedByProfileId],
			foreignColumns: [profiles.id],
			name: "content_sources_status_changed_by_profile_id_fkey"
		}).onDelete("set null"),
	pgPolicy("Authenticated users can view all content sources", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Authenticated users can add content sources", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(created_by_profile_id = current_profile_id())` }),
	pgPolicy("Coaches and admins can update content sources", { as: "permissive", for: "update", to: ["authenticated"], using: sql`is_coach_or_admin()`, withCheck: sql`is_coach_or_admin()` }),
	pgPolicy("Coaches and admins can delete content sources", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`is_coach_or_admin()` }),
	check("content_sources_points_check", sql`(points IS NULL) OR ((points >= (0)::numeric) AND (points <= (3)::numeric))`),
]).enableRLS();
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no new errors from `db/schema/content-sources.ts`.

- [ ] **Step 3: Commit**

```bash
git add db/schema/content-sources.ts
git commit -m "feat: add content_sources table schema"
```

---

### Task 2: Schema — essays gain `content_source_id`

**Files:**
- Modify: `db/schema/essays.ts`

**Interfaces:**
- Consumes: `contentSources` from `./content-sources` (Task 1).
- Produces: `essays.contentSourceId` column, `essays_content_source_id_fkey`, `essays_source_exclusive_check`.

- [ ] **Step 1: Add the import**

In `db/schema/essays.ts`, change:

```typescript
import { profiles } from "./profiles"
import { books } from "./books"
```

to:

```typescript
import { profiles } from "./profiles"
import { books } from "./books"
import { contentSources } from "./content-sources"
```

- [ ] **Step 2: Add the column**

In the `essays` table's column list, right after `bookId: uuid("book_id"),`, add:

```typescript
	contentSourceId: uuid("content_source_id"),
```

- [ ] **Step 3: Add the index, FK, and check constraint**

In the `essays` table's `(table) => [ ... ]` array, right after the existing `index("essays_book_idx", ...)` line, add:

```typescript
	index("essays_content_source_idx").using("btree", table.contentSourceId.asc().nullsLast().op("uuid_ops")),
```

Right after the existing `essays_book_id_fkey` foreign key block, add:

```typescript
	foreignKey({
			columns: [table.contentSourceId],
			foreignColumns: [contentSources.id],
			name: "essays_content_source_id_fkey"
		}).onDelete("set null"),
```

Right after the last `pgPolicy(...)` entry (before the closing `]).enableRLS();`), add:

```typescript
	check("essays_source_exclusive_check", sql`NOT ((book_id IS NOT NULL) AND (content_source_id IS NOT NULL))`),
```

- [ ] **Step 4: Verify it typechecks**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add db/schema/essays.ts
git commit -m "feat: add essays.content_source_id with mutual-exclusivity check"
```

---

### Task 3: Generate and apply the migration (manual gate)

**Files:** none (generates into `supabase/migrations/`, not hand-edited).

- [ ] **Step 1: Generate the migration**

Run: `pnpm db:generate`
Expected: a new timestamped file under `supabase/migrations/` creating `content_source_kind`, `content_source_status`, `content_sources`, and altering `essays` to add `content_source_id` + the two new constraints. No `DROP` statements should appear.

- [ ] **Step 2: STOP — prompt the user**

Per `CLAUDE.md`, do not apply the migration yourself. Tell the user the migration file was generated at `supabase/migrations/<generated-name>.sql`, ask them to review it for any unexpected drops, and ask them to run `pnpm db:migrate` (which runs generate + `supabase start` + `db:up` + regenerates `database.types.ts` + exports SQL). Do not proceed to Task 4 until the user confirms this has been run — Task 4's integration test needs `content_sources` to exist in `supabase/migrations` (already true after Step 1) and the new `Database` types from `db:types` for later TypeScript tasks to compile.

- [ ] **Step 3: Commit the generated migration + regenerated types/journal**

Once the user confirms `pnpm db:migrate` ran successfully:

```bash
git add supabase/migrations src/lib/supabase/database.types.ts
git commit -m "chore: apply content_sources migration"
```

---

### Task 4: Integration tests — RLS and the exclusivity check

**Files:**
- Create: `tests/integration/content-sources.int.test.ts`

**Interfaces:**
- Consumes: `withRollback` from `@/tests/setup/tx`, `insertAuthUser` from `@/tests/setup/factories`, `asClaims` from `@/tests/setup/rls` (existing helpers, same pattern as `tests/integration/add-book.int.test.ts`).

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/integration/content-sources.int.test.ts
import { describe, expect, it } from 'vitest';
import { withRollback } from '@/tests/setup/tx';
import { insertAuthUser } from '@/tests/setup/factories';
import { asClaims } from '@/tests/setup/rls';

async function seedStudent(client: import('pg').PoolClient) {
  const auth = await insertAuthUser(client);
  const { rows: userRows } = await client.query(
    'select id from public.users where auth_user_id = $1',
    [auth.id],
  );
  await client.query(
    `update public.users set verified_work_email = google_email,
     verified_work_email_at = now() where id = $1`,
    [userRows[0].id],
  );
  const workEmail = `tecko-${auth.id}@studenti.czu.cz`;
  await client.query(
    `insert into public.profiles (name, work_email, user_id, role)
     values ('Téčko', $2, $1, 'student')`,
    [userRows[0].id, workEmail],
  );
  const { rows } = await client.query(
    'select id from public.profiles where user_id = $1',
    [userRows[0].id],
  );
  return { authId: auth.id, profileId: rows[0].id as string };
}

describe('content_sources', () => {
  it('stores a podcast submission with self-assigned points', async () => {
    await withRollback(async (client) => {
      const student = await seedStudent(client);
      await asClaims(client, { sub: student.authId });

      const { rows } = await client.query(
        `insert into public.content_sources
           (kind, title, creator, points, created_by_profile_id, updated_by_profile_id)
         values ('podcast', 'Founders', 'David Senra', 0.5, $1, $1)
         returning kind, title, points, status`,
        [student.profileId],
      );

      expect(rows[0].kind).toBe('podcast');
      expect(rows[0].points).toBe('0.50');
      expect(rows[0].status).toBe('pending_review');
    });
  });

  it('refuses points outside 0..3', async () => {
    await withRollback(async (client) => {
      const student = await seedStudent(client);
      await asClaims(client, { sub: student.authId });

      await expect(
        client.query(
          `insert into public.content_sources
             (kind, title, points, created_by_profile_id, updated_by_profile_id)
           values ('podcast', 'Too much', 5, $1, $1)`,
          [student.profileId],
        ),
      ).rejects.toThrow();
    });
  });

  it('refuses a content source created on behalf of another profile', async () => {
    await withRollback(async (client) => {
      const student = await seedStudent(client);
      const other = await seedStudent(client);
      await asClaims(client, { sub: student.authId });

      await expect(
        client.query(
          `insert into public.content_sources (kind, title, created_by_profile_id, updated_by_profile_id)
           values ('podcast', 'Cizí zdroj', $1, $1)`,
          [other.profileId],
        ),
      ).rejects.toThrow();
    });
  });

  it('refuses a plain student update (coach/admin only)', async () => {
    await withRollback(async (client) => {
      const student = await seedStudent(client);
      await asClaims(client, { sub: student.authId });

      const { rows } = await client.query(
        `insert into public.content_sources (kind, title, created_by_profile_id, updated_by_profile_id)
         values ('podcast', 'Mine', $1, $1) returning id`,
        [student.profileId],
      );

      await expect(
        client.query(
          `update public.content_sources set status = 'approved' where id = $1`,
          [rows[0].id],
        ),
      ).rejects.toThrow();
    });
  });
});

describe('essays source exclusivity', () => {
  it('refuses an essay linked to both a book and a content source', async () => {
    await withRollback(async (client) => {
      const student = await seedStudent(client);
      await asClaims(client, { sub: student.authId });

      const { rows: bookRows } = await client.query(
        `insert into public.books (title_cs, author, created_by_profile_id, updated_by_profile_id)
         values ('Sprint', 'Jake Knapp', $1, $1) returning id`,
        [student.profileId],
      );
      const { rows: sourceRows } = await client.query(
        `insert into public.content_sources (kind, title, created_by_profile_id, updated_by_profile_id)
         values ('podcast', 'Founders', $1, $1) returning id`,
        [student.profileId],
      );

      await expect(
        client.query(
          `insert into public.essays (author_profile_id, book_id, content_source_id, created_by_profile_id, updated_by_profile_id)
           values ($1, $2, $3, $1, $1)`,
          [student.profileId, bookRows[0].id, sourceRows[0].id],
        ),
      ).rejects.toThrow();
    });
  });

  it('allows an essay linked to a content source alone', async () => {
    await withRollback(async (client) => {
      const student = await seedStudent(client);
      await asClaims(client, { sub: student.authId });

      const { rows: sourceRows } = await client.query(
        `insert into public.content_sources (kind, title, created_by_profile_id, updated_by_profile_id)
         values ('podcast', 'Founders', $1, $1) returning id`,
        [student.profileId],
      );

      const { rows } = await client.query(
        `insert into public.essays (author_profile_id, content_source_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $2, $1, $1) returning content_source_id, book_id`,
        [student.profileId, sourceRows[0].id],
      );

      expect(rows[0].content_source_id).toBe(sourceRows[0].id);
      expect(rows[0].book_id).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails (before Task 3's migration is applied)**

Run: `pnpm test:integration -- content-sources.int.test.ts`
Expected: FAIL with a Postgres error about the missing `content_sources` relation, if run before Task 3's migration is applied. If Task 3 is already applied, skip to Step 3.

- [ ] **Step 3: Run to verify it passes**

Run: `pnpm test:integration -- content-sources.int.test.ts`
Expected: all 6 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/content-sources.int.test.ts
git commit -m "test: cover content_sources RLS and essays source exclusivity"
```

---

### Task 5: Types and constants for content sources

**Files:**
- Create: `src/lib/content-sources/types.ts`

**Interfaces:**
- Consumes: `Tables` from `@/lib/supabase/tables`, `Database` from `@/lib/supabase/database.types` (both regenerated in Task 3).
- Produces: `ContentSource`, `ContentSourceKind`, `ContentSourceStatus`, `CreateContentSourceInput`, `CONTENT_SOURCE_KIND_LABELS`, `CONTENT_SOURCE_STATUS_LABELS`.

- [ ] **Step 1: Write the file**

```typescript
// src/lib/content-sources/types.ts
import type { Database } from '@/lib/supabase/database.types';
import type { Tables } from '@/lib/supabase/tables';

export type ContentSourceKind = Database['public']['Enums']['content_source_kind'];
export type ContentSourceStatus = Database['public']['Enums']['content_source_status'];

export type ContentSource = Tables<'content_sources'>;

export interface CreateContentSourceInput {
  kind: ContentSourceKind;
  title: string;
  creator?: string | null;
  description?: string | null;
  external_url?: string | null;
  /** Student's self-assigned value; a coach may override it on review. */
  points?: number | null;
}

export const CONTENT_SOURCE_KIND_LABELS: Record<ContentSourceKind, string> = {
  podcast: 'Podcast',
  conference: 'Konference',
  program: 'Program',
  other: 'Jiný zdroj',
};

export const CONTENT_SOURCE_STATUS_LABELS: Record<ContentSourceStatus, string> = {
  pending_review: 'Čeká na schválení',
  approved: 'Schváleno',
  archived: 'Zamítnuto',
};

export const CONTENT_SOURCE_KINDS: readonly ContentSourceKind[] = ['podcast', 'conference', 'program', 'other'];
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors. (This step depends on Task 3 having regenerated `database.types.ts` with the `content_sources` table and its two enums.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/content-sources/types.ts
git commit -m "feat: add content source types and labels"
```

---

### Task 6: Points helper for content sources

**Files:**
- Create: `src/lib/content-sources/points.ts`
- Test: `src/lib/content-sources/points.test.ts`

**Interfaces:**
- Consumes: `ContentSourceKind` from `./types` (Task 5).
- Produces: `CONTENT_SOURCE_POINT_VALUES`, `defaultContentSourcePoints(kind)`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/content-sources/points.test.ts
import { describe, expect, it } from 'vitest';
import { defaultContentSourcePoints, CONTENT_SOURCE_POINT_VALUES } from './points';

describe('defaultContentSourcePoints', () => {
  it('pre-fills 0.5 for a podcast', () => {
    expect(defaultContentSourcePoints('podcast')).toBe(0.5);
  });

  it('has no pre-fill for conference, program, or other', () => {
    expect(defaultContentSourcePoints('conference')).toBeNull();
    expect(defaultContentSourcePoints('program')).toBeNull();
    expect(defaultContentSourcePoints('other')).toBeNull();
  });

  it('exposes the allowed point values', () => {
    expect(CONTENT_SOURCE_POINT_VALUES).toEqual([0, 0.5, 1, 2, 3]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/content-sources/points.test.ts`
Expected: FAIL with "Cannot find module './points'" or similar.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/content-sources/points.ts
import type { ContentSourceKind } from './types';

/**
 * The allowed self-assigned point values. Includes 0.5 (the podcast default)
 * alongside the whole-number set books use — the DB only enforces 0..3, this
 * is the UI's picklist.
 */
export const CONTENT_SOURCE_POINT_VALUES = [0, 0.5, 1, 2, 3] as const;

export type ContentSourcePoints = (typeof CONTENT_SOURCE_POINT_VALUES)[number];

/**
 * Form pre-fill only — never a stored default or a DB constraint. A student
 * can still change it before submitting; other kinds start blank.
 */
export function defaultContentSourcePoints(kind: ContentSourceKind): ContentSourcePoints | null {
  return kind === 'podcast' ? 0.5 : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/content-sources/points.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/content-sources/points.ts src/lib/content-sources/points.test.ts
git commit -m "feat: add content source point defaults"
```

---

### Task 7: Query layer for content sources

**Files:**
- Create: `src/lib/content-sources/queries.ts`

**Interfaces:**
- Consumes: `ContentSource` from `./types` (Task 5).
- Produces: `getContentSources(supabase, filters?)`, `getContentSourceById(supabase, id)`.

No dedicated unit test: these are thin `supabase-js` passthroughs (same as `src/lib/books/queries.ts`, which has no test file either) — PostgREST can't run in the integration container, so this layer's coverage is E2E (out of scope here, see "Out of scope").

- [ ] **Step 1: Write the file**

```typescript
// src/lib/content-sources/queries.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { ContentSource, ContentSourceStatus } from './types';

export interface ContentSourceFilters {
  status?: ContentSourceStatus;
  createdBy?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

const PAGE_SIZE_DEFAULT = 20;

export async function getContentSources(
  supabase: SupabaseClient<Database>,
  filters: ContentSourceFilters = {},
): Promise<ContentSource[]> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? PAGE_SIZE_DEFAULT;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('content_sources')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to);

  query = query.eq('status', filters.status ?? 'approved');
  if (filters.createdBy) query = query.eq('created_by_profile_id', filters.createdBy);
  if (filters.search?.trim()) query = query.ilike('title', `%${filters.search.trim()}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ContentSource[];
}

export async function getContentSourceById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<ContentSource | null> {
  const { data, error } = await supabase
    .from('content_sources')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as ContentSource | null;
}

export async function getPendingContentSources(
  supabase: SupabaseClient<Database>,
): Promise<ContentSource[]> {
  const { data, error } = await supabase
    .from('content_sources')
    .select('*')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ContentSource[];
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/content-sources/queries.ts
git commit -m "feat: add content source query helpers"
```

---

### Task 8: API routes for content sources

**Files:**
- Create: `src/app/api/content-sources/route.ts`
- Create: `src/app/api/content-sources/search/route.ts`
- Create: `src/app/api/content-sources/[id]/route.ts`

**Interfaces:**
- Consumes: `getContentSources`, `getContentSourceById`, `getPendingContentSources` from `@/lib/content-sources/queries` (Task 7); `CreateContentSourceInput`, `CONTENT_SOURCE_KINDS` from `@/lib/content-sources/types` (Task 5); `CONTENT_SOURCE_POINT_VALUES` from `@/lib/content-sources/points` (Task 6); `getCurrentUserProfile` from `@/lib/auth-helpers`; `createClient` from `@/lib/supabase/server`.

- [ ] **Step 1: Write the list/create route**

```typescript
// src/app/api/content-sources/route.ts
import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getContentSources, getPendingContentSources } from '@/lib/content-sources/queries';
import { CONTENT_SOURCE_KINDS } from '@/lib/content-sources/types';
import { CONTENT_SOURCE_POINT_VALUES } from '@/lib/content-sources/points';
import type { CreateContentSourceInput, ContentSourceStatus } from '@/lib/content-sources/types';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    if (status === 'pending_review') {
      const profile = await getCurrentUserProfile(supabase, { user });
      if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
        return NextResponse.json({ error: 'Nedostatečná oprávnění' }, { status: 403 });
      }
      const sources = await getPendingContentSources(supabase);
      return NextResponse.json({ data: sources });
    }

    const sources = await getContentSources(supabase, {
      status: (status as ContentSourceStatus | null) ?? undefined,
      search: searchParams.get('q') ?? undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
      pageSize: searchParams.get('page_size') ? Number(searchParams.get('page_size')) : undefined,
    });
    return NextResponse.json({ data: sources });
  } catch (error) {
    console.error('GET /api/content-sources error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst zdroje' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const body: CreateContentSourceInput = await request.json();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Název je povinný' }, { status: 400 });
    }
    if (!CONTENT_SOURCE_KINDS.includes(body.kind)) {
      return NextResponse.json({ error: 'Neplatný typ zdroje' }, { status: 400 });
    }
    if (body.points != null && !(CONTENT_SOURCE_POINT_VALUES as readonly number[]).includes(body.points)) {
      return NextResponse.json({ error: 'Neplatný počet bodů' }, { status: 400 });
    }

    const { data: inserted, error } = await supabase
      .from('content_sources')
      .insert({
        kind: body.kind,
        title: body.title.trim(),
        creator: body.creator?.trim() || null,
        description: body.description?.trim() || null,
        external_url: body.external_url?.trim() || null,
        points: body.points ?? null,
        created_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data: inserted }, { status: 201 });
  } catch (error) {
    console.error('POST /api/content-sources error:', error);
    return NextResponse.json({ error: 'Nepodařilo se přidat zdroj' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write the quick-search route (used by the essay editor picker)**

```typescript
// src/app/api/content-sources/search/route.ts
import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getContentSources } from '@/lib/content-sources/queries';

const SEARCH_LIMIT = 10;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const q = new URL(request.url).searchParams.get('q') ?? '';
    if (!q.trim()) return NextResponse.json({ data: [] });

    const sources = await getContentSources(supabase, { search: q, pageSize: SEARCH_LIMIT });
    return NextResponse.json({ data: sources });
  } catch (error) {
    console.error('GET /api/content-sources/search error:', error);
    return NextResponse.json({ error: 'Vyhledávání selhalo' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Write the single-item + review route**

```typescript
// src/app/api/content-sources/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getContentSourceById } from '@/lib/content-sources/queries';
import { CONTENT_SOURCE_POINT_VALUES } from '@/lib/content-sources/points';
import type { ContentSourceStatus } from '@/lib/content-sources/types';

const REVIEW_STATUSES: ContentSourceStatus[] = ['approved', 'archived'];

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const source = await getContentSourceById(supabase, id);
    if (!source) return NextResponse.json({ error: 'Zdroj nenalezen' }, { status: 404 });

    return NextResponse.json({ data: source });
  } catch (error) {
    console.error('GET /api/content-sources/[id] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst zdroj' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
      return NextResponse.json({ error: 'Nedostatečná oprávnění' }, { status: 403 });
    }

    const body: { status: ContentSourceStatus; points?: number | null } = await request.json();

    if (!REVIEW_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'Neplatný stav' }, { status: 400 });
    }
    if (body.points != null && !(CONTENT_SOURCE_POINT_VALUES as readonly number[]).includes(body.points)) {
      return NextResponse.json({ error: 'Neplatný počet bodů' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('content_sources')
      .update({
        status: body.status,
        points: body.points ?? undefined,
        status_changed_at: new Date().toISOString(),
        status_changed_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('PATCH /api/content-sources/[id] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se uložit rozhodnutí' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Verify it typechecks**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/content-sources
git commit -m "feat: add content sources API routes"
```

---

### Task 9: Essay types — extend for content sources + validation helper

**Files:**
- Modify: `src/lib/essays/types.ts`
- Create: `src/lib/essays/validate-source.ts`
- Test: `src/lib/essays/validate-source.test.ts`

**Interfaces:**
- Consumes: `ContentSource` from `@/lib/content-sources/types` (Task 5).
- Produces: `EssayWithDetails.content_source`, `CreateEssayInput.content_source_id`, `UpdateEssayInput.content_source_id`, `validateEssaySourceIds(bookId, contentSourceId)`.

- [ ] **Step 1: Write the failing validation test**

```typescript
// src/lib/essays/validate-source.test.ts
import { describe, expect, it } from 'vitest';
import { validateEssaySourceIds } from './validate-source';

describe('validateEssaySourceIds', () => {
  it('allows a book alone', () => {
    expect(validateEssaySourceIds('book-1', undefined)).toBeNull();
  });

  it('allows a content source alone', () => {
    expect(validateEssaySourceIds(undefined, 'source-1')).toBeNull();
  });

  it('allows neither (essay beyond the reading list)', () => {
    expect(validateEssaySourceIds(undefined, undefined)).toBeNull();
    expect(validateEssaySourceIds(null, null)).toBeNull();
  });

  it('rejects both set at once', () => {
    expect(validateEssaySourceIds('book-1', 'source-1')).toBe(
      'Esej může patřit jen ke knize, nebo jen k jinému zdroji.',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/essays/validate-source.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/essays/validate-source.ts
/**
 * An essay is about at most one thing — mirrors the `essays_source_exclusive_check`
 * DB constraint so the API can return a friendly 400 instead of a raw SQL error.
 */
export function validateEssaySourceIds(
  bookId: string | null | undefined,
  contentSourceId: string | null | undefined,
): string | null {
  if (bookId && contentSourceId) {
    return 'Esej může patřit jen ke knize, nebo jen k jinému zdroji.';
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/essays/validate-source.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Extend `EssayWithDetails` and the input types**

In `src/lib/essays/types.ts`, add the import:

```typescript
import type { ContentSource } from '@/lib/content-sources/types';
```

Change `EssayWithDetails`:

```typescript
export interface EssayWithDetails extends Essay {
  author: Pick<Profile, 'id' | 'name' | 'picture' | 'role' | 'team_id'> | null;
  book: (Pick<Book, 'id' | 'title_cs' | 'author' | 'book_points' | 'list_status' | 'is_rocket_model' | 'google_books_cover_url'> & {
    highlight_category: HighlightCategory | null;
  }) | null;
  content_source: Pick<ContentSource, 'id' | 'kind' | 'title' | 'creator' | 'points' | 'status'> | null;
  comment_count: number;
}
```

Add `content_source_id` to `Essay`, right after `book_id: string | null;`:

```typescript
  content_source_id: string | null;
```

Update `CreateEssayInput` and `UpdateEssayInput`:

```typescript
export interface CreateEssayInput {
  title: string;
  content_json: object;
  content_text?: string;
  book_id?: string;
  content_source_id?: string;
}

export interface UpdateEssayInput {
  title?: string;
  content_json?: object;
  content_text?: string;
  book_id?: string | null;
  content_source_id?: string | null;
}
```

- [ ] **Step 6: Verify it typechecks**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: errors in `src/lib/essays/queries.ts` and any fixture constructing a literal `EssayWithDetails`/`Essay` without `content_source`/`content_source_id` — expected at this point; Task 10 and Task 14's fixture update resolve them.

- [ ] **Step 7: Commit**

```bash
git add src/lib/essays/types.ts src/lib/essays/validate-source.ts src/lib/essays/validate-source.test.ts
git commit -m "feat: extend essay types for content sources"
```

---

### Task 10: Essay queries — join, mapping, and points aggregation

**Files:**
- Modify: `src/lib/essays/queries.ts`

**Interfaces:**
- Consumes: `validateEssaySourceIds` not used here (API-route only); reads `content_source_id` (Task 9), `content_sources` table (Task 1).
- Produces: `mapEssayRows` now populates `content_source`; `getUserBookPointsStats`, `getAuthorsApprovedBookPoints`, `getTeamBookPointsStats` now include content-source points in their totals.

- [ ] **Step 1: Extend the join select and raw-row type**

In `src/lib/essays/queries.ts`, change `ESSAY_DETAIL_SELECT`:

```typescript
const ESSAY_DETAIL_SELECT = `
  *,
  essay_revisions(title, content_json, revision_no, invalid_since, created_at, updated_at),
  essay_votes(count),
  essay_views(count),
  essay_comments(count),
  author:profiles!author_profile_id(id, name, picture, role, team_id),
  book:books!book_id(id, title_cs, author, book_points, list_status, is_rocket_model, google_books_cover_url, highlight_category:highlight_categories(*)),
  content_source:content_sources!content_source_id(id, kind, title, creator, points, status)
`;
```

Add to `EssayRawRow`, right after the `book` field:

```typescript
  content_source_id: string | null;
  content_source: EssayWithDetails['content_source'];
```

- [ ] **Step 2: Pass `content_source` through in `mapEssayRows`**

Change the destructure and return in `mapEssayRows`:

```typescript
    const {
      essay_revisions,
      essay_votes,
      essay_views,
      essay_comments,
      created_by_profile_id: _createdBy,
      updated_by_profile_id: _updatedBy,
      book,
      content_source,
      ...rest
    } = row;
```

and in the returned object, right after the `book:` line:

```typescript
      content_source: content_source ?? null,
```

- [ ] **Step 3: Include content-source points in `getUserBookPointsStats`**

Replace the function body with a version that also scans content-source-linked essays:

```typescript
export async function getUserBookPointsStats(
  supabase: SupabaseClient<Database>,
  profileId: string,
  /** Injectable for tests / deterministic rendering. */
  now: Date = new Date(),
): Promise<{
  approved_points: number;
  pending_points: number;
  essay_count: number;
  /** Points approved in the current semester (winter Sep–Jan, summer Feb–Aug). */
  approved_points_this_semester: number;
}> {
  const { data: bookEssays, error } = await supabase
    .from('essays')
    .select('book_id, published_at, books!inner(book_points, list_status)')
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

  type BookRow = { book_id: string; published_at: string; books: { book_points: number; list_status: string } };
  type SourceRow = { content_source_id: string; published_at: string; content_sources: { points: number; status: string } };

  const ELIGIBLE = new Set<string>(POINTS_ELIGIBLE_LIST_STATUSES);
  const approved = new Map<string, number>();
  const pending = new Set<string>();
  const semesterApproved = new Set<string>();
  const { start: semesterStart } = getCurrentSemesterRange(now);

  for (const row of (bookEssays ?? []) as unknown as BookRow[]) {
    if (!row.book_id) continue;
    if (ELIGIBLE.has(row.books.list_status)) {
      approved.set(`book:${row.book_id}`, Number(row.books.book_points));
      if (new Date(row.published_at) >= semesterStart) semesterApproved.add(`book:${row.book_id}`);
    } else if (row.books.list_status === 'processing') {
      pending.add(`book:${row.book_id}`);
    }
  }

  for (const row of (sourceEssays ?? []) as unknown as SourceRow[]) {
    if (!row.content_source_id) continue;
    if (row.content_sources.status === 'approved') {
      approved.set(`source:${row.content_source_id}`, Number(row.content_sources.points));
      if (new Date(row.published_at) >= semesterStart) semesterApproved.add(`source:${row.content_source_id}`);
    } else if (row.content_sources.status === 'pending_review') {
      pending.add(`source:${row.content_source_id}`);
    }
  }

  const approved_points = Array.from(approved.values()).reduce((s, p) => s + p, 0);

  const { count } = await supabase
    .from('essays')
    .select('*', { count: 'exact', head: true })
    .eq('author_profile_id', profileId)
    .not('published_at', 'is', null)
    .is('removed_at', null);

  return {
    approved_points,
    pending_points: pending.size,
    essay_count: count ?? 0,
    approved_points_this_semester: Array.from(semesterApproved).reduce(
      (sum, key) => sum + (approved.get(key) ?? 0),
      0,
    ),
  };
}
```

- [ ] **Step 4: Include content-source points in `getAuthorsApprovedBookPoints`**

Replace the function body:

```typescript
export async function getAuthorsApprovedBookPoints(
  supabase: SupabaseClient<Database>,
  authorProfileIds: string[],
): Promise<Record<string, number>> {
  if (authorProfileIds.length === 0) return {};

  const { data: bookEssays, error } = await supabase
    .from('essays')
    .select('author_profile_id, book_id, books!inner(book_points, list_status)')
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

  type BookRow = { author_profile_id: string; book_id: string; books: { book_points: number; list_status: string } };
  type SourceRow = { author_profile_id: string; content_source_id: string; content_sources: { points: number; status: string } };

  const ELIGIBLE = new Set<string>(POINTS_ELIGIBLE_LIST_STATUSES);
  const pointsByAuthor: Record<string, Map<string, number>> = {};
  for (const authorId of authorProfileIds) {
    pointsByAuthor[authorId] = new Map();
  }

  for (const row of (bookEssays ?? []) as unknown as BookRow[]) {
    if (!row.book_id || !ELIGIBLE.has(row.books.list_status)) continue;
    pointsByAuthor[row.author_profile_id]?.set(`book:${row.book_id}`, Number(row.books.book_points));
  }

  for (const row of (sourceEssays ?? []) as unknown as SourceRow[]) {
    if (!row.content_source_id || row.content_sources.status !== 'approved') continue;
    pointsByAuthor[row.author_profile_id]?.set(`source:${row.content_source_id}`, Number(row.content_sources.points));
  }

  const result: Record<string, number> = {};
  for (const [authorId, pointsMap] of Object.entries(pointsByAuthor)) {
    result[authorId] = Array.from(pointsMap.values()).reduce((sum, p) => sum + p, 0);
  }

  return result;
}
```

- [ ] **Step 5: Include content-source points in `getTeamBookPointsStats`**

Replace the function body:

```typescript
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
    .select('author_profile_id, book_id, books!inner(book_points, list_status)')
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

  type EssayRow = { author_profile_id: string; book_id: string; books: { book_points: number; list_status: string } };
  type SourceRow = { author_profile_id: string; content_source_id: string; content_sources: { points: number; status: string } };

  const ELIGIBLE = new Set<string>(POINTS_ELIGIBLE_LIST_STATUSES);
  const byProfile: Record<string, { approved: Set<string>; pending: Set<string> }> = {};
  for (const profileId of profileIds) {
    byProfile[profileId] = { approved: new Set(), pending: new Set() };
  }

  for (const essay of (bookEssays ?? []) as unknown as EssayRow[]) {
    const bucket = byProfile[essay.author_profile_id];
    if (!bucket || !essay.book_id) continue;
    if (ELIGIBLE.has(essay.books.list_status)) {
      bucket.approved.add(`book:${essay.book_id}`);
    } else if (essay.books.list_status === 'processing') {
      bucket.pending.add(`book:${essay.book_id}`);
    }
  }

  for (const essay of (sourceEssays ?? []) as unknown as SourceRow[]) {
    const bucket = byProfile[essay.author_profile_id];
    if (!bucket || !essay.content_source_id) continue;
    if (essay.content_sources.status === 'approved') {
      bucket.approved.add(`source:${essay.content_source_id}`);
    } else if (essay.content_sources.status === 'pending_review') {
      bucket.pending.add(`source:${essay.content_source_id}`);
    }
  }

  const { data: approvedBooks, error: booksError } = await supabase
    .from('books')
    .select('id, book_points')
    .in('list_status', ['shortlist', 'longlist']);

  if (booksError) throw booksError;

  const { data: approvedSources, error: sourcesLookupError } = await supabase
    .from('content_sources')
    .select('id, points')
    .eq('status', 'approved');

  if (sourcesLookupError) throw sourcesLookupError;

  const pointsMap: Record<string, number> = {};
  for (const book of (approvedBooks ?? []) as { id: string; book_points: number }[]) {
    pointsMap[`book:${book.id}`] = Number(book.book_points);
  }
  for (const source of (approvedSources ?? []) as { id: string; points: number }[]) {
    pointsMap[`source:${source.id}`] = Number(source.points);
  }

  return teamProfiles.map((profile) => {
    const bucket = byProfile[profile.id];
    let approved_points = 0;

    for (const key of bucket.approved) {
      approved_points += pointsMap[key] ?? 0;
    }

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

- [ ] **Step 6: Verify it typechecks**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors from `src/lib/essays/queries.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/essays/queries.ts
git commit -m "feat: include content sources in essay queries and points totals"
```

---

### Task 11: Essay API routes — wire `content_source_id` through

**Files:**
- Modify: `src/app/api/essays/route.ts`
- Modify: `src/app/api/essays/[id]/route.ts`

**Interfaces:**
- Consumes: `validateEssaySourceIds` from `@/lib/essays/validate-source` (Task 9).

- [ ] **Step 1: Update the POST handler**

In `src/app/api/essays/route.ts`, add the import:

```typescript
import { validateEssaySourceIds } from '@/lib/essays/validate-source';
```

Change the body destructure and add validation right after it:

```typescript
    const body = await request.json();
    const { title, content_json, content_text, book_id, content_source_id } = body;

    const sourceError = validateEssaySourceIds(book_id, content_source_id);
    if (sourceError) {
      return NextResponse.json({ error: sourceError }, { status: 400 });
    }
```

Change the `essays` insert to include the new column:

```typescript
      .insert({
        author_profile_id: profile.id,
        book_id: book_id ?? null,
        content_source_id: content_source_id ?? null,
        published_at: null,
        created_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
      })
```

- [ ] **Step 2: Apply the equivalent change to the PATCH handler**

In `src/app/api/essays/[id]/route.ts`, add the import:

```typescript
import { validateEssaySourceIds } from '@/lib/essays/validate-source';
```

Change the update-detection and validation block:

```typescript
    const body = await request.json();
    const hasContentUpdate =
      body.title !== undefined || body.content_json !== undefined;
    const hasBookUpdate = 'book_id' in body;
    const hasSourceUpdate = 'content_source_id' in body;

    if (!hasContentUpdate && !hasBookUpdate && !hasSourceUpdate) {
      return NextResponse.json({ error: 'Žádné změny' }, { status: 400 });
    }

    if (hasBookUpdate || hasSourceUpdate) {
      const sourceError = validateEssaySourceIds(body.book_id, body.content_source_id);
      if (sourceError) {
        return NextResponse.json({ error: sourceError }, { status: 400 });
      }
    }
```

Change the `essayUpdates` type and assignment:

```typescript
    const essayUpdates: {
      updated_by_profile_id: string;
      updated_at: string;
      book_id?: string | null;
      content_source_id?: string | null;
    } = {
      updated_by_profile_id: profile.id,
      updated_at: now,
    };

    if (hasBookUpdate) {
      essayUpdates.book_id = body.book_id ?? null;
    }
    if (hasSourceUpdate) {
      essayUpdates.content_source_id = body.content_source_id ?? null;
    }
```

Note: `validateEssaySourceIds` here only catches the case where a single PATCH request sets both ids at once. If a caller PATCHes `content_source_id` alone while the essay already has a `book_id` (or vice versa) without clearing the other, the DB's `essays_source_exclusive_check` (Task 2) still rejects it — the route surfaces that as an unhandled 500 rather than a friendly 400. The essay editor (Task 15) always sends both fields together and clears the other when switching, so this gap does not occur in the app's own UI; leave it as-is unless a future caller needs a friendlier error for partial updates.

- [ ] **Step 3: Verify it typechecks**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/essays/route.ts "src/app/api/essays/[id]/route.ts"
git commit -m "feat: accept content_source_id on essay create/update"
```

---

### Task 12: Source-agnostic essay display helper

**Files:**
- Create: `src/lib/essays/source-display.ts`
- Test: `src/lib/essays/source-display.test.ts`

**Interfaces:**
- Consumes: `pointsNumber` from `@/lib/books/points`; `EssayWithDetails` from `./types` (Task 9).
- Produces: `getEssaySourceDisplay(essay)`, `EssaySourceDisplay`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/essays/source-display.test.ts
import { describe, expect, it } from 'vitest';
import { getEssaySourceDisplay } from './source-display';

describe('getEssaySourceDisplay', () => {
  it('reads title/author/points from a book', () => {
    const display = getEssaySourceDisplay({
      book: {
        id: 'b1', title_cs: 'Sprint', author: 'Jake Knapp', book_points: 2,
        list_status: 'shortlist', is_rocket_model: false, google_books_cover_url: null,
        highlight_category: null,
      },
      content_source: null,
    });
    expect(display).toEqual({
      kind: 'book', title: 'Sprint', author: 'Jake Knapp', points: 2,
      isArchived: false, illustrationKind: null,
    });
  });

  it('reads title/creator/points from a content source', () => {
    const display = getEssaySourceDisplay({
      book: null,
      content_source: { id: 's1', kind: 'podcast', title: 'Founders', creator: 'David Senra', points: 0.5, status: 'approved' },
    });
    expect(display).toEqual({
      kind: 'content_source', title: 'Founders', author: 'David Senra', points: 0.5,
      isArchived: false, illustrationKind: 'podcast',
    });
  });

  it('flags an archived content source', () => {
    const display = getEssaySourceDisplay({
      book: null,
      content_source: { id: 's1', kind: 'conference', title: 'X', creator: null, points: 1, status: 'archived' },
    });
    expect(display.isArchived).toBe(true);
  });

  it('falls back to "none" when neither is set', () => {
    const display = getEssaySourceDisplay({ book: null, content_source: null });
    expect(display).toEqual({
      kind: 'none', title: null, author: null, points: 0,
      isArchived: false, illustrationKind: null,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/essays/source-display.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/essays/source-display.ts
import { pointsNumber } from '@/lib/books/points';
import type { EssayWithDetails } from './types';

export interface EssaySourceDisplay {
  kind: 'book' | 'content_source' | 'none';
  title: string | null;
  author: string | null;
  points: number;
  isArchived: boolean;
  /** Non-null only for a content source — drives which icon tile to render. */
  illustrationKind: string | null;
}

/**
 * Single place that branches on `essay.book` vs `essay.content_source` so
 * every renderer (card, editor header, delete dialog) reads one shape.
 */
export function getEssaySourceDisplay(
  essay: Pick<EssayWithDetails, 'book' | 'content_source'>,
): EssaySourceDisplay {
  if (essay.book) {
    return {
      kind: 'book',
      title: essay.book.title_cs,
      author: essay.book.author,
      points: pointsNumber(essay.book.book_points),
      isArchived: essay.book.list_status === 'archived',
      illustrationKind: null,
    };
  }

  if (essay.content_source) {
    return {
      kind: 'content_source',
      title: essay.content_source.title,
      author: essay.content_source.creator,
      points: pointsNumber(essay.content_source.points),
      isArchived: essay.content_source.status === 'archived',
      illustrationKind: essay.content_source.kind,
    };
  }

  return { kind: 'none', title: null, author: null, points: 0, isArchived: false, illustrationKind: null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/essays/source-display.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/essays/source-display.ts src/lib/essays/source-display.test.ts
git commit -m "feat: add source-agnostic essay display helper"
```

---

### Task 13: Illustration tile component

**Files:**
- Create: `src/components/content-sources/content-source-illustration.tsx`

**Interfaces:**
- Consumes: `ContentSourceKind`, `CONTENT_SOURCE_KIND_LABELS` from `@/lib/content-sources/types` (Task 5).
- Produces: `ContentSourceIllustration`.

- [ ] **Step 1: Write the component**

```typescript
// src/components/content-sources/content-source-illustration.tsx
import { Podcast, Presentation, GraduationCap, Sparkles, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CONTENT_SOURCE_KIND_LABELS } from '@/lib/content-sources/types';
import type { ContentSourceKind } from '@/lib/content-sources/types';

const KIND_ICON: Record<ContentSourceKind, LucideIcon> = {
  podcast: Podcast,
  conference: Presentation,
  program: GraduationCap,
  other: Sparkles,
};

const KIND_COLOR: Record<ContentSourceKind, string> = {
  podcast: 'text-violet-600 dark:text-violet-400 bg-violet-500/10',
  conference: 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
  program: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
  other: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
};

interface ContentSourceIllustrationProps {
  kind: ContentSourceKind;
  className?: string;
}

/**
 * Predefined icon tile standing in for a cover image — content sources have
 * no uploaded artwork, so every source of a given kind looks the same.
 */
export function ContentSourceIllustration({ kind, className }: ContentSourceIllustrationProps) {
  const Icon = KIND_ICON[kind];
  return (
    <div
      role="img"
      aria-label={CONTENT_SOURCE_KIND_LABELS[kind]}
      className={cn('flex items-center justify-center rounded', KIND_COLOR[kind], className)}
    >
      <Icon className="size-1/2" aria-hidden="true" />
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/content-sources/content-source-illustration.tsx
git commit -m "feat: add content source illustration tile"
```

---

### Task 14: `essay-card.tsx` — source-agnostic rendering

**Files:**
- Modify: `src/components/essays/essay-card.tsx`
- Create: `src/components/essays/essay-card.test.tsx`

**Interfaces:**
- Consumes: `getEssaySourceDisplay` from `@/lib/essays/source-display` (Task 12); `ContentSourceIllustration` from `@/components/content-sources/content-source-illustration` (Task 13).

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/essays/essay-card.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EssayCard } from './essay-card';
import type { EssayWithDetails } from '@/lib/essays/types';

const baseEssay = {
  id: 'essay-1',
  author_profile_id: 'profile-1',
  book_id: null,
  content_source_id: null,
  title: 'O čem podcast mluvil',
  content_json: {},
  content_text: 'Nějaký text',
  published_at: '2026-08-01T10:00:00Z',
  view_count: 3,
  vote_count: 1,
  comment_count: 0,
  created_at: '2026-08-01T10:00:00Z',
  updated_at: '2026-08-01T10:00:00Z',
  pinned_at: null,
  pinned_by_profile_id: null,
  removed_at: null,
  author: { id: 'profile-1', name: 'Anna', picture: null, role: 'student', team_id: null },
  book: null,
  content_source: null,
} satisfies EssayWithDetails;

describe('EssayCard — content source', () => {
  it('shows the content source title and points', () => {
    render(
      <EssayCard
        essay={{
          ...baseEssay,
          content_source: { id: 's1', kind: 'podcast', title: 'Founders', creator: 'David Senra', points: 0.5, status: 'approved' },
        }}
      />,
    );

    expect(screen.getByText('Founders')).toBeInTheDocument();
    // formatPoints always renders two decimals for a non-integer value.
    expect(screen.getByText('0,50 b.')).toBeInTheDocument();
  });

  it('still shows "Nad rámec četby" when neither source is set', () => {
    render(<EssayCard essay={baseEssay} />);
    expect(screen.getByText('Nad rámec četby')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/essays/essay-card.test.tsx`
Expected: FAIL — `screen.getByText('Founders')` not found (card only renders `essay.book`).

- [ ] **Step 3: Update the component**

In `src/components/essays/essay-card.tsx`, add the imports:

```typescript
import { ContentSourceIllustration } from '@/components/content-sources/content-source-illustration';
import { getEssaySourceDisplay } from '@/lib/essays/source-display';
```

Right after `const snippet = ...` line, add:

```typescript
  const source = getEssaySourceDisplay(essay);
```

Replace the cover-image block (the `essay.book?.google_books_cover_url && (...)` section) with:

```typescript
            {essay.book?.google_books_cover_url ? (
              <div className="shrink-0 w-10 h-14 rounded overflow-hidden bg-muted">
                <StorageImage
                  storageKey={essay.book.google_books_cover_url}
                  alt={essay.book.title_cs}
                  width={40}
                  height={56}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : source.illustrationKind ? (
              <ContentSourceIllustration kind={source.illustrationKind as never} className="shrink-0 w-10 h-14" />
            ) : null}
```

Replace the "Book source" block:

```typescript
          {/* Source (book or content source) */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-t pt-2">
            {source.kind !== 'none' ? (
              <>
                <BookOpen className="size-3 shrink-0" />
                <span className="truncate">{source.title}</span>
                {essay.book && <BookStatusBadges book={essay.book} />}
                {!source.isArchived && source.points > 0 && (
                  <span className="shrink-0 ml-auto font-medium text-foreground">{formatPoints(source.points)} b.</span>
                )}
                {source.isArchived && (
                  <span className="shrink-0 ml-auto text-destructive">0 b.</span>
                )}
              </>
            ) : (
              <>
                <Sparkles className="size-3 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="text-amber-700 dark:text-amber-300">Nad rámec četby</span>
              </>
            )}
          </div>
```

Remove the now-unused `pointsNumber` import (only `formatPoints` is still used):

```typescript
import { formatPoints } from '@/lib/books/points';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/essays/essay-card.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full component suite to catch regressions**

Run: `pnpm test`
Expected: PASS, including any other test that renders `EssayCard` or constructs an `EssayWithDetails` fixture (fix any fixture missing `content_source`/`content_source_id` by adding `content_source: null, content_source_id: null`).

- [ ] **Step 6: Commit**

```bash
git add src/components/essays/essay-card.tsx src/components/essays/essay-card.test.tsx
git commit -m "feat: render content sources on the essay card"
```

---

### Task 15: `essay-editor-form.tsx` — content source picker

**Files:**
- Modify: `src/components/essays/essay-editor-form.tsx`
- Modify: `src/components/essays/essay-editor-form.test.tsx`

**Interfaces:**
- Consumes: `CONTENT_SOURCE_KIND_LABELS`, `ContentSource` from `@/lib/content-sources/types` (Task 5); `ContentSourceIllustration` from Task 13; `/api/content-sources/search` from Task 8.
- Produces: essay-editor persists `content_source_id` alongside `book_id`, mutually exclusive at the UI level (picking one clears the other).

- [ ] **Step 1: Update the existing test fixture**

In `src/components/essays/essay-editor-form.test.tsx`, add `content_source_id: null,` right after `book_id: null,` and `content_source: null,` right after `book: null,` in `baseEssay`.

- [ ] **Step 2: Write the new failing test**

Add to `src/components/essays/essay-editor-form.test.tsx`:

```typescript
describe('EssayEditorForm — content source', () => {
  it('lets the author switch to "Jiný zdroj" and search for one', async () => {
    fetchSpy.mockImplementation((url) => {
      if (typeof url === 'string' && url.startsWith('/api/content-sources/search')) {
        return Promise.resolve(jsonResponse({
          data: [{ id: 'src-1', kind: 'podcast', title: 'Founders', creator: 'David Senra', points: 0.5, status: 'approved' }],
        }));
      }
      return Promise.resolve(jsonResponse({ data: { id: 'essay-1' } }, 201));
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm />);
    await user.click(screen.getByRole('button', { name: 'Jiný zdroj' }));
    await user.type(screen.getByLabelText('Hledat jiný zdroj'), 'Founders');
    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() => {
      expect(screen.getByText('Founders')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Founders'));
    await vi.advanceTimersByTimeAsync(3000);

    await waitFor(() => {
      const creates = fetchSpy.mock.calls.filter(([url]) => url === '/api/essays');
      expect(creates.length).toBeGreaterThan(0);
      const payload = JSON.parse((creates[0][1] as RequestInit).body as string);
      expect(payload.content_source_id).toBe('src-1');
      expect(payload.book_id).toBeNull();
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run src/components/essays/essay-editor-form.test.tsx`
Expected: FAIL — no "Jiný zdroj" button exists yet.

- [ ] **Step 4: Add content-source state and handlers**

In `src/components/essays/essay-editor-form.tsx`, add imports:

```typescript
import { ContentSourceIllustration } from '@/components/content-sources/content-source-illustration';
import { CONTENT_SOURCE_KIND_LABELS } from '@/lib/content-sources/types';
import type { ContentSource } from '@/lib/content-sources/types';
```

Add a `sourceMode` state and content-source state right after the existing book state:

```typescript
  const [selectedBook, setSelectedBook] = useState<BookSearchResult | null>(initialEssay?.book as BookSearchResult | null ?? null);
  const [selectedSource, setSelectedSource] = useState<ContentSource | null>(
    (initialEssay?.content_source as ContentSource | null) ?? null,
  );
  const [sourceMode, setSourceMode] = useState<'book' | 'other'>(selectedSource ? 'other' : 'book');
  const [sourceQuery, setSourceQuery] = useState('');
  const [sourceResults, setSourceResults] = useState<ContentSource[]>([]);
  const [isSearchingSources, setIsSearchingSources] = useState(false);
  const sourceSearchRef = useRef(0);
```

Update `latestRef` to carry the content source id:

```typescript
  const latestRef = useRef({ title, content, bookId: selectedBook?.id ?? null, contentSourceId: selectedSource?.id ?? null, essayId });
  latestRef.current = { title, content, bookId: selectedBook?.id ?? null, contentSourceId: selectedSource?.id ?? null, essayId };
```

Update `persist`'s payload:

```typescript
  const persist = useCallback(async () => {
    const { title: t, content: c, bookId, contentSourceId, essayId: id } = latestRef.current;
    const payload = { title: t, content_json: c.json, content_text: c.text, book_id: bookId, content_source_id: contentSourceId };
```

Add a `handleSourceChange` next to `handleBookChange`, and make `handleBookChange` clear the content source (and vice versa) so the two stay mutually exclusive:

```typescript
  const handleBookChange = useCallback((book: BookSearchResult | null) => {
    setSelectedBook(book);
    latestRef.current.bookId = book?.id ?? null;
    if (book) {
      setSelectedSource(null);
      latestRef.current.contentSourceId = null;
    }
    schedule();
  }, [schedule]);

  const handleSourceChange = useCallback((source: ContentSource | null) => {
    setSelectedSource(source);
    latestRef.current.contentSourceId = source?.id ?? null;
    if (source) {
      setSelectedBook(null);
      latestRef.current.bookId = null;
    }
    schedule();
  }, [schedule]);

  const searchSources = async (q: string) => {
    if (!q.trim()) { setSourceResults([]); return; }
    const requestId = ++sourceSearchRef.current;
    setIsSearchingSources(true);
    try {
      const res = await fetch(`/api/content-sources/search?q=${encodeURIComponent(q)}`);
      const { data } = await res.json();
      if (requestId === sourceSearchRef.current) setSourceResults(data ?? []);
    } finally {
      if (requestId === sourceSearchRef.current) setIsSearchingSources(false);
    }
  };
```

- [ ] **Step 5: Add the mode toggle and content-source picker to the JSX**

Replace the section heading and its wrapping `<section>` opening:

```typescript
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {sourceMode === 'book' ? 'Kniha, o které píšeš' : 'Zdroj, o kterém píšeš'}
          </h2>
          <div className="flex gap-1 rounded-full border p-0.5 text-xs">
            <button
              type="button"
              className={cn('rounded-full px-2.5 py-1 font-medium transition-colors', sourceMode === 'book' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
              onClick={() => setSourceMode('book')}
            >
              Kniha
            </button>
            <button
              type="button"
              className={cn('rounded-full px-2.5 py-1 font-medium transition-colors', sourceMode === 'other' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
              onClick={() => setSourceMode('other')}
            >
              Jiný zdroj
            </button>
          </div>
        </div>
```

(This requires the `cn` helper — add `import { cn } from '@/lib/utils';` alongside the other imports.)

Right after that new heading block, wrap the existing book-picker JSX (from `{selectedBook ? (` through its closing `)}`) in `{sourceMode === 'book' && ( ... )}`, and add a sibling content-source branch before the section's closing `</section>`:

```typescript
        {sourceMode === 'other' && (
          selectedSource ? (
            <div className="space-y-2 rounded-xl border bg-card p-3 sm:p-4">
              <div className="flex items-center gap-4">
                <ContentSourceIllustration kind={selectedSource.kind} className="h-[68px] w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading font-semibold">{selectedSource.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {CONTENT_SOURCE_KIND_LABELS[selectedSource.kind]}
                    {selectedSource.creator ? ` · ${selectedSource.creator}` : ''}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="shrink-0" onClick={() => handleSourceChange(null)}>
                  Změnit
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border bg-muted/40 p-3 sm:p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  value={sourceQuery}
                  aria-label="Hledat jiný zdroj"
                  onChange={(e) => { setSourceQuery(e.target.value); searchSources(e.target.value); }}
                  placeholder="Hledat podcast, konferenci, program…"
                  className="h-10 bg-background pr-9 pl-9"
                />
                {isSearchingSources && (
                  <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
                )}
              </div>
              {sourceResults.length > 0 && (
                <ul className="mt-2 max-h-80 divide-y overflow-y-auto rounded-lg border bg-background">
                  {sourceResults.map((source) => (
                    <li key={source.id}>
                      <button
                        type="button"
                        className="focus-ring flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted"
                        onClick={() => { handleSourceChange(source); setSourceResults([]); setSourceQuery(''); }}
                      >
                        <ContentSourceIllustration kind={source.kind} className="h-11 w-8 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{source.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{CONTENT_SOURCE_KIND_LABELS[source.kind]}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        )}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run src/components/essays/essay-editor-form.test.tsx`
Expected: PASS, including the new test.

- [ ] **Step 7: Commit**

```bash
git add src/components/essays/essay-editor-form.tsx src/components/essays/essay-editor-form.test.tsx
git commit -m "feat: pick a content source instead of a book in the essay editor"
```

---

### Task 16: Content source submission form + catalog page

**Files:**
- Create: `src/components/content-sources/content-source-form.tsx`
- Test: `src/components/content-sources/content-source-form.test.tsx`
- Create: `src/components/content-sources/content-source-card.tsx`
- Create: `src/app/(main)/cteni/zdroje/nova/page.tsx`
- Create: `src/app/(main)/cteni/zdroje/page.tsx`

**Interfaces:**
- Consumes: `CONTENT_SOURCE_KINDS`, `CONTENT_SOURCE_KIND_LABELS` from Task 5; `CONTENT_SOURCE_POINT_VALUES`, `defaultContentSourcePoints` from Task 6; `getContentSources` from Task 7; `ContentSourceIllustration` from Task 13.

- [ ] **Step 1: Write the failing form test**

```typescript
// src/components/content-sources/content-source-form.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ContentSourceForm } from './content-source-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const fetchSpy = vi.spyOn(globalThis, 'fetch');

beforeEach(() => {
  fetchSpy.mockReset();
  push.mockReset();
});

describe('ContentSourceForm', () => {
  it('pre-fills 0.5 points when Podcast is selected', async () => {
    const user = userEvent.setup();
    render(<ContentSourceForm />);

    await user.click(screen.getByRole('button', { name: 'Podcast' }));

    expect(screen.getByLabelText('Body')).toHaveValue('0.5');
  });

  it('leaves points blank for Konference', async () => {
    const user = userEvent.setup();
    render(<ContentSourceForm />);

    await user.click(screen.getByRole('button', { name: 'Konference' }));

    expect(screen.getByLabelText('Body')).toHaveValue('');
  });

  it('submits the form and redirects to the essay editor with the new source', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'src-1' } }), { status: 201 }),
    );
    const user = userEvent.setup();
    render(<ContentSourceForm />);

    await user.click(screen.getByRole('button', { name: 'Podcast' }));
    await user.type(screen.getByLabelText('Název'), 'Founders');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));

    expect(fetchSpy).toHaveBeenCalledWith('/api/content-sources', expect.objectContaining({ method: 'POST' }));
    expect(push).toHaveBeenCalledWith('/cteni/eseje/nova?source=src-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/content-sources/content-source-form.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `content-source-form.tsx`**

```typescript
// src/components/content-sources/content-source-form.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CONTENT_SOURCE_KINDS, CONTENT_SOURCE_KIND_LABELS } from '@/lib/content-sources/types';
import { CONTENT_SOURCE_POINT_VALUES, defaultContentSourcePoints } from '@/lib/content-sources/points';
import { ContentSourceIllustration } from './content-source-illustration';
import type { ContentSourceKind } from '@/lib/content-sources/types';

export function ContentSourceForm() {
  const router = useRouter();
  const [kind, setKind] = useState<ContentSourceKind | null>(null);
  const [title, setTitle] = useState('');
  const [creator, setCreator] = useState('');
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [points, setPoints] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleKindChange = (next: ContentSourceKind) => {
    setKind(next);
    const fallback = defaultContentSourcePoints(next);
    setPoints(fallback == null ? '' : String(fallback));
  };

  const handleSubmit = async () => {
    if (!kind || !title.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/content-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          title: title.trim(),
          creator: creator.trim() || null,
          description: description.trim() || null,
          external_url: externalUrl.trim() || null,
          points: points === '' ? null : Number(points),
        }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        toast.error(error ?? 'Nepodařilo se přidat zdroj.');
        return;
      }
      const { data } = await res.json();
      router.push(`/cteni/eseje/nova?source=${data.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Typ zdroje</Label>
        <div className="flex flex-wrap gap-2">
          {CONTENT_SOURCE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => handleKindChange(k)}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                kind === k ? 'border-primary bg-primary/5' : 'hover:bg-muted',
              )}
            >
              <ContentSourceIllustration kind={k} className="size-6 shrink-0" />
              {CONTENT_SOURCE_KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="content-source-title">Název</Label>
        <Input id="content-source-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content-source-creator">Autor / lektor</Label>
        <Input id="content-source-creator" value={creator} onChange={(e) => setCreator(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content-source-description">Popis</Label>
        <Textarea id="content-source-description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content-source-url">Odkaz</Label>
        <Input id="content-source-url" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content-source-points">Body</Label>
        <Input
          id="content-source-points"
          type="number"
          step="0.5"
          min="0"
          max="3"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          list="content-source-point-values"
        />
        <datalist id="content-source-point-values">
          {CONTENT_SOURCE_POINT_VALUES.map((v) => <option key={v} value={v} />)}
        </datalist>
      </div>

      <Button onClick={() => void handleSubmit()} disabled={!kind || !title.trim() || isSubmitting}>
        Uložit
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/content-sources/content-source-form.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the catalog card**

```typescript
// src/components/content-sources/content-source-card.tsx
import { ContentSourceIllustration } from './content-source-illustration';
import { formatPoints } from '@/lib/books/points';
import { CONTENT_SOURCE_KIND_LABELS } from '@/lib/content-sources/types';
import type { ContentSource } from '@/lib/content-sources/types';

export function ContentSourceCard({ source }: { source: ContentSource }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <ContentSourceIllustration kind={source.kind} className="size-12 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{source.title}</p>
        <p className="truncate text-sm text-muted-foreground">
          {CONTENT_SOURCE_KIND_LABELS[source.kind]}
          {source.creator ? ` · ${source.creator}` : ''}
        </p>
      </div>
      {source.points != null && (
        <span className="shrink-0 text-sm font-medium">{formatPoints(source.points)} b.</span>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Write the two pages**

```typescript
// src/app/(main)/cteni/zdroje/nova/page.tsx
import { PageShell } from '@/components/ui/page-shell';
import { PageHeader } from '@/components/ui/page-header';
import { ContentSourceForm } from '@/components/content-sources/content-source-form';

export default function NovyZdrojPage() {
  return (
    <PageShell size="narrow">
      <PageHeader title="Přidat zdroj" description="Podcast, konference, program a další zdroje mimo knihy." />
      <ContentSourceForm />
    </PageShell>
  );
}
```

```typescript
// src/app/(main)/cteni/zdroje/page.tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus, Inbox } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getContentSources } from '@/lib/content-sources/queries';
import { PageShell } from '@/components/ui/page-shell';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { ContentSourceCard } from '@/components/content-sources/content-source-card';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty';

export default async function ZdrojePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const sources = await getContentSources(supabase, { pageSize: 60 });

  return (
    <PageShell size="narrow">
      <PageHeader
        title="Ostatní zdroje"
        description="Podcasty, konference a programy, o kterých můžeš napsat esej."
        action={
          <Button asChild size="sm" className="gap-2 shrink-0">
            <Link href="/cteni/zdroje/nova">
              <Plus className="size-4" />
              Přidat zdroj
            </Link>
          </Button>
        }
      />
      {sources.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <Inbox className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Zatím žádné zdroje</EmptyTitle>
            <EmptyDescription>Buď první, kdo přidá podcast, konferenci nebo program.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => <ContentSourceCard key={source.id} source={source} />)}
        </div>
      )}
    </PageShell>
  );
}
```

- [ ] **Step 7: Verify it typechecks**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/content-sources/content-source-form.tsx src/components/content-sources/content-source-form.test.tsx src/components/content-sources/content-source-card.tsx "src/app/(main)/cteni/zdroje"
git commit -m "feat: add content source submission form and catalog page"
```

---

### Task 17: Coach review queue for content sources

**Files:**
- Create: `src/components/content-sources/content-source-review-list.tsx`
- Test: `src/components/content-sources/content-source-review-list.test.tsx`
- Create: `src/app/(main)/cteni/zdroje/ke-schvaleni/page.tsx`
- Modify: `src/app/(main)/cteni/sprava/page.tsx`

**Interfaces:**
- Consumes: `getPendingContentSources` from Task 7; `PATCH /api/content-sources/[id]` from Task 8.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/content-sources/content-source-review-list.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ContentSourceReviewList } from './content-source-review-list';
import type { ContentSource } from '@/lib/content-sources/types';

const fetchSpy = vi.spyOn(globalThis, 'fetch');

const pending: ContentSource[] = [{
  id: 'src-1',
  kind: 'podcast',
  title: 'Founders',
  creator: 'David Senra',
  description: null,
  external_url: null,
  points: 0.5,
  status: 'pending_review',
  status_changed_at: null,
  status_changed_by_profile_id: null,
  created_at: '2026-08-01T10:00:00Z',
  updated_at: '2026-08-01T10:00:00Z',
  created_by_profile_id: 'profile-1',
  updated_by_profile_id: 'profile-1',
}];

beforeEach(() => {
  fetchSpy.mockReset();
});

describe('ContentSourceReviewList', () => {
  it('approves a pending source with its self-assigned points', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    const user = userEvent.setup();

    render(<ContentSourceReviewList initialPending={pending} />);
    await user.click(screen.getByRole('button', { name: 'Schválit' }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/content-sources/src-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'approved', points: 0.5 }),
        }),
      );
    });
    expect(screen.queryByText('Founders')).not.toBeInTheDocument();
  });

  it('archives a pending source', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    const user = userEvent.setup();

    render(<ContentSourceReviewList initialPending={pending} />);
    await user.click(screen.getByRole('button', { name: 'Zamítnout' }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/content-sources/src-1',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/content-sources/content-source-review-list.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the component**

```typescript
// src/components/content-sources/content-source-review-list.tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ContentSourceIllustration } from './content-source-illustration';
import { formatPoints } from '@/lib/books/points';
import { CONTENT_SOURCE_KIND_LABELS } from '@/lib/content-sources/types';
import type { ContentSource } from '@/lib/content-sources/types';

interface ContentSourceReviewListProps {
  initialPending: ContentSource[];
}

export function ContentSourceReviewList({ initialPending }: ContentSourceReviewListProps) {
  const [pending, setPending] = useState(initialPending);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const decide = async (source: ContentSource, status: 'approved' | 'archived') => {
    setPendingActionId(source.id);
    try {
      const res = await fetch(`/api/content-sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, points: source.points == null ? null : Number(source.points) }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        toast.error(error ?? 'Nepodařilo se uložit rozhodnutí.');
        return;
      }
      setPending((current) => current.filter((s) => s.id !== source.id));
    } finally {
      setPendingActionId(null);
    }
  };

  if (pending.length === 0) {
    return <p className="text-sm text-muted-foreground">Žádné zdroje nečekají na schválení.</p>;
  }

  return (
    <ul className="space-y-2">
      {pending.map((source) => (
        <li key={source.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
          <ContentSourceIllustration kind={source.kind} className="size-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{source.title}</p>
            <p className="truncate text-sm text-muted-foreground">
              {CONTENT_SOURCE_KIND_LABELS[source.kind]}
              {source.creator ? ` · ${source.creator}` : ''}
              {source.points != null ? ` · ${formatPoints(source.points)} b. (návrh)` : ''}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={pendingActionId === source.id}
            onClick={() => void decide(source, 'archived')}
          >
            Zamítnout
          </Button>
          <Button
            size="sm"
            disabled={pendingActionId === source.id}
            onClick={() => void decide(source, 'approved')}
          >
            Schválit
          </Button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/content-sources/content-source-review-list.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the page**

```typescript
// src/app/(main)/cteni/zdroje/ke-schvaleni/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getPendingContentSources } from '@/lib/content-sources/queries';
import { PageShell } from '@/components/ui/page-shell';
import { PageHeader } from '@/components/ui/page-header';
import { ContentSourceReviewList } from '@/components/content-sources/content-source-review-list';

export default async function ZdrojeKeSchvaleniPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
    redirect('/');
  }

  const pending = await getPendingContentSources(supabase);

  return (
    <PageShell size="narrow">
      <PageHeader title="Zdroje ke schválení" description="Podcasty, konference a programy čekající na kontrolu." />
      <ContentSourceReviewList initialPending={pending} />
    </PageShell>
  );
}
```

- [ ] **Step 6: Link it from the existing library management page**

In `src/app/(main)/cteni/sprava/page.tsx`, add a link next to the existing "Přidat knihu" action. Change the `action` prop on `PageHeader`:

```typescript
        action={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline" className="gap-2 shrink-0">
              <Link href="/cteni/zdroje/ke-schvaleni">
                Zdroje ke schválení
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-2 shrink-0">
              <Link href="/cteni/knihy/nova">
                <Plus className="size-4" />
                Přidat knihu
              </Link>
            </Button>
          </div>
        }
```

- [ ] **Step 7: Verify it typechecks**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/content-sources/content-source-review-list.tsx src/components/content-sources/content-source-review-list.test.tsx "src/app/(main)/cteni/zdroje/ke-schvaleni" "src/app/(main)/cteni/sprava/page.tsx"
git commit -m "feat: add coach review queue for content sources"
```

---

### Task 18: Navigation — route `/cteni/zdroje/*` to the right tab

**Files:**
- Modify: `src/components/cteni/cteni-tab-bar.tsx`
- Modify: `src/components/cteni/cteni-tab-bar.test.tsx`

**Interfaces:** none beyond the existing `getActiveCteniTabUrl` export.

- [ ] **Step 1: Write the failing tests**

Add to `src/components/cteni/cteni-tab-bar.test.tsx`:

```typescript
  it('highlights Objevovat on the content source catalog and submission pages', () => {
    mockPathname.mockReturnValue('/cteni/zdroje');
    renderBar({ isCoachOrAdmin: true });
    expect(screen.getByRole('link', { name: 'Objevovat' })).toHaveAttribute('aria-current', 'page');
  });

  it('highlights Správa on the content source review queue', () => {
    mockPathname.mockReturnValue('/cteni/zdroje/ke-schvaleni');
    renderBar({ isCoachOrAdmin: true });
    expect(screen.getByRole('link', { name: 'Správa' })).toHaveAttribute('aria-current', 'page');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/components/cteni/cteni-tab-bar.test.tsx`
Expected: FAIL — neither new path currently resolves to those tabs (both currently fall through to `undefined`).

- [ ] **Step 3: Update `getActiveCteniTabUrl`**

In `src/components/cteni/cteni-tab-bar.tsx`, add a check for the review queue right alongside the existing `/cteni/sprava` check:

```typescript
  if (
    isCoachOrAdmin &&
    (pathname === '/cteni/sprava' || pathname.startsWith('/cteni/sprava/') ||
     pathname === '/cteni/zdroje/ke-schvaleni' || pathname.startsWith('/cteni/zdroje/ke-schvaleni/'))
  ) {
    return '/cteni/sprava';
  }
```

And extend the "Objevovat" prefix check to include the catalog/submission routes:

```typescript
  if (
    pathname === '/cteni/hledat' ||
    pathname.startsWith('/cteni/hledat/') ||
    pathname.startsWith('/cteni/knihy') ||
    pathname.startsWith('/cteni/eseje') ||
    (pathname.startsWith('/cteni/zdroje') && !pathname.startsWith('/cteni/zdroje/ke-schvaleni'))
  ) {
    return '/cteni/hledat';
  }
```

(Note this second block must run before the `/cteni/zdroje/ke-schvaleni` check would ever be reached by prefix, but since the `sprava` check above already returns early for `ke-schvaleni`, the ordering in the function — sprava-family checks before the hledat-family check — is preserved by placing this new condition inside the *existing* hledat block, not by reordering the function's early-return sequence.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/components/cteni/cteni-tab-bar.test.tsx`
Expected: PASS (all cases, old and new).

- [ ] **Step 5: Commit**

```bash
git add src/components/cteni/cteni-tab-bar.tsx src/components/cteni/cteni-tab-bar.test.tsx
git commit -m "feat: route content source pages to the right cteni tab"
```

---

### Task 19: Discovery page — separate "Ostatní zdroje" section

**Files:**
- Modify: `src/app/(main)/cteni/hledat/page.tsx`
- Modify: `src/components/search/search-page-client.tsx`

**Interfaces:**
- Consumes: `getContentSources` from Task 7; `ContentSourceCard` from Task 16.

- [ ] **Step 1: Fetch content sources server-side**

In `src/app/(main)/cteni/hledat/page.tsx`, add the import:

```typescript
import { getContentSources } from '@/lib/content-sources/queries';
```

Add `getContentSources(supabase, { pageSize: 12 })` to the `Promise.all` array (name the destructured result `contentSources`), and pass it to `SearchPageClient`:

```typescript
      contentSources={contentSources}
```

- [ ] **Step 2: Read the client component's existing category section for placement**

Read `src/components/search/search-page-client.tsx` around its first `<section>` (approximately line 344, the categories section) to find the exact insertion point immediately after it closes.

- [ ] **Step 3: Add the prop and render a new, clearly separate section**

Add to `SearchPageClientProps`:

```typescript
  contentSources?: ContentSource[];
```

(add `import type { ContentSource } from '@/lib/content-sources/types';` and destructure `contentSources = []` in the function signature)

Immediately after the categories `<section>` closes (found in Step 2), insert a new, visually distinct section:

```typescript
      {contentSources.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">Ostatní zdroje</h2>
            <Link href="/cteni/zdroje" className="text-sm font-medium text-primary hover:underline">
              Zobrazit vše
            </Link>
          </div>
          <div className="space-y-2">
            {contentSources.slice(0, 5).map((source) => (
              <ContentSourceCard key={source.id} source={source} />
            ))}
          </div>
        </section>
      )}
```

Add the import: `import { ContentSourceCard } from '@/components/content-sources/content-source-card';`

- [ ] **Step 4: Verify it typechecks and the app builds**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors.

Run: `pnpm test`
Expected: existing tests for `search-page-client` (if any) and everything else still pass. If a snapshot or DOM-structure test exists for this component, update it to account for the new section only if it fails — do not preemptively rewrite passing tests.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(main)/cteni/hledat/page.tsx" src/components/search/search-page-client.tsx
git commit -m "feat: surface content sources as a separate section on the discovery page"
```

---

### Task 20: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit/component suite**

Run: `pnpm test`
Expected: all tests PASS.

- [ ] **Step 2: Run integration tests**

Run: `pnpm test:integration`
Expected: all tests PASS, including Task 4's new file.

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm exec tsc --noEmit -p tsconfig.json && pnpm lint`
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Start the dev server (`pnpm dev`), and as a student: submit a podcast at `/cteni/zdroje/nova` (confirm points pre-fill to 0.5), write an essay against it via `/cteni/eseje/nova`, confirm it renders on the essay card and on `/cteni/hledat`. As a coach: approve it at `/cteni/zdroje/ke-schvaleni` and confirm the essay's points reflect the approval. Verify both light and dark themes on every new screen.

- [ ] **Step 5: No commit** — this task only verifies prior commits; if anything fails, fix it within the task where the regression was introduced and re-run this task.

---

## Out of scope

- E2E coverage for the new routes/flows (matches the existing gap for `books`/`essays` query-layer coverage — add if the team's E2E suite grows to cover the reading feature generally).
- AI enrichment/auto-scoring for content sources.
- Type-specific metadata fields (episode number, duration, institution).
- A detail page for an individual content source (the catalog card + picker cover every need identified).
- Editing a content source after submission (student side) — only coach/admin can update, per the spec's RLS design mirroring `books`.
