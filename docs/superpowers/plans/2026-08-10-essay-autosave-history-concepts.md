# Eseje: Autosave, Historie, Koncepty — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give essay authors reliable autosave with visible status, a read-only version history, and unpublished drafts ("koncepty") they can finish later.

**Architecture:** A koncept is `essays.published_at IS NULL` — no new tables, no new columns. Autosave PATCHes the essay every 2 seconds; the route either updates the newest `essay_revisions` row (if it was created within the last 30 minutes) or cuts a new one, so history reads as session checkpoints rather than keystroke noise. Three RLS policies are tightened so drafts are actually private, because today `essays` and `essay_revisions` are both readable with `using (true)`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, `supabase-js` (PostgREST), Drizzle (schema source of truth only, never a runtime client), Tiptap, Vitest (unit/component/integration), Playwright (E2E), shadcn/ui, sonner.

**Design doc:** `docs/superpowers/specs/2026-08-10-essay-autosave-history-concepts-design.md`

## Global Constraints

- TypeScript strict mode. No `any`. `interface` over `type`, except types derived from the DB, which must be `type`. Prefer `??` over `||`.
- Naming: PascalCase components/types, camelCase vars/functions, UPPER_SNAKE_CASE constants, kebab-case files.
- Imports: external → `@/` internal → styles, one blank line between groups.
- Server Components by default; `"use client"` only for interactivity, browser APIs, or third-party init.
- Never hardcode magic values — extract to named constants or `as const`.
- All user-facing copy is Czech.
- Schema source of truth is `db/schema/*.ts`. Never hand-write a migration for tables/columns/enums/indexes/RLS. Never edit an existing file in `supabase/migrations/`.
- Every `pgPolicy(...)` keeps its full `using` / `withCheck` so `db:generate` can drop policies before dropping columns.
- Never add a runtime Drizzle client — app data access stays on `supabase-js` so RLS applies.
- Realtime, if ever touched here: `broadcast` only, `private: true`. (This plan adds none.)
- `pnpm test` (unit + component) and `pnpm typecheck` must pass before every commit.

**Read before starting Task 2:** load the `supabase:supabase-postgres-best-practices` skill. Task 2 changes RLS policies, which that skill covers directly.

---

## File Structure

**Created**

| File | Responsibility |
| --- | --- |
| `src/lib/essays/revisions.ts` | Pure coalescing decision + the window constant. No I/O. |
| `src/lib/essays/revisions.test.ts` | Unit tests for the above. |
| `src/lib/essays/use-autosave.ts` | Debounced, single-flight, retrying autosave state machine. |
| `src/app/api/essays/[id]/publish/route.ts` | Koncept → published transition. |
| `src/app/api/essays/[id]/revisions/route.ts` | Author-only revision metadata list. |
| `src/app/api/essays/[id]/revisions/[revisionNo]/route.ts` | Author-only single revision content. |
| `src/components/essays/essay-history-sheet.tsx` | Read-only history panel. |
| `src/components/essays/essay-history-sheet.test.tsx` | Component tests for it. |
| `src/components/essays/essay-editor-form.test.tsx` | Autosave/status/publish behaviour. |
| `src/components/essays/my-essay-list.test.tsx` | Koncepty grouping. |
| `tests/integration/essay-drafts.int.test.ts` | RLS proof for drafts + revision updates. |
| `tests/e2e/essay-autosave.spec.ts` | Type → reload → survives → publish. |

**Modified**

| File | Change |
| --- | --- |
| `db/schema/essays.ts` | Three policy rewrites (essays SELECT, essay_revisions SELECT + UPDATE). |
| `src/lib/essays/types.ts` | `EssayFilters.status`, `EssayRevisionSummary`. |
| `src/lib/essays/queries.ts` | `getEssayRevisions`, draft-aware `getEssays`. |
| `src/app/api/essays/route.ts` | POST creates a koncept; delete the broken `fetchCreatedEssay`. |
| `src/app/api/essays/[id]/route.ts` | PATCH coalesces revisions, returns a light payload. |
| `src/components/essays/essay-editor-form.tsx` | Wire `useAutosave`, draft creation, status line, publish. |
| `src/components/essays/my-essay-list.tsx` | Koncepty group. |
| `src/components/essays/prehled-tabs.tsx` | Pass drafts through. |
| `src/app/(main)/cteni/prehled/page.tsx` | Fetch drafts. |
| `src/app/(main)/cteni/eseje/[essayId]/page.tsx` | Redirect the author of a koncept to the editor. |
| `src/app/(main)/cteni/eseje/[essayId]/upravit/page.tsx` | Use `PageShell` + `BackButton`; pass `isDraft`. |

---

## Task 1: Revision coalescing decision

The one piece of real logic in the feature, isolated as a pure function so its boundary behaviour is testable without a database. This mirrors how `src/lib/tymova-reflexe/` keeps `reflection-merge.ts` pure and unit-tested while the hook itself is covered through component tests.

**Files:**
- Create: `src/lib/essays/revisions.ts`
- Test: `src/lib/essays/revisions.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `REVISION_COALESCE_WINDOW_MINUTES: number`, `CoalesceCandidate` interface, `shouldCoalesceRevision(latest: CoalesceCandidate | null, profileId: string, nowIso: string): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/essays/revisions.test.ts
import { describe, expect, it } from 'vitest';

import {
  REVISION_COALESCE_WINDOW_MINUTES,
  shouldCoalesceRevision,
} from './revisions';

const PROFILE = 'profile-1';
const NOW = '2026-08-10T12:00:00.000Z';

function minutesBefore(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() - minutes * 60_000).toISOString();
}

function candidate(overrides: Partial<{ revision_no: number; created_at: string; created_by_profile_id: string }> = {}) {
  return {
    revision_no: 3,
    created_at: minutesBefore(NOW, 5),
    created_by_profile_id: PROFILE,
    ...overrides,
  };
}

describe('shouldCoalesceRevision', () => {
  it('does not coalesce when there is no prior revision', () => {
    expect(shouldCoalesceRevision(null, PROFILE, NOW)).toBe(false);
  });

  it('coalesces a fresh revision by the same author', () => {
    expect(shouldCoalesceRevision(candidate(), PROFILE, NOW)).toBe(true);
  });

  it('does not coalesce a revision by a different author', () => {
    const other = candidate({ created_by_profile_id: 'profile-2' });
    expect(shouldCoalesceRevision(other, PROFILE, NOW)).toBe(false);
  });

  it('does not coalesce once the revision is exactly at the window edge', () => {
    const edge = candidate({ created_at: minutesBefore(NOW, REVISION_COALESCE_WINDOW_MINUTES) });
    expect(shouldCoalesceRevision(edge, PROFILE, NOW)).toBe(false);
  });

  it('coalesces just inside the window', () => {
    const inside = candidate({ created_at: minutesBefore(NOW, REVISION_COALESCE_WINDOW_MINUTES - 1) });
    expect(shouldCoalesceRevision(inside, PROFILE, NOW)).toBe(true);
  });

  it('does not coalesce past the window', () => {
    const stale = candidate({ created_at: minutesBefore(NOW, REVISION_COALESCE_WINDOW_MINUTES + 15) });
    expect(shouldCoalesceRevision(stale, PROFILE, NOW)).toBe(false);
  });

  it('does not coalesce a revision timestamped in the future (clock skew)', () => {
    const future = candidate({ created_at: minutesBefore(NOW, -5) });
    expect(shouldCoalesceRevision(future, PROFILE, NOW)).toBe(false);
  });

  it('does not coalesce an unparseable timestamp', () => {
    const broken = candidate({ created_at: 'not-a-date' });
    expect(shouldCoalesceRevision(broken, PROFILE, NOW)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm vitest run --project unit src/lib/essays/revisions.test.ts`
Expected: FAIL — cannot resolve `./revisions`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/essays/revisions.ts

/**
 * How long a single revision keeps absorbing edits before autosave cuts a new
 * one. Measured from `created_at` (not `updated_at`) so the window is a hard
 * cap: a long writing session yields one history entry per half hour rather
 * than one entry for the whole session or one per keystroke.
 *
 * Kept in sync by hand with the interval in the `essay_revisions` UPDATE
 * policy in `db/schema/essays.ts` — RLS is the boundary, this is the precision.
 */
export const REVISION_COALESCE_WINDOW_MINUTES = 30;

export interface CoalesceCandidate {
  revision_no: number;
  created_at: string;
  created_by_profile_id: string;
}

/**
 * Decides whether an autosave should overwrite the newest revision or cut a
 * new one. Callers must pass the highest-numbered revision for the essay.
 */
export function shouldCoalesceRevision(
  latest: CoalesceCandidate | null,
  profileId: string,
  nowIso: string,
): boolean {
  if (!latest) return false;
  if (latest.created_by_profile_id !== profileId) return false;

  const ageMs = new Date(nowIso).getTime() - new Date(latest.created_at).getTime();
  if (Number.isNaN(ageMs)) return false;

  return ageMs >= 0 && ageMs < REVISION_COALESCE_WINDOW_MINUTES * 60_000;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run --project unit src/lib/essays/revisions.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm typecheck
git add src/lib/essays/revisions.ts src/lib/essays/revisions.test.ts
git commit -m "feat(essays): add revision coalescing window helper"
```

---

## Task 2: RLS — make drafts private and revisions coalescable

Three policy rewrites. All are no-ops against existing data: `POST /api/essays` sets `published_at = now()` today, so no draft rows exist yet. Ship this **before** any route can create a draft.

**Files:**
- Modify: `db/schema/essays.ts:51` (essays SELECT), `db/schema/essays.ts:83` (revisions SELECT), `db/schema/essays.ts:85` (revisions UPDATE)
- Test: `tests/integration/essay-drafts.int.test.ts`

**Interfaces:**
- Consumes: existing SQL helpers `current_profile_id()` and `is_admin()`.
- Produces: draft rows are invisible to non-authors; an author may `UPDATE` a revision they created within 30 minutes.

- [ ] **Step 1: Load the Postgres skill**

Invoke the `supabase:supabase-postgres-best-practices` skill before editing any policy.

- [ ] **Step 2: Write the failing integration test**

```ts
// tests/integration/essay-drafts.int.test.ts
import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import { insertAuthUser } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";

const COALESCE_WINDOW_MINUTES = 30;

async function seedProfile(
  client: import("pg").PoolClient,
  teamId: string,
  name: string,
  email: string,
) {
  const auth = await insertAuthUser(client);
  const { rows: userRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [auth.id],
  );
  await client.query(
    `insert into public.profiles (name, work_email, user_id, team_id, role)
     values ($1, $2, $3, $4, 'student')`,
    [name, email, userRows[0].id, teamId],
  );
  const { rows: profiles } = await client.query(
    "select id from public.profiles where user_id = $1",
    [userRows[0].id],
  );
  return { authId: auth.id as string, profileId: profiles[0].id as string };
}

async function seed(client: import("pg").PoolClient) {
  const { rows: teams } = await client.query(
    "insert into public.teams (name) values ('Team') returning id",
  );
  const teamId = teams[0].id;

  const author = await seedProfile(client, teamId, "Author", "author@studenti.czu.cz");
  const other = await seedProfile(client, teamId, "Other", "other@studenti.czu.cz");

  const { rows: draftRows } = await client.query(
    `insert into public.essays (author_profile_id, created_by_profile_id, updated_by_profile_id, published_at)
     values ($1, $1, $1, null) returning id`,
    [author.profileId],
  );
  const { rows: publishedRows } = await client.query(
    `insert into public.essays (author_profile_id, created_by_profile_id, updated_by_profile_id, published_at)
     values ($1, $1, $1, now()) returning id`,
    [author.profileId],
  );

  for (const essayId of [draftRows[0].id, publishedRows[0].id]) {
    await client.query(
      `insert into public.essay_revisions (essay_id, revision_no, title, content_json, created_by_profile_id, updated_by_profile_id)
       values ($1, 1, 'Titul', '{}'::jsonb, $2, $2)`,
      [essayId, author.profileId],
    );
  }

  return {
    author,
    other,
    draftId: draftRows[0].id as string,
    publishedId: publishedRows[0].id as string,
  };
}

describe("koncepty RLS", () => {
  it("hides a draft essay from another authenticated user", async () => {
    await withRollback(async (client) => {
      const { other, draftId } = await seed(client);
      await asClaims(client, { sub: other.authId });

      const { rows } = await client.query("select id from public.essays where id = $1", [draftId]);
      expect(rows).toHaveLength(0);
    });
  });

  it("shows the author their own draft", async () => {
    await withRollback(async (client) => {
      const { author, draftId } = await seed(client);
      await asClaims(client, { sub: author.authId });

      const { rows } = await client.query("select id from public.essays where id = $1", [draftId]);
      expect(rows).toHaveLength(1);
    });
  });

  it("still shows published essays to everyone", async () => {
    await withRollback(async (client) => {
      const { other, publishedId } = await seed(client);
      await asClaims(client, { sub: other.authId });

      const { rows } = await client.query("select id from public.essays where id = $1", [publishedId]);
      expect(rows).toHaveLength(1);
    });
  });

  it("hides draft revision content from another authenticated user", async () => {
    await withRollback(async (client) => {
      const { other, draftId } = await seed(client);
      await asClaims(client, { sub: other.authId });

      const { rows } = await client.query(
        "select title from public.essay_revisions where essay_id = $1",
        [draftId],
      );
      expect(rows).toHaveLength(0);
    });
  });

  it("shows published revision content to another authenticated user", async () => {
    await withRollback(async (client) => {
      const { other, publishedId } = await seed(client);
      await asClaims(client, { sub: other.authId });

      const { rows } = await client.query(
        "select title from public.essay_revisions where essay_id = $1",
        [publishedId],
      );
      expect(rows).toHaveLength(1);
    });
  });
});

describe("essay_revisions UPDATE window", () => {
  it("lets the author update a revision they just created", async () => {
    await withRollback(async (client) => {
      const { author, draftId } = await seed(client);
      await asClaims(client, { sub: author.authId });

      const result = await client.query(
        "update public.essay_revisions set title = 'Nový' where essay_id = $1 and revision_no = 1",
        [draftId],
      );
      expect(result.rowCount).toBe(1);
    });
  });

  it("refuses to update a revision older than the window", async () => {
    await withRollback(async (client) => {
      const { author, draftId } = await seed(client);
      await client.query(
        `update public.essay_revisions
         set created_at = now() - ($2 || ' minutes')::interval
         where essay_id = $1 and revision_no = 1`,
        [draftId, String(COALESCE_WINDOW_MINUTES + 5)],
      );
      await asClaims(client, { sub: author.authId });

      const result = await client.query(
        "update public.essay_revisions set title = 'Nový' where essay_id = $1 and revision_no = 1",
        [draftId],
      );
      expect(result.rowCount).toBe(0);
    });
  });

  it("refuses to let another user update the author's fresh revision", async () => {
    await withRollback(async (client) => {
      const { other, draftId } = await seed(client);
      await asClaims(client, { sub: other.authId });

      const result = await client.query(
        "update public.essay_revisions set title = 'Nový' where essay_id = $1 and revision_no = 1",
        [draftId],
      );
      expect(result.rowCount).toBe(0);
    });
  });
});
```

- [ ] **Step 3: Run the integration test and confirm it fails**

Run: `pnpm test:integration tests/integration/essay-drafts.int.test.ts`
Expected: FAIL — the draft-hiding tests return 1 row instead of 0 (SELECT is still `using (true)`), and the update tests return `rowCount` 0 where 1 is expected (UPDATE is still `using (false)`).

- [ ] **Step 4: Rewrite the three policies**

In `db/schema/essays.ts`, replace the `essays` SELECT policy:

```ts
	pgPolicy("Authenticated users can view all essays", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((published_at IS NOT NULL) OR (author_profile_id = ( SELECT current_profile_id())) OR ( SELECT is_admin()))` }),
```

Replace the `essay_revisions` SELECT policy:

```ts
	pgPolicy("Authenticated users can view essay revisions", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(EXISTS ( SELECT 1
   FROM essays e
  WHERE ((e.id = essay_revisions.essay_id) AND ((e.published_at IS NOT NULL) OR (e.author_profile_id = ( SELECT current_profile_id())) OR ( SELECT is_admin())))))` }),
```

Replace the `essay_revisions` UPDATE policy (was `using: sql\`false\``):

```ts
	pgPolicy("Authors can update their newest recent essay revision", { as: "permissive", for: "update", to: ["authenticated"], using: sql`((created_by_profile_id = ( SELECT current_profile_id())) AND (created_at > (now() - '00:30:00'::interval)))`, withCheck: sql`(created_by_profile_id = ( SELECT current_profile_id()))` }),
```

Notes for the implementer:
- `current_profile_id()` and `is_admin()` are wrapped in `( SELECT ... )` so Postgres evaluates them once as an InitPlan instead of once per row. `essay_revisions` gets scanned wholesale by the title search in `findEssayIdsByTitleSearch`, so this matters.
- The `'00:30:00'::interval` literal must match `REVISION_COALESCE_WINDOW_MINUTES` from Task 1.
- The UPDATE policy deliberately does not check "is this the newest revision" — expressing that in SQL costs a correlated subquery on every row. The route enforces it; RLS bounds the blast radius to *your own revision, created in the last 30 minutes*.

- [ ] **Step 5: Generate and apply the migration**

Ask the user to run `pnpm db:migrate`. Then **stop and have the user review the generated SQL in `supabase/migrations/` for drops** before anything else. Expect exactly three `DROP POLICY` + three `CREATE POLICY` pairs and nothing else — no `DROP TABLE`, no `DROP COLUMN`. Do not run `pnpm db:up` yourself; do not run `supabase db reset`; local data is not disposable.

- [ ] **Step 6: Run the integration test and confirm it passes**

Run: `pnpm test:integration tests/integration/essay-drafts.int.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 7: Run the full integration suite for regressions**

Run: `pnpm test:integration`
Expected: PASS. `essay-comments` and `essay-votes` seed published essays, so the tightened SELECT should not affect them. If either fails, the seed is creating an essay with a null `published_at` — fix the seed, not the policy.

- [ ] **Step 8: Commit schema and migration together**

```bash
pnpm typecheck
git add db/schema/essays.ts supabase/migrations tests/integration/essay-drafts.int.test.ts
git commit -m "feat(essays): make drafts private and allow coalescing recent revisions"
```

---

## Task 3: POST creates a koncept, plus the publish route

**Files:**
- Modify: `src/app/api/essays/route.ts:32-87` (delete `fetchCreatedEssay`), `src/app/api/essays/route.ts:125-189` (POST)
- Create: `src/app/api/essays/[id]/publish/route.ts`

**Interfaces:**
- Consumes: `getCurrentUserProfile`, `contentTextFromJson`, `getEssayById`.
- Produces: `POST /api/essays` → `201 { data: { id: string } }`; `POST /api/essays/[id]/publish` → `200 { data: EssayWithDetails }`.

- [ ] **Step 1: Delete `fetchCreatedEssay` and simplify POST**

Remove the whole `fetchCreatedEssay` helper (`src/app/api/essays/route.ts:32-87`) and its now-unused `Json` / `pickLatestRevision` imports if nothing else in the file uses them.

> Incidental bug fix: that helper selects `book:books!book_id(..., status, ...)`, but `books` has no `status` column — only `list_status` (`db/schema/books.ts:48`). Deleting the helper removes the hazard; do not port the broken select forward.

Replace the POST body handling:

```ts
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const body = await request.json();
    const { title, content_json, content_text, book_id } = body;

    // A koncept may be empty in every field — it exists so autosave has
    // somewhere to write. Publishing is where the content rules apply.
    const trimmedTitle = typeof title === 'string' ? title.trim() : '';
    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      return NextResponse.json({ error: 'Název eseje je příliš dlouhý' }, { status: 400 });
    }

    const nextContent = content_json ?? {};
    const plainText = typeof content_text === 'string'
      ? content_text
      : contentTextFromJson(nextContent);
    if (plainText.length > MAX_CONTENT_TEXT_LENGTH) {
      return NextResponse.json({ error: 'Esej je příliš dlouhá' }, { status: 400 });
    }

    const { data: essay, error: essayError } = await supabase
      .from('essays')
      .insert({
        author_profile_id: profile.id,
        book_id: book_id ?? null,
        published_at: null,
        created_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
      })
      .select('id')
      .single();

    if (essayError) throw essayError;

    const { error: revisionError } = await supabase
      .from('essay_revisions')
      .insert({
        essay_id: essay.id,
        revision_no: 1,
        title: trimmedTitle,
        content_json: nextContent,
        created_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
      });

    if (revisionError) throw revisionError;

    return NextResponse.json({ data: { id: essay.id } }, { status: 201 });
  } catch (error) {
    console.error('POST /api/essays error:', error);
    return NextResponse.json({ error: 'Nepodařilo se uložit esej' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create the publish route**

```ts
// src/app/api/essays/[id]/publish/route.ts
import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssayById } from '@/lib/essays/queries';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const essay = await getEssayById(supabase, id);
    if (!essay || essay.author_profile_id !== profile.id) {
      return NextResponse.json({ error: 'Esej nenalezena nebo nemáš oprávnění' }, { status: 404 });
    }

    if (!essay.title.trim()) {
      return NextResponse.json({ error: 'Název eseje je povinný' }, { status: 400 });
    }
    if (!essay.content_text.trim()) {
      return NextResponse.json({ error: 'Obsah eseje je povinný' }, { status: 400 });
    }

    // Already published: publishing again would move published_at and reorder
    // the feed for no reason, so treat it as a no-op.
    if (essay.published_at != null) {
      return NextResponse.json({ data: essay });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('essays')
      .update({ published_at: now, updated_at: now, updated_by_profile_id: profile.id })
      .eq('id', id)
      .eq('author_profile_id', profile.id);

    if (updateError) throw updateError;

    const published = await getEssayById(supabase, id);
    return NextResponse.json({ data: published });
  } catch (error) {
    console.error('POST /api/essays/[id]/publish error:', error);
    return NextResponse.json({ error: 'Nepodařilo se zveřejnit esej' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. If `Json` or `pickLatestRevision` is now unused in `route.ts`, remove the import.

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: PASS, no unused-import warnings.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/essays/route.ts src/app/api/essays/\[id\]/publish/route.ts
git commit -m "feat(essays): create essays as koncepty and add a publish route"
```

---

## Task 4: PATCH coalesces revisions and returns a light payload

**Files:**
- Modify: `src/app/api/essays/[id]/route.ts:63-145`

**Interfaces:**
- Consumes: `shouldCoalesceRevision`, `REVISION_COALESCE_WINDOW_MINUTES` from Task 1.
- Produces: `PATCH /api/essays/[id]` → `200 { data: { revision_no: number; updated_at: string } }`.

- [ ] **Step 1: Add the import**

```ts
import { shouldCoalesceRevision } from '@/lib/essays/revisions';
```

- [ ] **Step 2: Replace the revision block**

Swap the two-query `Promise.all` (`src/app/api/essays/[id]/route.ts:63-121`) for a single newest-revision fetch plus the coalesce branch. Note the ownership select at line 51 must now also return `published_at`:

```ts
    const { data: existing, error: existingError } = await supabase
      .from('essays')
      .select('id, author_profile_id, removed_at, published_at')
      .eq('id', id)
      .eq('author_profile_id', profile.id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing || existing.removed_at != null) {
      return NextResponse.json({ error: 'Esej nenalezena nebo nemáš oprávnění' }, { status: 404 });
    }

    const now = new Date().toISOString();
    let revisionNo: number | null = null;
    let revisionUpdatedAt = now;

    if (hasContentUpdate) {
      const { data: latest, error: latestError } = await supabase
        .from('essay_revisions')
        .select('revision_no, title, content_json, created_at, created_by_profile_id')
        .eq('essay_id', id)
        .order('revision_no', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestError) throw latestError;

      const nextTitle = body.title !== undefined
        ? String(body.title).trim()
        : (latest?.title ?? '');
      const nextContent = body.content_json !== undefined
        ? body.content_json
        : (latest?.content_json ?? {});

      // A koncept is allowed to be untitled; a published essay is not.
      if (existing.published_at != null && !nextTitle) {
        return NextResponse.json({ error: 'Název eseje je povinný' }, { status: 400 });
      }
      if (nextTitle.length > MAX_TITLE_LENGTH) {
        return NextResponse.json({ error: 'Název eseje je příliš dlouhý' }, { status: 400 });
      }

      const plainText = typeof body.content_text === 'string'
        ? body.content_text
        : contentTextFromJson(nextContent);
      if (plainText.length > MAX_CONTENT_TEXT_LENGTH) {
        return NextResponse.json({ error: 'Esej je příliš dlouhá' }, { status: 400 });
      }

      if (shouldCoalesceRevision(latest, profile.id, now)) {
        const { error: coalesceError } = await supabase
          .from('essay_revisions')
          .update({
            title: nextTitle,
            content_json: nextContent,
            updated_at: now,
            updated_by_profile_id: profile.id,
          })
          .eq('essay_id', id)
          .eq('revision_no', latest!.revision_no);

        if (coalesceError) throw coalesceError;
        revisionNo = latest!.revision_no;
      } else {
        const nextNo = (latest?.revision_no ?? 0) + 1;
        const { error: insertRevError } = await supabase
          .from('essay_revisions')
          .insert({
            essay_id: id,
            revision_no: nextNo,
            title: nextTitle,
            content_json: nextContent,
            created_by_profile_id: profile.id,
            updated_by_profile_id: profile.id,
          });

        if (insertRevError) throw insertRevError;
        revisionNo = nextNo;
      }
      revisionUpdatedAt = now;
    }
```

- [ ] **Step 3: Replace the response**

Drop the closing `getEssayById` call (`src/app/api/essays/[id]/route.ts:144-145`) and return:

```ts
    return NextResponse.json({ data: { revision_no: revisionNo, updated_at: revisionUpdatedAt } });
```

Keep the `essays` table update (`updated_at`, `updated_by_profile_id`, optional `book_id`) exactly as it is, but reuse the `now` computed above instead of calling `new Date()` a second time.

Why the payload shrank: the route previously ended with `getEssayById`, which embeds votes, views, comments, author, book, and highlight category. Autosave fires every 2 seconds and used none of it.

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/essays/\[id\]/route.ts
git commit -m "feat(essays): coalesce autosave revisions and slim the PATCH response"
```

---

## Task 5: Revision history read routes

**Files:**
- Modify: `src/lib/essays/types.ts`, `src/lib/essays/queries.ts`
- Create: `src/app/api/essays/[id]/revisions/route.ts`, `src/app/api/essays/[id]/revisions/[revisionNo]/route.ts`

**Interfaces:**
- Consumes: `contentTextFromJson`.
- Produces: `EssayRevisionSummary` interface; `getEssayRevisions(supabase, essayId, limit?)`; `GET /api/essays/[id]/revisions` → `{ data: EssayRevisionSummary[] }`; `GET /api/essays/[id]/revisions/[revisionNo]` → `{ data: { revision_no, title, content_json } }`.

- [ ] **Step 1: Add the type**

In `src/lib/essays/types.ts`, after the `EssayCoachRead` block:

```ts
export interface EssayRevisionSummary {
  revision_no: number;
  title: string;
  created_at: string;
  updated_at: string;
  word_count: number;
  snippet: string;
}
```

- [ ] **Step 2: Add the query**

In `src/lib/essays/queries.ts`, next to `getEssayById`. Add the constants near `PAGE_SIZE_DEFAULT` at the top:

```ts
/** How many revisions the history panel shows. Older ones are reachable only by scrolling the DB. */
const REVISION_HISTORY_LIMIT = 50;
const REVISION_SNIPPET_LENGTH = 160;
```

```ts
export async function getEssayRevisions(
  supabase: SupabaseClient<Database>,
  essayId: string,
  limit: number = REVISION_HISTORY_LIMIT,
): Promise<EssayRevisionSummary[]> {
  const { data, error } = await supabase
    .from('essay_revisions')
    .select('revision_no, title, content_json, created_at, updated_at')
    .eq('essay_id', essayId)
    .is('invalid_since', null)
    .order('revision_no', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const text = contentTextFromJson(row.content_json);
    return {
      revision_no: row.revision_no,
      title: row.title,
      created_at: row.created_at,
      updated_at: row.updated_at,
      word_count: text ? text.split(/\s+/).length : 0,
      snippet: text.slice(0, REVISION_SNIPPET_LENGTH),
    };
  });
}
```

Add `EssayRevisionSummary` to the type import block at the top of the file.

- [ ] **Step 3: Create the list route**

```ts
// src/app/api/essays/[id]/revisions/route.ts
import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssayRevisions } from '@/lib/essays/queries';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const { data: essay, error } = await supabase
      .from('essays')
      .select('id')
      .eq('id', id)
      .eq('author_profile_id', profile.id)
      .maybeSingle();

    if (error) throw error;
    if (!essay) return NextResponse.json({ error: 'Esej nenalezena' }, { status: 404 });

    return NextResponse.json({ data: await getEssayRevisions(supabase, id) });
  } catch (error) {
    console.error('GET /api/essays/[id]/revisions error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst historii' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create the single-revision route**

```ts
// src/app/api/essays/[id]/revisions/[revisionNo]/route.ts
import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';

interface RouteContext {
  params: Promise<{ id: string; revisionNo: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id, revisionNo } = await params;
    const parsedNo = Number(revisionNo);
    if (!Number.isInteger(parsedNo) || parsedNo < 1) {
      return NextResponse.json({ error: 'Neplatná verze' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const { data: essay, error: essayError } = await supabase
      .from('essays')
      .select('id')
      .eq('id', id)
      .eq('author_profile_id', profile.id)
      .maybeSingle();

    if (essayError) throw essayError;
    if (!essay) return NextResponse.json({ error: 'Esej nenalezena' }, { status: 404 });

    const { data, error } = await supabase
      .from('essay_revisions')
      .select('revision_no, title, content_json')
      .eq('essay_id', id)
      .eq('revision_no', parsedNo)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Verze nenalezena' }, { status: 404 });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('GET /api/essays/[id]/revisions/[revisionNo] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst verzi' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint
git add src/lib/essays/types.ts src/lib/essays/queries.ts src/app/api/essays/\[id\]/revisions
git commit -m "feat(essays): add author-only revision history endpoints"
```

---

## Task 6: The autosave hook

A new hook rather than a generalisation of `src/lib/tymova-reflexe/use-field-autosave.ts`: that one solves per-field saves with realtime merge for many concurrent editors, and has no status/retry/flush surface. Bending it to cover a single-author whole-document editor would make it worse at both jobs. The two share idiom (2000 ms debounce, refs for latest state, `sonner` for failures), not code.

Following the same convention as `use-field-autosave.ts`, the hook itself has no direct unit test — the `src/lib/**/*.test.ts` project runs in `node`, not `jsdom`. Its behaviour is covered by the component test in Task 7.

**Files:**
- Create: `src/lib/essays/use-autosave.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  ```ts
  type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';
  interface UseAutosaveResult {
    status: AutosaveStatus;
    lastSavedAt: Date | null;
    schedule: () => void;
    flush: () => Promise<void>;
    retry: () => Promise<void>;
  }
  function useAutosave(options: { save: () => Promise<void>; enabled: boolean }): UseAutosaveResult;
  ```

- [ ] **Step 1: Write the hook**

```ts
// src/lib/essays/use-autosave.ts
import { useCallback, useEffect, useRef, useState } from 'react';

/** Quiet period after the last keystroke before a save fires. */
const AUTOSAVE_DEBOUNCE_MS = 2000;
/** Ceiling on how long continuous typing can defer a save. */
const AUTOSAVE_MAX_WAIT_MS = 20_000;
const AUTOSAVE_MAX_ATTEMPTS = 3;
const AUTOSAVE_RETRY_BASE_MS = 1000;

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions {
  /** Performs one save. Must throw on failure so the hook can retry. */
  save: () => Promise<void>;
  /** False while there is nothing savable yet (e.g. an untouched /nova page). */
  enabled: boolean;
}

export interface UseAutosaveResult {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  /** Marks the document dirty and (re)starts the debounce. */
  schedule: () => void;
  /** Saves immediately if dirty. Awaits the result. */
  flush: () => Promise<void>;
  /** Manual retry after the error state. */
  retry: () => Promise<void>;
}

/**
 * Debounced, single-flight autosave with retry and a visible status.
 *
 * Single-flight matters: without it a slow request and a fast one can land out
 * of order and resurrect stale text. Only one save is ever in flight; if the
 * document changes while it runs, exactly one more save is queued behind it.
 */
export function useAutosave({ save, enabled }: UseAutosaveOptions): UseAutosaveResult {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const saveRef = useRef(save);
  saveRef.current = save;

  const dirtyRef = useRef(false);
  const inFlightRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (maxWaitRef.current) clearTimeout(maxWaitRef.current);
    debounceRef.current = null;
    maxWaitRef.current = null;
  }, []);

  const runSave = useCallback(async () => {
    if (!dirtyRef.current || inFlightRef.current) return;

    clearTimers();
    inFlightRef.current = true;
    dirtyRef.current = false;
    setStatus('saving');

    for (let attempt = 1; attempt <= AUTOSAVE_MAX_ATTEMPTS; attempt += 1) {
      try {
        await saveRef.current();
        setStatus('saved');
        setLastSavedAt(new Date());
        inFlightRef.current = false;
        // Changes that arrived mid-flight are still unsaved.
        if (dirtyRef.current) void runSave();
        return;
      } catch {
        if (attempt === AUTOSAVE_MAX_ATTEMPTS) {
          dirtyRef.current = true;
          inFlightRef.current = false;
          setStatus('error');
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, AUTOSAVE_RETRY_BASE_MS * attempt));
      }
    }
  }, [clearTimers]);

  const schedule = useCallback(() => {
    if (!enabled) return;
    dirtyRef.current = true;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSave(), AUTOSAVE_DEBOUNCE_MS);

    // Independent ceiling so continuous typing still gets saved periodically.
    if (!maxWaitRef.current) {
      maxWaitRef.current = setTimeout(() => void runSave(), AUTOSAVE_MAX_WAIT_MS);
    }
  }, [enabled, runSave]);

  const flush = useCallback(async () => {
    clearTimers();
    await runSave();
  }, [clearTimers, runSave]);

  const retry = useCallback(async () => {
    dirtyRef.current = true;
    await runSave();
  }, [runSave]);

  // Backgrounding the tab is the most common way work is lost.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void runSave();
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, [runSave]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current && !inFlightRef.current) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  return { status, lastSavedAt, schedule, flush, retry };
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/essays/use-autosave.ts
git commit -m "feat(essays): add debounced single-flight autosave hook"
```

---

## Task 7: Wire the editor form

**Files:**
- Modify: `src/components/essays/essay-editor-form.tsx`, `src/app/(main)/cteni/eseje/[essayId]/upravit/page.tsx`
- Test: `src/components/essays/essay-editor-form.test.tsx`

**Interfaces:**
- Consumes: `useAutosave` (Task 6), `POST /api/essays` (Task 3), `POST /api/essays/[id]/publish` (Task 3), `PATCH /api/essays/[id]` (Task 4).
- Produces: `EssayEditorForm` accepts `{ initialEssay?: EssayWithDetails }` unchanged; draft-ness is read from `initialEssay?.published_at`.

- [ ] **Step 1: Write the failing component test**

```tsx
// src/components/essays/essay-editor-form.test.tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EssayEditorForm } from "@/components/essays/essay-editor-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

// Tiptap needs a real editing surface; a textarea stands in for the component test.
vi.mock("@/components/essays/tiptap-editor", () => ({
  TiptapEditor: ({ onChange }: { onChange: (json: object, text: string) => void }) => (
    <textarea
      aria-label="Text eseje"
      onChange={(e) => onChange({ type: "doc", content: [] }, e.target.value)}
    />
  ),
}));

const fetchSpy = vi.spyOn(globalThis, "fetch");

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchSpy.mockReset();
  push.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("EssayEditorForm — koncept creation", () => {
  it("does not touch the network while the form is empty", async () => {
    render(<EssayEditorForm />);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("creates the koncept exactly once on the first real change", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: { id: "essay-1" } }, 201));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm />);
    await user.type(screen.getByLabelText("Název eseje"), "Atomic Habits");
    await vi.advanceTimersByTimeAsync(3000);

    await waitFor(() => {
      const creates = fetchSpy.mock.calls.filter(([url]) => url === "/api/essays");
      expect(creates).toHaveLength(1);
    });
  });
});

describe("EssayEditorForm — autosave status", () => {
  it("shows the saved state after a successful autosave", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: { id: "essay-1" } }, 201));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm />);
    await user.type(screen.getByLabelText("Název eseje"), "Titul");
    await vi.advanceTimersByTimeAsync(3000);

    await waitFor(() => expect(screen.getByText(/Uloženo/)).toBeInTheDocument());
  });

  it("offers a retry after the save keeps failing", async () => {
    fetchSpy.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm />);
    await user.type(screen.getByLabelText("Název eseje"), "Titul");
    await vi.advanceTimersByTimeAsync(10_000);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Zkusit znovu/ })).toBeInTheDocument(),
    );
  });

  it("autosaves a title change on an existing essay", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: { revision_no: 2, updated_at: "2026-08-10T12:00:00Z" } }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm initialEssay={publishedEssay} />);
    await user.type(screen.getByLabelText("Název eseje"), " upraveno");
    await vi.advanceTimersByTimeAsync(3000);

    await waitFor(() => {
      const patches = fetchSpy.mock.calls.filter(([, init]) => init?.method === "PATCH");
      expect(patches).toHaveLength(1);
    });
  });
});

describe("EssayEditorForm — publishing", () => {
  it("publishes a koncept and navigates to the detail page", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: { id: "essay-1" } }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm initialEssay={draftEssay} />);
    await user.click(screen.getByRole("button", { name: "Zveřejnit" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/cteni/eseje/essay-1"));
    expect(fetchSpy.mock.calls.some(([url]) => url === "/api/essays/essay-1/publish")).toBe(true);
  });

  it("labels the action Uložit změny for a published essay", () => {
    render(<EssayEditorForm initialEssay={publishedEssay} />);
    expect(screen.getByRole("button", { name: "Uložit změny" })).toBeInTheDocument();
  });
});
```

Add the two fixtures above the `describe` blocks. Build them from `EssayWithDetails` so the compiler catches drift:

```tsx
const baseEssay = {
  id: "essay-1",
  author_profile_id: "profile-1",
  book_id: null,
  title: "Atomic Habits",
  content_json: { type: "doc", content: [] },
  content_text: "Nějaký text",
  view_count: 0,
  vote_count: 0,
  comment_count: 0,
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-01T10:00:00Z",
  pinned_at: null,
  pinned_by_profile_id: null,
  removed_at: null,
  author: null,
  book: null,
} satisfies Omit<import("@/lib/essays/types").EssayWithDetails, "published_at">;

const draftEssay = { ...baseEssay, published_at: null };
const publishedEssay = { ...baseEssay, published_at: "2026-08-01T10:00:00Z" };
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm vitest run --project component src/components/essays/essay-editor-form.test.tsx`
Expected: FAIL — no status text, no "Zkusit znovu" button, no publish call.

- [ ] **Step 3: Rewrite the form's state layer**

Replace the imports, state, and the `handleContentChange` / `handlePublish` block at `src/components/essays/essay-editor-form.tsx:1-90`. Leave the whole JSX body from the book picker down untouched except for the two insertions in Step 4.

```tsx
'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Save, Send, BookOpen, X } from 'lucide-react';
import { TiptapEditor } from './tiptap-editor';
import { EssayHistorySheet } from './essay-history-sheet';
import { useAutosave } from '@/lib/essays/use-autosave';
// …existing UI imports unchanged…

export function EssayEditorForm({ initialEssay }: EssayEditorFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialEssay?.title ?? '');
  const [content, setContent] = useState<{ json: object; text: string }>({
    json: initialEssay?.content_json ?? {},
    text: initialEssay?.content_text ?? '',
  });
  const [selectedBook, setSelectedBook] = useState<BookSearchResult | null>(
    initialEssay?.book as BookSearchResult | null ?? null,
  );
  const [bookQuery, setBookQuery] = useState('');
  const [bookResults, setBookResults] = useState<BookSearchResult[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [essayId, setEssayId] = useState<string | null>(initialEssay?.id ?? null);
  const isDraft = initialEssay?.published_at == null;

  // The save closure must read the newest values, not the ones captured when
  // the debounce timer was armed.
  const latestRef = useRef({ title, content, bookId: selectedBook?.id ?? null, essayId });
  latestRef.current = { title, content, bookId: selectedBook?.id ?? null, essayId };

  const creatingRef = useRef(false);

  const persist = useCallback(async () => {
    const { title: t, content: c, bookId, essayId: id } = latestRef.current;
    const payload = { title: t, content_json: c.json, content_text: c.text, book_id: bookId };

    if (!id) {
      if (creatingRef.current) return;
      creatingRef.current = true;
      try {
        const res = await fetch('/api/essays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('create failed');
        const { data } = await res.json();
        setEssayId(data.id);
        latestRef.current.essayId = data.id;
        // Shallow URL swap: router.replace would remount the page and tear
        // down Tiptap mid-sentence. Next's App Router supports the native
        // History API and keeps usePathname in sync.
        window.history.replaceState(null, '', `/cteni/eseje/${data.id}/upravit`);
      } finally {
        creatingRef.current = false;
      }
      return;
    }

    const res = await fetch(`/api/essays/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (!res.ok) throw new Error('save failed');
  }, []);

  const hasSomethingToSave = title.trim().length > 0 || content.text.trim().length > 0;
  const { status, lastSavedAt, schedule, flush, retry } = useAutosave({
    save: persist,
    enabled: hasSomethingToSave,
  });

  const handleContentChange = useCallback((json: object, text: string) => {
    setContent({ json, text });
    latestRef.current.content = { json, text };
    schedule();
  }, [schedule]);

  const handleTitleChange = useCallback((value: string) => {
    setTitle(value);
    latestRef.current.title = value;
    schedule();
  }, [schedule]);

  const handleBookChange = useCallback((book: BookSearchResult | null) => {
    setSelectedBook(book);
    latestRef.current.bookId = book?.id ?? null;
    schedule();
  }, [schedule]);

  const handlePrimaryAction = async () => {
    setIsPublishing(true);
    try {
      await flush();
      const id = latestRef.current.essayId;
      if (!id) {
        toast.error('Esej se zatím nepodařilo uložit.');
        return;
      }

      if (!isDraft) {
        toast.success('Změny uloženy.');
        router.push(`/cteni/eseje/${id}`);
        return;
      }

      const res = await fetch(`/api/essays/${id}/publish`, { method: 'POST' });
      if (!res.ok) {
        const { error } = await res.json();
        toast.error(error ?? 'Nepodařilo se zveřejnit esej.');
        return;
      }
      toast.success('Esej publikována.');
      router.push(`/cteni/eseje/${id}`);
    } finally {
      setIsPublishing(false);
    }
  };
```

Update the three call sites in the existing JSX to the new handlers: the title `Input`'s `onChange` calls `handleTitleChange(e.target.value)`; the book "remove" button calls `handleBookChange(null)`; the book result button calls `handleBookChange(book)`.

- [ ] **Step 4: Add the status line and the primary button**

Insert directly below the title `Input`:

```tsx
        <div className="flex min-h-5 items-center gap-2 text-xs text-muted-foreground">
          {status === 'saving' && <span>Ukládám…</span>}
          {status === 'saved' && lastSavedAt && (
            <span>Uloženo {lastSavedAt.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</span>
          )}
          {status === 'error' && (
            <>
              <span className="text-destructive">Neuloženo</span>
              <button
                type="button"
                onClick={() => void retry()}
                className="underline underline-offset-2 hover:text-foreground"
              >
                Zkusit znovu
              </button>
            </>
          )}
        </div>
```

Replace the submit button at the bottom:

```tsx
      <div className="flex items-center gap-2">
        <Button
          onClick={handlePrimaryAction}
          disabled={isPublishing || (isDraft && !title.trim())}
          size="lg"
        >
          {isPublishing ? <Spinner className="size-4 mr-2" /> : isDraft ? <Send className="size-4 mr-2" /> : <Save className="size-4 mr-2" />}
          {isDraft ? 'Zveřejnit' : 'Uložit změny'}
        </Button>
        {essayId && <EssayHistorySheet essayId={essayId} />}
      </div>
```

Also add `htmlFor`/`id` wiring so `getByLabelText('Název eseje')` resolves — the `Label` already has `htmlFor="essay-title"` and the `Input` `id="essay-title"`, so no change is needed there. Confirm it during the test run.

- [ ] **Step 5: Align the edit page shell**

Rewrite `src/app/(main)/cteni/eseje/[essayId]/upravit/page.tsx` to match `nova/page.tsx` — same shell, same back button — and let the author of a koncept in:

```tsx
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssayById } from '@/lib/essays/queries';
import { PageShell } from '@/components/ui/page-shell';
import { BackButton } from '@/components/essays/back-button';
import { EssayEditorForm } from '@/components/essays/essay-editor-form';

interface PageProps {
  params: Promise<{ essayId: string }>;
}

export default async function EssayEditPage({ params }: PageProps) {
  const { essayId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  const essay = await getEssayById(supabase, essayId);

  if (!essay) notFound();
  if (essay.author_profile_id !== profile?.id) redirect(`/cteni/eseje/${essayId}`);

  const isDraft = essay.published_at == null;

  return (
    <PageShell size="narrow">
      <BackButton />
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{isDraft ? 'Koncept' : 'Upravit esej'}</h1>
        {isDraft && (
          <p className="text-sm text-muted-foreground">
            Rozepsaná esej. Uvidíš ji jenom ty, dokud ji nezveřejníš.
          </p>
        )}
      </div>
      <EssayEditorForm initialEssay={essay} />
    </PageShell>
  );
}
```

- [ ] **Step 6: Run the component test and confirm it passes**

Run: `pnpm vitest run --project component src/components/essays/essay-editor-form.test.tsx`
Expected: PASS, 6 tests. `EssayHistorySheet` does not exist yet — stub it as a file exporting a component that renders a single button so this task compiles; Task 8 fills it in.

- [ ] **Step 7: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add src/components/essays/essay-editor-form.tsx src/components/essays/essay-editor-form.test.tsx "src/app/(main)/cteni/eseje/[essayId]/upravit/page.tsx"
git commit -m "feat(essays): autosave the editor with visible status and koncept creation"
```

---

## Task 8: History sheet

**Files:**
- Create: `src/components/essays/essay-history-sheet.tsx`, `src/components/essays/essay-history-sheet.test.tsx`

**Interfaces:**
- Consumes: `GET /api/essays/[id]/revisions`, `GET /api/essays/[id]/revisions/[revisionNo]` (Task 5); `EssayRevisionSummary` (Task 5); the existing `TiptapRenderer`.
- Produces: `<EssayHistorySheet essayId={string} />`.

- [ ] **Step 1: Write the failing component test**

```tsx
// src/components/essays/essay-history-sheet.test.tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EssayHistorySheet } from "@/components/essays/essay-history-sheet";

vi.mock("@/components/essays/tiptap-renderer", () => ({
  TiptapRenderer: () => <div data-testid="rendered-revision" />,
}));

const fetchSpy = vi.spyOn(globalThis, "fetch");

const revisions = [
  { revision_no: 3, title: "Atomic Habits", created_at: "2026-08-10T09:00:00Z", updated_at: "2026-08-10T09:20:00Z", word_count: 1240, snippet: "Kniha o návycích" },
  { revision_no: 2, title: "Atomic Habits", created_at: "2026-08-09T19:00:00Z", updated_at: "2026-08-09T19:10:00Z", word_count: 980, snippet: "Rozepsané" },
];

beforeEach(() => {
  fetchSpy.mockReset();
});

describe("EssayHistorySheet", () => {
  it("fetches nothing until it is opened", () => {
    render(<EssayHistorySheet essayId="essay-1" />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("lists revisions when opened", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: revisions }), { status: 200 }),
    );
    const user = userEvent.setup();

    render(<EssayHistorySheet essayId="essay-1" />);
    await user.click(screen.getByRole("button", { name: /Historie/ }));

    await waitFor(() => expect(screen.getByText("1240 slov")).toBeInTheDocument());
    expect(screen.getByText("980 slov")).toBeInTheDocument();
  });

  it("shows an empty state when there is only the current version", async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    const user = userEvent.setup();

    render(<EssayHistorySheet essayId="essay-1" />);
    await user.click(screen.getByRole("button", { name: /Historie/ }));

    await waitFor(() =>
      expect(screen.getByText("Zatím žádné starší verze.")).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm vitest run --project component src/components/essays/essay-history-sheet.test.tsx`
Expected: FAIL — the stub from Task 7 renders a bare button with no fetching.

- [ ] **Step 3: Implement the sheet**

```tsx
// src/components/essays/essay-history-sheet.tsx
'use client';

import { useState } from 'react';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { TiptapRenderer } from './tiptap-renderer';
import type { EssayRevisionSummary } from '@/lib/essays/types';

interface EssayHistorySheetProps {
  essayId: string;
}

interface OpenRevision {
  revision_no: number;
  title: string;
  content_json: object;
}

function formatRevisionDate(iso: string): string {
  return new Date(iso).toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function EssayHistorySheet({ essayId }: EssayHistorySheetProps) {
  const [revisions, setRevisions] = useState<EssayRevisionSummary[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState<OpenRevision | null>(null);

  // Fetched on open rather than server-rendered: autosave changes the list
  // continuously, so anything rendered at page load would already be stale.
  const loadRevisions = async (isOpen: boolean) => {
    if (!isOpen) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/essays/${essayId}/revisions`);
      const { data } = await res.json();
      setRevisions(data ?? []);
    } finally {
      setIsLoading(false);
    }
  };

  const openRevision = async (revisionNo: number) => {
    const res = await fetch(`/api/essays/${essayId}/revisions/${revisionNo}`);
    const { data } = await res.json();
    if (data) setOpen(data);
  };

  return (
    <>
      <Sheet onOpenChange={loadRevisions}>
        <SheetTrigger asChild>
          <Button variant="outline" size="lg" className="gap-2">
            <History className="size-4" />
            Historie
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Historie verzí</SheetTitle>
          </SheetHeader>

          {isLoading && <Spinner className="mx-auto my-8 size-5" />}

          {!isLoading && revisions?.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Zatím žádné starší verze.
            </p>
          )}

          <div className="divide-y">
            {revisions?.map((revision) => (
              <button
                key={revision.revision_no}
                type="button"
                onClick={() => void openRevision(revision.revision_no)}
                className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <p className="text-sm font-medium">
                  {revision.title.trim() ? revision.title : 'Bez názvu'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatRevisionDate(revision.updated_at)} · {revision.word_count} slov
                </p>
                {revision.snippet && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">
                    {revision.snippet}
                  </p>
                )}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={open != null} onOpenChange={(next) => { if (!next) setOpen(null); }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{open?.title.trim() ? open.title : 'Bez názvu'}</DialogTitle>
          </DialogHeader>
          {open && <TiptapRenderer content={open.content_json} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
```

Check `TiptapRenderer`'s actual prop name before wiring it and match it.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run --project component src/components/essays/essay-history-sheet.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add src/components/essays/essay-history-sheet.tsx src/components/essays/essay-history-sheet.test.tsx
git commit -m "feat(essays): add read-only revision history sheet"
```

---

## Task 9: Koncepty in Moje eseje

**Files:**
- Modify: `src/lib/essays/types.ts`, `src/lib/essays/queries.ts:203-224`, `src/components/essays/my-essay-list.tsx`, `src/components/essays/prehled-tabs.tsx`, `src/app/(main)/cteni/prehled/page.tsx`, `src/app/(main)/cteni/eseje/[essayId]/page.tsx`
- Test: `src/components/essays/my-essay-list.test.tsx`

**Interfaces:**
- Consumes: `EssayWithDetails`.
- Produces: `EssayFilters.status?: 'draft' | 'published'` (defaults to `'published'`); `MyEssayList` accepts `drafts?: EssayWithDetails[]`.

- [ ] **Step 1: Write the failing component test**

```tsx
// src/components/essays/my-essay-list.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MyEssayList } from "@/components/essays/my-essay-list";
import type { EssayWithDetails } from "@/lib/essays/types";

function essay(overrides: Partial<EssayWithDetails> = {}): EssayWithDetails {
  return {
    id: "essay-1",
    author_profile_id: "profile-1",
    book_id: null,
    title: "Zveřejněná esej",
    content_json: {},
    content_text: "Text",
    published_at: "2026-08-01T10:00:00Z",
    view_count: 0,
    vote_count: 0,
    comment_count: 0,
    created_at: "2026-08-01T10:00:00Z",
    updated_at: "2026-08-01T10:00:00Z",
    pinned_at: null,
    pinned_by_profile_id: null,
    removed_at: null,
    author: null,
    book: null,
    ...overrides,
  };
}

describe("MyEssayList koncepty", () => {
  it("renders no koncepty heading when there are none", () => {
    render(<MyEssayList essays={[essay()]} />);
    expect(screen.queryByText(/Koncepty/)).not.toBeInTheDocument();
  });

  it("groups koncepty above published essays with a count", () => {
    const draft = essay({ id: "essay-2", title: "Rozepsané", published_at: null });
    render(<MyEssayList essays={[essay()]} drafts={[draft]} />);
    expect(screen.getByText("Koncepty (1)")).toBeInTheDocument();
  });

  it("falls back to Bez názvu for an untitled koncept", () => {
    const draft = essay({ id: "essay-2", title: "", published_at: null });
    render(<MyEssayList essays={[]} drafts={[draft]} />);
    expect(screen.getByText("Bez názvu")).toBeInTheDocument();
  });

  it("links a koncept straight to the editor", () => {
    const draft = essay({ id: "essay-2", title: "Rozepsané", published_at: null });
    render(<MyEssayList essays={[]} drafts={[draft]} />);
    expect(screen.getByRole("link", { name: /Rozepsané/ })).toHaveAttribute(
      "href",
      "/cteni/eseje/essay-2/upravit",
    );
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm vitest run --project component src/components/essays/my-essay-list.test.tsx`
Expected: FAIL — `MyEssayList` has no `drafts` prop.

- [ ] **Step 3: Add the filter**

In `src/lib/essays/types.ts`, extend `EssayFilters`:

```ts
export interface EssayFilters {
  view?: EssayListView;
  authorProfileId?: string;
  teamId?: string;
  bookId?: string;
  search?: string;
  tag?: string;
  sort?: EssaySortOrder;
  page?: number;
  pageSize?: number;
  /** Defaults to 'published' so every existing caller keeps its behaviour. */
  status?: 'draft' | 'published';
}
```

In `src/lib/essays/queries.ts`, inside `buildQuery` (line ~203), replace the hardcoded published filter:

```ts
    const status = filters?.status ?? 'published';
    let q = supabase
      .from('essays')
      .select(ESSAY_DETAIL_SELECT)
      .is('removed_at', null)
      .order('created_at', { ascending: false });

    q = status === 'draft'
      ? q.is('published_at', null)
      : q.not('published_at', 'is', null);
```

Leave `getEssaysByTeam`, `getUnreadTeamEssaysForCoach`, `getReadTeamEssaysForCoach`, and `getCoachUnreadCount` on their existing hardcoded published filters — coaches never review koncepty.

- [ ] **Step 4: Render the koncepty group**

In `src/components/essays/my-essay-list.tsx`, add the prop and a group above the existing list. Reuse the existing row markup for published essays; koncepty get a simpler row because they have no votes, views, or comments to show.

```tsx
interface MyEssayListProps {
  essays: EssayWithDetails[];
  drafts?: EssayWithDetails[];
  votedEssayIds?: Set<string>;
}

export function MyEssayList({ essays, drafts = [], votedEssayIds = new Set() }: MyEssayListProps) {
```

Insert immediately inside the returned fragment, before the published `divide-y` block (wrap both in a `<div className="space-y-6">`):

```tsx
      {drafts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Koncepty ({drafts.length})
          </h3>
          <div className="divide-y divide-border/50">
            {drafts.map((draft) => (
              <Link
                key={draft.id}
                href={`/cteni/eseje/${draft.id}/upravit`}
                className="group focus-ring -mx-2 flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/30"
              >
                <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {draft.title.trim() ? draft.title : 'Bez názvu'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    upraveno {new Date(draft.updated_at).toLocaleDateString('cs-CZ', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-xs">Koncept</Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
```

Add `FileText` to the `lucide-react` import and `Badge` from `@/components/ui/badge`.

- [ ] **Step 5: Thread drafts through the page**

In `src/app/(main)/cteni/prehled/page.tsx`, fetch drafts alongside the existing essays (add to whatever `Promise.all` is already there):

```ts
    getEssays(supabase, { authorProfileId: profile.id, status: 'draft' }),
```

Pass `drafts` into `<PrehledTabs …>`, add `drafts: EssayWithDetails[]` to `PrehledTabsProps`, and forward it to `<MyEssayList essays={myEssays} drafts={drafts} votedEssayIds={votedEssayIds} />`.

Update the empty state at `src/components/essays/prehled-tabs.tsx:45` so a user whose only work is a koncept does not see "Zatím žádné eseje": change the condition to `myEssays.length === 0 && drafts.length === 0`.

- [ ] **Step 6: Redirect the author of a koncept away from the detail page**

In `src/app/(main)/cteni/eseje/[essayId]/page.tsx`, right after the `if (!essay) notFound();` guard:

```tsx
  // A koncept has no public face — send its author to the editor. Everyone
  // else already gets notFound() from the essays SELECT policy.
  if (essay.published_at == null) redirect(`/cteni/eseje/${essayId}/upravit`);
```

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `pnpm test`
Expected: PASS, all unit and component tests including the four new ones.

- [ ] **Step 8: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint
git add src/lib/essays/types.ts src/lib/essays/queries.ts src/components/essays/my-essay-list.tsx src/components/essays/my-essay-list.test.tsx src/components/essays/prehled-tabs.tsx "src/app/(main)/cteni/prehled/page.tsx" "src/app/(main)/cteni/eseje/[essayId]/page.tsx"
git commit -m "feat(essays): surface koncepty in Moje eseje"
```

---

## Task 10: End-to-end proof

**Files:**
- Create: `tests/e2e/essay-autosave.spec.ts`

**Interfaces:**
- Consumes: `tests/e2e/fixtures/auth.ts` — `getSetupSessionCookie`, `setAuthCookie`, `cleanupTestData`.
- Produces: nothing downstream.

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/essay-autosave.spec.ts
import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  getSetupSessionCookie,
  setAuthCookie,
} from "./fixtures/auth";

const DRAFT_TITLE = "E2E koncept o návycích";
const DRAFT_BODY = "Tohle je text, který musí přežít reload stránky.";

test.describe("essay autosave and koncepty", () => {
  let cookieValue: string;

  test.beforeAll(async () => {
    const { cookie } = await getSetupSessionCookie();
    cookieValue = cookie;
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("autosaves a new essay as a koncept and survives a reload", async ({ page, context }) => {
    await setAuthCookie(context, cookieValue);
    await page.goto("/cteni/eseje/nova");

    await page.getByLabel("Název eseje").fill(DRAFT_TITLE);
    await page.locator(".ProseMirror").click();
    await page.keyboard.type(DRAFT_BODY);

    // The URL swaps to the editor route once the koncept row exists.
    await expect(page).toHaveURL(/\/cteni\/eseje\/[0-9a-f-]{36}\/upravit$/, { timeout: 15_000 });
    await expect(page.getByText(/Uloženo/)).toBeVisible({ timeout: 15_000 });

    const editorUrl = page.url();
    await page.reload();

    await expect(page.getByLabel("Název eseje")).toHaveValue(DRAFT_TITLE);
    await expect(page.locator(".ProseMirror")).toContainText(DRAFT_BODY);
    expect(page.url()).toBe(editorUrl);
  });

  test("a koncept appears under Koncepty and disappears once published", async ({ page, context }) => {
    await setAuthCookie(context, cookieValue);
    await page.goto("/cteni/eseje/nova");

    await page.getByLabel("Název eseje").fill(DRAFT_TITLE);
    await page.locator(".ProseMirror").click();
    await page.keyboard.type(DRAFT_BODY);
    await expect(page).toHaveURL(/\/upravit$/, { timeout: 15_000 });
    await expect(page.getByText(/Uloženo/)).toBeVisible({ timeout: 15_000 });

    await page.goto("/cteni/prehled");
    await expect(page.getByText(/Koncepty \(/)).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(DRAFT_TITLE) })).toBeVisible();

    await page.getByRole("link", { name: new RegExp(DRAFT_TITLE) }).click();
    await page.getByRole("button", { name: "Zveřejnit" }).click();

    await expect(page).toHaveURL(/\/cteni\/eseje\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: DRAFT_TITLE })).toBeVisible();

    await page.goto("/cteni/prehled");
    await expect(page.getByText(/Koncepty \(/)).not.toBeVisible();
  });

  test("history lists at least the current version", async ({ page, context }) => {
    await setAuthCookie(context, cookieValue);
    await page.goto("/cteni/eseje/nova");

    await page.getByLabel("Název eseje").fill(DRAFT_TITLE);
    await page.locator(".ProseMirror").click();
    await page.keyboard.type(DRAFT_BODY);
    await expect(page).toHaveURL(/\/upravit$/, { timeout: 15_000 });
    await expect(page.getByText(/Uloženo/)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /Historie/ }).click();
    await expect(page.getByText("Historie verzí")).toBeVisible();
    await expect(page.getByText(/slov/)).toBeVisible();
  });
});
```

- [ ] **Step 2: Check the fixture surface**

Read `tests/e2e/fixtures/auth.ts` and confirm `cleanupTestData` removes essays created by the setup user. If it only cleans books and reflections, extend it to delete essays authored by the setup profile — otherwise these tests leave koncepty behind and the second run sees a stale `Koncepty (n)` count.

- [ ] **Step 3: Run the E2E suite**

Run: `pnpm test:e2e tests/e2e/essay-autosave.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 4: Run everything**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm test:integration && pnpm test:e2e
```
Expected: all green. Report the actual output — do not claim completion from a partial run.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/essay-autosave.spec.ts tests/e2e/fixtures/auth.ts
git commit -m "test(essays): cover autosave, koncepty, and history end to end"
```

---

## Self-review notes

**Spec coverage.** Every section of the design maps to a task: RLS → 2; koncept semantics → 2, 3, 9; coalescing → 1, 2, 4; API surface → 3, 4, 5; autosave hook → 6; editor UI → 7; history UI → 5, 8; Moje eseje → 9; draft detail redirect → 9; page-shell cleanup → 7; testing matrix → 1, 2, 7, 8, 9, 10.

**Two deviations from the spec, both deliberate:**
- The spec put `useAutosave` under an unstated test plan; the plan pins it to component-level coverage because `vitest.config.ts` runs `src/lib/**/*.test.ts` in `node`, where `renderHook` cannot mount. This matches how `use-field-autosave.ts` is already handled.
- The spec did not mention `fetchCreatedEssay`. Task 3 deletes it, and the plan notes why: its select references a `books.status` column that does not exist.

**Known follow-ups, deliberately out of scope:** multi-tab conflict resolution, restoring from history, diffs, unpublishing, offline queueing.
