# Linda — ATP Nudge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Linda", an automated reviewer that reads every newly published essay, and — when the essay lacks ATP (apply-theory-in-practice reflection) — posts one essay-specific open question in Gen-Z Czech nudging the student to add it; she resolves her own nudge when the student edits the ATP in, and coaches get a visual signal for essays with an open nudge.

**Architecture:** Linda is a regular `profiles` row (no auth user, role `student`, so no badge — she reads as a normal person). On essay publish/edit, the API route fires a background task (`after()`) that loads the essay with the service-role admin client, asks Google Gemini for a structured verdict `{ has_atp, nudge_text }`, and inserts/resolves/skips a comment accordingly. Linda's comments live in the existing `essay_comments` table, marked with `is_linda_nudge` + `nudge_status` columns so the app can dedupe, resolve, and drive the coach signal. Pure logic (prompt building, response parsing, action decision) is isolated in small modules under `lib/linda/` and unit-tested; the DB/route/UI wiring is verified manually.

**Tech Stack:** Next.js 16 (App Router, `after()`), Supabase (Postgres + service-role admin client), `@google/genai` (Gemini), vitest (new — pure-logic tests only).

**Testing note (deviation from default TDD):** This repo currently has zero test infrastructure. Rather than retrofit a full harness, this plan adds `vitest` scoped to the three pure modules where bugs actually hide (prompt assembly, verdict parsing, action decision). Integration (migration, routes, queries, UI) is verified with the manual steps in Task 14. This is a deliberate, bounded choice.

---

## File structure

**New files:**
- `supabase/migrations/20260611120000_linda_atp_nudge.sql` — Linda profile row; `is_linda_nudge` + `nudge_status` columns + partial index on `essay_comments`.
- `lib/linda/config.ts` — Linda profile id, model id, ATP rubric, persona/tone rules, resolve messages.
- `lib/linda/types.ts` — `LindaVerdict`, `LindaAction`.
- `lib/linda/prompt.ts` — `buildAtpPrompt()` (pure).
- `lib/linda/parse.ts` — `parseLindaVerdict()` (pure).
- `lib/linda/decide.ts` — `decideLindaAction()` (pure).
- `lib/linda/gemini.ts` — `evaluateEssayAtp()` (calls Gemini).
- `lib/linda/queries.ts` — `getOpenLindaNudge()`, `insertLindaNudge()`, `resolveLindaNudge()` (admin client).
- `lib/linda/review.ts` — `runLindaReview()` (orchestrator).
- `lib/linda/prompt.test.ts`, `lib/linda/parse.test.ts`, `lib/linda/decide.test.ts` — unit tests.
- `vitest.config.ts` — test config.

**Modified files:**
- `package.json` — add `@google/genai`, `vitest`, `test` script.
- `app/api/essays/route.ts` — fire `runLindaReview` after publish.
- `app/api/essays/[id]/route.ts` — fire `runLindaReview` after content edit.
- `lib/essays/types.ts` — extend `EssayComment`, `CoachReviewEssay`.
- `lib/essays/queries.ts` — `getEssayIdsWithOpenLindaNudge()` + annotate coach review queues.
- `components/essays/coach-review-list.tsx` — "Chybí ATP" badge.

---

## Task 1: Dependencies and test harness

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install runtime + dev dependencies**

Run:
```bash
pnpm add @google/genai
pnpm add -D vitest
```
Expected: both install successfully; `package.json` gains `@google/genai` in `dependencies` and `vitest` in `devDependencies`.

- [ ] **Step 2: Add the test script**

In `package.json`, inside `"scripts"`, add a `test` entry (place it after `"lint"`):

```json
    "lint": "eslint .",
    "test": "vitest run",
```

- [ ] **Step 3: Create the vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Verify the runner works (no tests yet)**

Run: `pnpm test`
Expected: vitest runs and reports "No test files found" (exit non-zero is fine here) — confirms vitest is installed and configured. The first real tests arrive in Task 4.

- [ ] **Step 5: Add GEMINI_API_KEY to local env (manual, not committed)**

Add a line to `.env.local` (this file is git-ignored; do NOT commit it):
```
GEMINI_API_KEY=<your Google AI Studio key>
```
Note for the operator: get a key from Google AI Studio. Linda fails silently without it, so the app still works — she just won't comment.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: add @google/genai and vitest for Linda ATP nudge"
```

---

## Task 2: Database migration — Linda profile + nudge columns

**Files:**
- Create: `supabase/migrations/20260611120000_linda_atp_nudge.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260611120000_linda_atp_nudge.sql`:

```sql
-- ============================================================================
-- Linda: automated ATP nudge reviewer
-- ----------------------------------------------------------------------------
-- Linda reads newly published essays and, when an essay lacks ATP (applying
-- theory in practice), posts one open question nudging the student. She is a
-- regular profile row (no auth user, role 'student') so she renders as an
-- ordinary person named "Linda" with no AI label. Her comments are marked so
-- the app can dedupe, resolve, and signal coaches.
-- ============================================================================

alter table public.essay_comments
  add column is_linda_nudge boolean not null default false,
  add column nudge_status text
    check (nudge_status is null or nudge_status in ('open', 'resolved'));

comment on column public.essay_comments.is_linda_nudge is
  'True for comments authored by Linda as an ATP nudge.';
comment on column public.essay_comments.nudge_status is
  'For Linda nudges: open (awaiting ATP) or resolved (ATP added). NULL for normal comments.';

-- Fast lookup of an essay''s open Linda nudge (one expected per essay).
create index essay_comments_open_linda_nudge_idx
  on public.essay_comments (essay_id)
  where is_linda_nudge and nudge_status = 'open';

-- Linda''s fixed profile. work_email must satisfy the valid_czu_domain check.
insert into public.profiles (id, name, work_email, role)
values ('d1111111-1111-4111-8111-111111111111', 'Linda', 'linda@pef.czu.cz', 'student')
on conflict (id) do nothing;
```

- [ ] **Step 2: Apply the migration locally**

Run: `pnpm supabase migration up`
Expected: migration `20260611120000_linda_atp_nudge` applies with no error.

- [ ] **Step 3: Verify schema and seed row**

Run:
```bash
pnpm supabase db diff --schema public | head -5
```
Then confirm Linda exists and columns are present by running this SQL via the local DB (Supabase Studio SQL editor at the local URL, or `psql`):
```sql
select id, name, work_email, role from public.profiles
where id = 'd1111111-1111-4111-8111-111111111111';
select column_name from information_schema.columns
where table_name = 'essay_comments' and column_name in ('is_linda_nudge', 'nudge_status');
```
Expected: one Linda row; both columns listed.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260611120000_linda_atp_nudge.sql
git commit -m "feat: Linda profile and essay_comments nudge columns"
```

---

## Task 3: Linda config and types

**Files:**
- Create: `lib/linda/config.ts`
- Create: `lib/linda/types.ts`

- [ ] **Step 1: Write the types**

Create `lib/linda/types.ts`:

```ts
/** Structured verdict returned by Gemini for one essay. */
export interface LindaVerdict {
  /** True if the essay reflects applying theory in practice (ATP). */
  has_atp: boolean;
  /** Essay-specific Czech nudge question; null/absent when has_atp is true. */
  nudge_text: string | null;
}

/** What runLindaReview should do, given a verdict and current nudge state. */
export type LindaAction =
  | { kind: 'insert'; body: string }
  | { kind: 'resolve' }
  | { kind: 'noop' };
```

- [ ] **Step 2: Write the config**

Create `lib/linda/config.ts`:

```ts
// Linda's fixed profile id — MUST match the seeded row in
// supabase/migrations/20260611120000_linda_atp_nudge.sql.
export const LINDA_PROFILE_ID = 'd1111111-1111-4111-8111-111111111111';

// Gemini model. Flash = fast + cheap, good enough for this judgment.
export const LINDA_MODEL = 'gemini-2.5-flash';

// The ATP rubric Linda judges against (the program's own wording).
export const ATP_RUBRIC = `Esej nemusí být dokonalé literární dílo a nemá pevně stanovenou podobu, ale je esenciální, aby byla psaná formou ATP (Aplikace Teorie v Praxi). To znamená, že reflektuje, jak student získané znalosti dokázal nebo dokáže převést do praxe. Nejdůležitější je kvalita reflexe na získané myšlenky, nástroje a poznatky — nejde o přepisování nebo shrnování obsahu knihy. Esej, které ATP chybí (je to jen shrnutí obsahu bez osobní aplikace), nesplňuje požadavek.`;

// Linda's voice. Editable — tweak slang/strictness here without touching code.
export const LINDA_PERSONA = `Jsi Linda. Píšeš česky, jsi kamarádská a mluvíš jako mladý člověk (gen Z), ale slušně a s respektem. NIKDY nepoužíváš sprostá ani vulgární slova. Jsi pozitivní a podporující, ne přísná ani povýšená. Smíš použít maximálně jeden emoji.`;

// Celebratory closers used when an open nudge gets resolved (ATP was added).
export const LINDA_RESOLVE_MESSAGES = [
  'ayy, teď to dává smysl 🙌',
  'tadyy to je! Přesně tohle jsem chtěla vidět 🔥',
  'super, ATP je tam — teď to žije 💪',
];
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no new type errors from `lib/linda/config.ts` or `lib/linda/types.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/linda/config.ts lib/linda/types.ts
git commit -m "feat: Linda config and verdict/action types"
```

---

## Task 4: Prompt builder (pure) + test

**Files:**
- Create: `lib/linda/prompt.ts`
- Test: `lib/linda/prompt.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/linda/prompt.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildAtpPrompt } from './prompt';
import { ATP_RUBRIC } from './config';

describe('buildAtpPrompt', () => {
  const base = { title: 'Moje esej', contentText: 'Tohle je obsah eseje.' };

  it('includes the ATP rubric', () => {
    expect(buildAtpPrompt(base)).toContain(ATP_RUBRIC);
  });

  it('includes the essay title and content', () => {
    const prompt = buildAtpPrompt(base);
    expect(prompt).toContain('Moje esej');
    expect(prompt).toContain('Tohle je obsah eseje.');
  });

  it('includes book context when provided', () => {
    const prompt = buildAtpPrompt({ ...base, bookTitle: 'Atomic Habits', bookAuthor: 'James Clear' });
    expect(prompt).toContain('Atomic Habits');
    expect(prompt).toContain('James Clear');
  });

  it('omits the book line when no book is provided', () => {
    expect(buildAtpPrompt(base)).not.toContain('Kniha:');
  });

  it('instructs a JSON verdict with has_atp and nudge_text', () => {
    const prompt = buildAtpPrompt(base);
    expect(prompt).toContain('has_atp');
    expect(prompt).toContain('nudge_text');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/linda/prompt.test.ts`
Expected: FAIL — cannot resolve `./prompt`.

- [ ] **Step 3: Write the prompt builder**

Create `lib/linda/prompt.ts`:

```ts
import { ATP_RUBRIC, LINDA_PERSONA } from './config';

export interface EssayPromptInput {
  title: string;
  contentText: string;
  bookTitle?: string | null;
  bookAuthor?: string | null;
}

export function buildAtpPrompt(input: EssayPromptInput): string {
  const bookLine = input.bookTitle
    ? `Kniha: „${input.bookTitle}"${input.bookAuthor ? ` (${input.bookAuthor})` : ''}\n`
    : '';

  return `${LINDA_PERSONA}

Tvým úkolem je posoudit studentskou esej podle tohoto pravidla:
${ATP_RUBRIC}

Posuď, zda esej obsahuje ATP (osobní reflexi aplikace v praxi), nebo zda je to jen shrnutí obsahu.

Pokud ATP CHYBÍ, napiš jednu krátkou, otevřenou otázku v češtině, která konkrétně odkazuje na myšlenku, o které student psal, a pobízí ho, aby popsal, jak by ji použil v reálném životě nebo praxi. Otázka musí být ve tvém stylu (kamarádská, gen Z, slušná, max jeden emoji, žádná sprostá slova).

Pokud ATP esej OBSAHUJE, vrať has_atp = true a nudge_text = null.

Vrať odpověď výhradně jako JSON podle schématu: { "has_atp": boolean, "nudge_text": string | null }.

--- ESEJ ---
${bookLine}Název: ${input.title}

${input.contentText}
--- KONEC ESEJE ---`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run lib/linda/prompt.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/linda/prompt.ts lib/linda/prompt.test.ts
git commit -m "feat: Linda ATP prompt builder with tests"
```

---

## Task 5: Verdict parser (pure) + test

**Files:**
- Create: `lib/linda/parse.ts`
- Test: `lib/linda/parse.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/linda/parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseLindaVerdict } from './parse';

describe('parseLindaVerdict', () => {
  it('parses a missing-ATP verdict with a nudge', () => {
    const v = parseLindaVerdict('{"has_atp": false, "nudge_text": "A jak to použiješ ty?"}');
    expect(v).toEqual({ has_atp: false, nudge_text: 'A jak to použiješ ty?' });
  });

  it('parses an ATP-present verdict', () => {
    const v = parseLindaVerdict('{"has_atp": true, "nudge_text": null}');
    expect(v).toEqual({ has_atp: true, nudge_text: null });
  });

  it('normalizes an empty or whitespace nudge_text to null', () => {
    expect(parseLindaVerdict('{"has_atp": false, "nudge_text": "   "}').nudge_text).toBeNull();
  });

  it('trims surrounding whitespace from nudge_text', () => {
    expect(parseLindaVerdict('{"has_atp": false, "nudge_text": "  ahoj  "}').nudge_text).toBe('ahoj');
  });

  it('throws when has_atp is missing', () => {
    expect(() => parseLindaVerdict('{"nudge_text": "x"}')).toThrow();
  });

  it('throws on invalid JSON', () => {
    expect(() => parseLindaVerdict('not json')).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/linda/parse.test.ts`
Expected: FAIL — cannot resolve `./parse`.

- [ ] **Step 3: Write the parser**

Create `lib/linda/parse.ts`:

```ts
import type { LindaVerdict } from './types';

export function parseLindaVerdict(raw: string): LindaVerdict {
  const data = JSON.parse(raw) as { has_atp?: unknown; nudge_text?: unknown };

  if (typeof data.has_atp !== 'boolean') {
    throw new Error('Linda verdict is missing a boolean has_atp');
  }

  const trimmed = typeof data.nudge_text === 'string' ? data.nudge_text.trim() : '';
  return {
    has_atp: data.has_atp,
    nudge_text: trimmed.length > 0 ? trimmed : null,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run lib/linda/parse.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/linda/parse.ts lib/linda/parse.test.ts
git commit -m "feat: Linda verdict parser with tests"
```

---

## Task 6: Action decision (pure) + test

**Files:**
- Create: `lib/linda/decide.ts`
- Test: `lib/linda/decide.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/linda/decide.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { decideLindaAction } from './decide';

describe('decideLindaAction', () => {
  it('inserts a nudge when ATP is missing and none exists yet', () => {
    const action = decideLindaAction({ has_atp: false, nudge_text: 'Jak to použiješ?' }, false);
    expect(action).toEqual({ kind: 'insert', body: 'Jak to použiješ?' });
  });

  it('does nothing extra when ATP is still missing and a nudge is already open', () => {
    expect(decideLindaAction({ has_atp: false, nudge_text: 'znovu?' }, true)).toEqual({ kind: 'noop' });
  });

  it('resolves the open nudge when ATP is now present', () => {
    expect(decideLindaAction({ has_atp: true, nudge_text: null }, true)).toEqual({ kind: 'resolve' });
  });

  it('does nothing when ATP is present and there is no open nudge', () => {
    expect(decideLindaAction({ has_atp: true, nudge_text: null }, false)).toEqual({ kind: 'noop' });
  });

  it('does not insert when ATP is missing but no nudge text was produced', () => {
    expect(decideLindaAction({ has_atp: false, nudge_text: null }, false)).toEqual({ kind: 'noop' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/linda/decide.test.ts`
Expected: FAIL — cannot resolve `./decide`.

- [ ] **Step 3: Write the decision logic**

Create `lib/linda/decide.ts`:

```ts
import type { LindaVerdict, LindaAction } from './types';

/**
 * Decide what Linda should do given the model verdict and whether she
 * already has an open nudge on this essay. One open nudge per essay, max:
 * she inserts at most once, then only resolves it once ATP appears.
 */
export function decideLindaAction(verdict: LindaVerdict, hasOpenNudge: boolean): LindaAction {
  if (verdict.has_atp) {
    return hasOpenNudge ? { kind: 'resolve' } : { kind: 'noop' };
  }

  // ATP is missing.
  if (hasOpenNudge) return { kind: 'noop' }; // never pile on
  const body = verdict.nudge_text?.trim();
  if (!body) return { kind: 'noop' };
  return { kind: 'insert', body };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run lib/linda/decide.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the whole suite**

Run: `pnpm test`
Expected: PASS — 3 files, 16 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/linda/decide.ts lib/linda/decide.test.ts
git commit -m "feat: Linda nudge action decision with tests"
```

---

## Task 7: Gemini client

**Files:**
- Create: `lib/linda/gemini.ts`

- [ ] **Step 1: Write the Gemini client**

Create `lib/linda/gemini.ts`:

```ts
import { GoogleGenAI, Type } from '@google/genai';
import { LINDA_MODEL } from './config';
import { buildAtpPrompt, type EssayPromptInput } from './prompt';
import { parseLindaVerdict } from './parse';
import type { LindaVerdict } from './types';

/**
 * Ask Gemini whether the essay contains ATP and, if not, for a nudge question.
 * Throws on missing key, empty response, or unparseable output — callers
 * (runLindaReview) are expected to catch and fail silently.
 */
export async function evaluateEssayAtp(input: EssayPromptInput): Promise<LindaVerdict> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: LINDA_MODEL,
    contents: buildAtpPrompt(input),
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          has_atp: { type: Type.BOOLEAN },
          nudge_text: { type: Type.STRING, nullable: true },
        },
        required: ['has_atp'],
        propertyOrdering: ['has_atp', 'nudge_text'],
      },
      temperature: 0.7,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Empty Gemini response');
  return parseLindaVerdict(text);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no type errors. (If `Type` is not exported under that name, check `@google/genai` exports — the structured-output enum is exported as `Type`.)

- [ ] **Step 3: Commit**

```bash
git add lib/linda/gemini.ts
git commit -m "feat: Gemini client for Linda ATP evaluation"
```

---

## Task 8: Nudge DB queries (admin client)

**Files:**
- Create: `lib/linda/queries.ts`

- [ ] **Step 1: Write the nudge queries**

Create `lib/linda/queries.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { LINDA_PROFILE_ID } from './config';

/** Returns the essay's currently-open Linda nudge, if any. */
export async function getOpenLindaNudge(
  supabase: SupabaseClient,
  essayId: string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('essay_comments')
    .select('id')
    .eq('essay_id', essayId)
    .eq('author_profile_id', LINDA_PROFILE_ID)
    .eq('is_linda_nudge', true)
    .eq('nudge_status', 'open')
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/** Insert a new open Linda nudge comment on an essay. */
export async function insertLindaNudge(
  supabase: SupabaseClient,
  essayId: string,
  body: string,
): Promise<void> {
  const { error } = await supabase.from('essay_comments').insert({
    essay_id: essayId,
    author_profile_id: LINDA_PROFILE_ID,
    body,
    is_linda_nudge: true,
    nudge_status: 'open',
  });
  if (error) throw error;
}

/** Resolve an open Linda nudge: replace its body and mark it resolved. */
export async function resolveLindaNudge(
  supabase: SupabaseClient,
  nudgeId: string,
  body: string,
): Promise<void> {
  const { error } = await supabase
    .from('essay_comments')
    .update({ body, nudge_status: 'resolved' })
    .eq('id', nudgeId);
  if (error) throw error;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add lib/linda/queries.ts
git commit -m "feat: Linda nudge DB queries"
```

---

## Task 9: Review orchestrator

**Files:**
- Create: `lib/linda/review.ts`

- [ ] **Step 1: Write the orchestrator**

Create `lib/linda/review.ts`:

```ts
import { createAdminClient } from '@/lib/supabase/admin';
import { evaluateEssayAtp } from './gemini';
import { decideLindaAction } from './decide';
import { getOpenLindaNudge, insertLindaNudge, resolveLindaNudge } from './queries';
import { LINDA_RESOLVE_MESSAGES } from './config';

interface EssayRow {
  id: string;
  title: string;
  content_text: string | null;
  published: boolean;
  book: { title: string | null; author: string | null } | null;
}

/**
 * Evaluate one essay for ATP and act on the result. Designed to run in the
 * background via next/server `after()`. Never throws — failures are logged
 * and swallowed so publishing/editing is never affected.
 *
 * trigger 'publish' → always evaluate (new essay).
 * trigger 'edit'    → only evaluate if Linda has an open nudge to resolve.
 */
export async function runLindaReview(
  essayId: string,
  trigger: 'publish' | 'edit',
): Promise<void> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('essays')
      .select('id, title, content_text, published, book:books!book_id(title, author)')
      .eq('id', essayId)
      .maybeSingle();
    if (error) throw error;

    const essay = data as EssayRow | null;
    if (!essay || !essay.published) return;

    const openNudge = await getOpenLindaNudge(supabase, essayId);
    if (trigger === 'edit' && !openNudge) return; // clean essays are never re-pestered

    const verdict = await evaluateEssayAtp({
      title: essay.title,
      contentText: essay.content_text ?? '',
      bookTitle: essay.book?.title ?? null,
      bookAuthor: essay.book?.author ?? null,
    });

    const action = decideLindaAction(verdict, !!openNudge);

    if (action.kind === 'insert') {
      await insertLindaNudge(supabase, essayId, action.body);
    } else if (action.kind === 'resolve' && openNudge) {
      const msg = LINDA_RESOLVE_MESSAGES[Math.floor(Math.random() * LINDA_RESOLVE_MESSAGES.length)];
      await resolveLindaNudge(supabase, openNudge.id, msg);
    }
  } catch (err) {
    console.error('runLindaReview failed for essay', essayId, err);
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no type errors. (The `as EssayRow` cast handles Supabase typing the `book` join as an array; the runtime value for a to-one relationship is a single object or null, matching existing code patterns in `lib/essays/queries.ts`.)

- [ ] **Step 3: Commit**

```bash
git add lib/linda/review.ts
git commit -m "feat: Linda review orchestrator"
```

---

## Task 10: Wire Linda into essay publish

**Files:**
- Modify: `app/api/essays/route.ts`

- [ ] **Step 1: Add imports**

At the top of `app/api/essays/route.ts`, update the `next/server` import and add the review import:

```ts
import { NextRequest, NextResponse, after } from 'next/server';
```
and below the other `@/lib` imports:
```ts
import { runLindaReview } from '@/lib/linda/review';
```

- [ ] **Step 2: Fire the review after a successful insert**

In the `POST` handler, immediately after the line that normalizes the inserted essay and before the `return`, schedule the background review. The relevant block becomes:

```ts
    if (error) throw error;
    const { essay_comments, ...rest } = data as typeof data & { essay_comments?: { count: number }[] };
    const normalized = { ...rest, comment_count: Number(essay_comments?.[0]?.count ?? 0) };

    after(() => runLindaReview(data.id, 'publish'));

    return NextResponse.json({ data: normalized }, { status: 201 });
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add "app/api/essays/route.ts"
git commit -m "feat: run Linda ATP review after essay publish"
```

---

## Task 11: Wire Linda into essay edit

**Files:**
- Modify: `app/api/essays/[id]/route.ts`

- [ ] **Step 1: Add imports**

At the top of `app/api/essays/[id]/route.ts`, update the `next/server` import and add the review import:

```ts
import { NextRequest, NextResponse, after } from 'next/server';
```
and below the other `@/lib` imports:
```ts
import { runLindaReview } from '@/lib/linda/review';
```

- [ ] **Step 2: Fire a re-review when content changed**

In the `PATCH` handler, after the `if (!data) ...` not-found guard and before the success `return`, schedule a re-review only when the essay body actually changed. The block becomes:

```ts
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Esej nenalezena nebo nemáš oprávnění' }, { status: 404 });

    if (body.content_json !== undefined || body.content_text !== undefined) {
      after(() => runLindaReview(id, 'edit'));
    }

    return NextResponse.json({ data });
```

(`runLindaReview(id, 'edit')` itself returns early unless Linda has an open nudge, so a title-only edit that slips through is still cheap — but gating on content here avoids even that.)

- [ ] **Step 3: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add "app/api/essays/[id]/route.ts"
git commit -m "feat: re-run Linda ATP review on essay content edit"
```

---

## Task 12: Essay types + coach-queue annotation

**Files:**
- Modify: `lib/essays/types.ts`
- Modify: `lib/essays/queries.ts`

- [ ] **Step 1: Extend the comment and coach-review types**

In `lib/essays/types.ts`, add the two nudge fields to `EssayComment`:

```ts
export interface EssayComment {
  id: string;
  essay_id: string;
  author_profile_id: string;
  body: string;
  is_linda_nudge: boolean;
  nudge_status: 'open' | 'resolved' | null;
  created_at: string;
  updated_at: string;
}
```

and add the signal flag to `CoachReviewEssay`:

```ts
/** Essay shown in the coach review inbox; `read_at` is set on the "read" tab. */
export interface CoachReviewEssay extends EssayWithDetails {
  read_at: string | null;
  has_open_linda_nudge: boolean;
}
```

- [ ] **Step 2: Add the open-nudge lookup query**

In `lib/essays/queries.ts`, add this exported helper (place it near `getEssayComments`):

```ts
/** Of the given essay ids, which currently have an open Linda nudge. */
export async function getEssayIdsWithOpenLindaNudge(
  supabase: SupabaseClient,
  essayIds: string[],
): Promise<Set<string>> {
  if (essayIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('essay_comments')
    .select('essay_id')
    .eq('is_linda_nudge', true)
    .eq('nudge_status', 'open')
    .in('essay_id', essayIds);
  if (error) throw error;
  return new Set((data ?? []).map((r: { essay_id: string }) => r.essay_id));
}
```

- [ ] **Step 3: Annotate the unread coach queue**

In `lib/essays/queries.ts`, in `getUnreadTeamEssaysForCoach`, replace the final `return mapEssayCommentCount(...)...` expression with:

```ts
  const mapped = mapEssayCommentCount(
    data as (EssayWithDetails & { essay_comments?: { count: number }[] })[],
  );
  const nudgeIds = await getEssayIdsWithOpenLindaNudge(supabase, mapped.map((e) => e.id));
  return mapped.map((essay) => ({
    ...essay,
    read_at: null,
    has_open_linda_nudge: nudgeIds.has(essay.id),
  }));
```

- [ ] **Step 4: Annotate the read coach queue**

In `lib/essays/queries.ts`, in `getReadTeamEssaysForCoach`, replace the final `return mapEssayCommentCount(...).map(...).sort(...)` expression with:

```ts
  const mapped = mapEssayCommentCount(
    data as (EssayWithDetails & { essay_comments?: { count: number }[] })[],
  );
  const nudgeIds = await getEssayIdsWithOpenLindaNudge(supabase, mapped.map((e) => e.id));
  return mapped
    .map((essay) => ({
      ...essay,
      read_at: readAtById.get(essay.id) ?? null,
      has_open_linda_nudge: nudgeIds.has(essay.id),
    }))
    .sort((a, b) => (b.read_at ?? '').localeCompare(a.read_at ?? ''));
```

- [ ] **Step 5: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no type errors. In particular, `CoachReviewEssay` now requires `has_open_linda_nudge`, so both coach-queue functions must set it (they do, above).

- [ ] **Step 6: Commit**

```bash
git add lib/essays/types.ts lib/essays/queries.ts
git commit -m "feat: surface open Linda nudge flag on coach review essays"
```

---

## Task 13: Coach indicator UI

**Files:**
- Modify: `components/essays/coach-review-list.tsx`

- [ ] **Step 1: Add the icon import**

In `components/essays/coach-review-list.tsx`, add `CircleAlert` to the existing `lucide-react` import:

```ts
import { BookOpen, CircleAlert, FileQuestion, Inbox, MessageCircle } from 'lucide-react';
```

- [ ] **Step 2: Render the "Chybí ATP" badge in the review row**

In the `ReviewRow` component, inside the meta row (the `div` that holds the book/comment info, right after the `{essay.comment_count > 0 && (...)}` block and still inside that `div`), add:

```tsx
            {essay.has_open_linda_nudge && (
              <Badge variant="outline" className="ml-auto gap-1 border-amber-300 text-amber-600">
                <CircleAlert className="size-3" />
                Chybí ATP
              </Badge>
            )}
```

(`Badge` is already imported in this file.)

- [ ] **Step 3: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: no new lint errors in changed files.

- [ ] **Step 5: Commit**

```bash
git add "components/essays/coach-review-list.tsx"
git commit -m "feat: 'Chybí ATP' badge for essays with an open Linda nudge"
```

---

## Task 14: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full type check, lint, and unit tests**

Run:
```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
```
Expected: type check clean, lint clean, 16 unit tests pass.

- [ ] **Step 2: Start the app with a real GEMINI_API_KEY**

Confirm `.env.local` has `GEMINI_API_KEY` set, then run: `pnpm dev`
Expected: app boots, local Supabase running with the new migration applied.

- [ ] **Step 3: Publish a summary-only essay (no ATP)**

As a student, create an essay at `/eseje/nova` that only summarizes a book's content with no personal application. Publish, open the essay detail page, wait a few seconds, and refresh.
Expected: a comment from "Linda" appears — a friendly Czech open question referencing the essay's idea, no swear words, ≤1 emoji, no AI label/badge on her.

- [ ] **Step 4: Edit the essay to add ATP**

Edit the same essay, adding a paragraph reflecting how you'd apply the idea in real life. Save, reopen the detail page, refresh.
Expected: Linda's original comment is now a short celebratory message and is no longer counted as an open nudge.

- [ ] **Step 5: Publish an essay that already has ATP**

Create and publish an essay with clear personal application. Wait and refresh.
Expected: no Linda comment at all.

- [ ] **Step 6: Verify the coach signal**

As a coach in the same team, open `/eseje/ke-kontrole`.
Expected: the essay with an open Linda nudge shows the amber "Chybí ATP" badge; the resolved one and the ATP-present one do not.

- [ ] **Step 7: Verify failure is silent**

Temporarily set an invalid `GEMINI_API_KEY`, restart, and publish a no-ATP essay.
Expected: publishing succeeds normally; no Linda comment; an error is logged to the server console via `runLindaReview failed for essay ...`. Restore the valid key afterward.

- [ ] **Step 8: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "fix: Linda ATP nudge verification adjustments"
```
(Skip if no changes were required.)

---

## Self-review notes

- **Spec coverage:** identity/open-secret persona (Task 2 seed, Task 13 no-label badge) ✓; publish trigger via `after()` (Task 10) ✓; edit re-check only when open nudge exists (Task 9 guard + Task 11) ✓; one open nudge max (Task 6 decide) ✓; essay-specific Czech nudge (Task 4 prompt) ✓; medium Gen-Z tone, no swearing (Task 3 persona) ✓; resolve + celebrate (Task 6 + Task 9) ✓; no length guard (no filter anywhere) ✓; onward-only / no backfill (only publish/edit triggers, no migration backfill) ✓; coach signal on `ke-kontrole` (Tasks 12–13) ✓; editable config (Task 3) ✓; fail silent (Task 9 try/catch) ✓; Gemini Flash configurable (Task 3 `LINDA_MODEL`) ✓.
- **Type consistency:** `LindaVerdict` / `LindaAction` defined in Task 3 and used identically in Tasks 5/6/7/9; `getEssayIdsWithOpenLindaNudge` signature matches its callers; `CoachReviewEssay.has_open_linda_nudge` set in both queue functions and read in the UI.
- **Placeholder scan:** no TBD/TODO; every code step contains full code.
