# Add-Book Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `AddBookWizard` with a four-step page — rubric gate, catalogue+Google Books search, Perplexity enrichment, confirm-and-submit checkout — reachable from both book searches, so a missing book becomes a complete, coach-reviewable record instead of a dead end.

**Architecture:** A client-side step machine at `/cteni/knihy/nova` backed by two new API routes. `POST /api/books/enrich` calls Perplexity server-side and returns a schema-validated record; `POST /api/books` (extended) persists it as `processing` and emails the submitter's coach. Enrichment is never load-bearing — every failure path lands in the same manual checkout. Read the spec first: `docs/superpowers/specs/2026-08-10-add-book-flow-design.md`.

**Tech Stack:** Next.js App Router (Server Components by default), TypeScript strict, supabase-js, Resend, `@perplexity-ai/perplexity_ai@0.38.1`, Vitest (unit + component projects), Playwright (e2e), Tailwind + shadcn/ui.

## Global Constraints

- **No schema changes.** No migration, no new tables, no new columns, no new enum values. `db/schema/*.ts` is not touched and `pnpm db:migrate` is never run. Every field lands in a column that already exists.
- **TypeScript strict.** No `any`. `interface` over `type` except derived DB types, which must be `type`. Prefer `??` over `||`.
- **Naming:** PascalCase components/types, camelCase vars/functions, UPPER_SNAKE_CASE constants, kebab-case filenames.
- **Imports:** external → `@/` internal → styles, one blank line between groups.
- **Server Components by default.** `"use client"` only for interactivity, browser APIs, or third-party init.
- **No magic values.** Extract to named constants or `as const` objects.
- **Data access via supabase-js only.** Never add a runtime Drizzle client.
- **Never commit `.env.local` or secrets.** `PERPLEXITY_API_KEY` is read server-side only and must never reach a client component.
- **The AI's tag must be one of the eight existing `BOOK_CATEGORIES`.** The `tags` table insert policy requires `is_coach_or_admin()`, so a student submitting a book with an unknown tag name would hit an RLS failure inside `resolveTagIds`. Validation rejects anything outside the enum.
- **UI copy is Czech.** Match the tone of the existing pages.
- Run `pnpm test` and `pnpm typecheck` before every commit. Both must pass.

---

## File Structure

**Created**

| Path | Responsibility |
| --- | --- |
| `src/lib/books/dedupe.ts` | Title normalisation and candidate↔book matching. |
| `src/lib/books/dedupe.test.ts` | Unit tests for the above. |
| `src/lib/books/enrichment/rubric.ts` | Glossary, scoring rubric, both overrides, voice spec, system-prompt builder. Constants only, no I/O. |
| `src/lib/books/enrichment/rubric.test.ts` | Asserts the prompt carries the overrides and all eight tags. |
| `src/lib/books/enrichment/schema.ts` | The Perplexity JSON schema, the derived TS type, and `parseEnrichment`. |
| `src/lib/books/enrichment/schema.test.ts` | Validation tests. |
| `src/lib/books/enrichment/enrich.ts` | The Perplexity call plus the in-process circuit breaker. |
| `src/lib/books/enrichment/enrich.test.ts` | Tests with the SDK mocked. |
| `src/app/api/books/enrich/route.ts` | Auth, per-profile in-process guard, delegation. |
| `src/lib/notifications/book-notifications.ts` | `notifyBookSubmitted`, `notifyBookDecided`. |
| `src/lib/notifications/book-notifications.test.ts` | Recipient-selection and gating tests. |
| `src/components/books/book-not-found-card.tsx` | Shared entry point for both searches. |
| `src/components/books/book-not-found-card.test.tsx` | Renders and links correctly. |
| `src/components/books/add-book/add-book-flow.tsx` | The step machine + `sessionStorage` draft. |
| `src/components/books/add-book/step-gate.tsx` | Krok 1. |
| `src/components/books/add-book/step-search.tsx` | Krok 2. |
| `src/components/books/add-book/step-enriching.tsx` | Krok 3. |
| `src/components/books/add-book/step-review.tsx` | Krok 4. |
| `src/components/books/add-book/types.ts` | Shared draft type for the four steps. |
| `src/components/books/add-book/*.test.tsx` | One test file per step. |
| `src/lib/books/external/google-books.test.ts` | Mapper tests. |
| `tests/integration/add-book.int.test.ts` | RLS + points-eligibility. |
| `tests/e2e/add-book.spec.ts` | Full flow. |

**Modified**

| Path | Change |
| --- | --- |
| `src/lib/books/types.ts` | Extend `ExternalBookCandidate`; add `CreateBookInput` fields. |
| `src/lib/books/external/google-books.ts` | Map page count, publisher, year, preview link. |
| `src/lib/books/external/open-library.ts` | Same fields, nulls where unavailable. |
| `src/app/api/books/route.ts` | Extended duplicate check; persist new fields; notify coach. |
| `src/app/api/books/[id]/route.ts` | Notify submitter from the `classify` branch. |
| `src/lib/notifications/email-templates.ts` | Two new templates. |
| `src/components/search/search-page-client.tsx` | Mount `BookNotFoundCard`. |
| `src/components/essays/essay-editor-form.tsx` | Mount `BookNotFoundCard`; accept `?book=` preselect. |
| `src/app/(main)/cteni/knihy/nova/page.tsx` | Rewritten as the flow shell. |
| `.env.example` | Document the two new vars. |

**Deleted**

- `src/components/books/add-book-wizard.tsx`

---

## Task 1: External candidate metadata

`page_count` is load-bearing — the rubric's extent correction depends on it — and neither mapper parses it today.

**Files:**
- Modify: `src/lib/books/types.ts:64-72`
- Modify: `src/lib/books/external/google-books.ts`
- Modify: `src/lib/books/external/open-library.ts`
- Test: `src/lib/books/external/google-books.test.ts`

**Interfaces:**
- Produces: `ExternalBookCandidate` with four added nullable fields — `page_count: number | null`, `publisher: string | null`, `published_year: number | null`, `preview_link: string | null`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/books/external/google-books.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';

import { searchGoogleBooks } from './google-books';

function mockFetchOnce(body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('searchGoogleBooks', () => {
  it('maps page count, publisher, year and preview link', async () => {
    mockFetchOnce({
      items: [{
        id: 'vol-1',
        volumeInfo: {
          title: 'Sprint',
          authors: ['Jake Knapp'],
          publisher: 'Simon & Schuster',
          publishedDate: '2016-03-08',
          pageCount: 288,
          previewLink: 'https://books.google.com/preview',
          industryIdentifiers: [{ type: 'ISBN_13', identifier: '9781501121746' }],
          imageLinks: { thumbnail: 'http://example.com/c.jpg' },
        },
      }],
    });

    const [candidate] = await searchGoogleBooks('sprint');

    expect(candidate.page_count).toBe(288);
    expect(candidate.publisher).toBe('Simon & Schuster');
    expect(candidate.published_year).toBe(2016);
    expect(candidate.preview_link).toBe('https://books.google.com/preview');
    expect(candidate.cover_url).toBe('https://example.com/c.jpg');
  });

  it('returns nulls for the new fields when the volume omits them', async () => {
    mockFetchOnce({ items: [{ id: 'vol-2', volumeInfo: { title: 'Bez detailů' } }] });

    const [candidate] = await searchGoogleBooks('bez');

    expect(candidate.page_count).toBeNull();
    expect(candidate.publisher).toBeNull();
    expect(candidate.published_year).toBeNull();
    expect(candidate.preview_link).toBeNull();
    expect(candidate.author).toBe('Neznámý autor');
  });

  it('parses a year-only publishedDate', async () => {
    mockFetchOnce({
      items: [{ id: 'vol-3', volumeInfo: { title: 'Jen rok', publishedDate: '1999' } }],
    });

    const [candidate] = await searchGoogleBooks('rok');

    expect(candidate.published_year).toBe(1999);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- google-books`
Expected: FAIL — `page_count` does not exist on the candidate type, so this fails typecheck and assertion.

- [ ] **Step 3: Extend the shared type**

In `src/lib/books/types.ts`, replace the `ExternalBookCandidate` interface:

```typescript
export interface ExternalBookCandidate {
  title: string;
  author: string;
  isbn_13: string | null;
  description: string | null;
  cover_url: string | null;
  /** Load-bearing for the scoring rubric's extent correction. */
  page_count: number | null;
  /** Krok 2 display only — not persisted. */
  publisher: string | null;
  /** Krok 2 display only — not persisted. */
  published_year: number | null;
  preview_link: string | null;
  source: BookSource;
  external_id: string;
}
```

- [ ] **Step 4: Map the fields in the Google Books normaliser**

In `src/lib/books/external/google-books.ts`, extend the `volumeInfo` interface and `normalizeVolume`:

```typescript
interface GoogleBooksVolume {
  id: string;
  volumeInfo: {
    title?: string;
    authors?: string[];
    description?: string;
    publisher?: string;
    publishedDate?: string;
    pageCount?: number;
    previewLink?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
}

/** Google Books returns `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. */
function parseYear(publishedDate: string | undefined): number | null {
  if (!publishedDate) return null;
  const year = Number.parseInt(publishedDate.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function normalizeVolume(volume: GoogleBooksVolume): ExternalBookCandidate | null {
  const info = volume.volumeInfo;
  if (!info.title) return null;

  const isbn13 = info.industryIdentifiers?.find((id) => id.type === 'ISBN_13')?.identifier ?? null;
  const author = info.authors?.join(', ') ?? 'Neznámý autor';
  const coverUrl = info.imageLinks?.thumbnail?.replace('http://', 'https://') ?? null;

  return {
    title: info.title,
    author,
    isbn_13: isbn13,
    description: info.description ?? null,
    cover_url: coverUrl,
    page_count: info.pageCount ?? null,
    publisher: info.publisher ?? null,
    published_year: parseYear(info.publishedDate),
    preview_link: info.previewLink ?? null,
    source: 'google_books',
    external_id: volume.id,
  };
}
```

- [ ] **Step 5: Add the same fields to the Open Library normaliser**

Open Library's search endpoint exposes `number_of_pages_median`, `publisher` and `first_publish_year`. In `src/lib/books/external/open-library.ts`, extend `OpenLibraryDoc`, the `fields` query params in **both** functions, and `normalizeDoc`:

```typescript
interface OpenLibraryDoc {
  key: string;
  title?: string;
  author_name?: string[];
  isbn?: string[];
  first_sentence?: { value: string } | string;
  cover_i?: number;
  number_of_pages_median?: number;
  publisher?: string[];
  first_publish_year?: number;
}

const FIELDS = 'key,title,author_name,isbn,cover_i,first_sentence,number_of_pages_median,publisher,first_publish_year';
```

Inside `normalizeDoc`, add to the returned object:

```typescript
    page_count: doc.number_of_pages_median ?? null,
    publisher: doc.publisher?.[0] ?? null,
    published_year: doc.first_publish_year ?? null,
    preview_link: `https://openlibrary.org${doc.key}`,
```

Replace the two hardcoded `fields:` values in `searchOpenLibrary` and `fetchOpenLibraryByIsbn` with `fields: FIELDS`.

- [ ] **Step 6: Allowlist the Open Library cover host**

Covers are stored as remote URLs, never downloaded, and `next/image` refuses a host that is not
in `remotePatterns`. `books.google.com` is already listed; `covers.openlibrary.org` is not, so an
Open Library cover would fail to render. Add it to `next.config.ts`:

```typescript
      {
        protocol: 'https',
        hostname: 'covers.openlibrary.org',
      },
```

- [ ] **Step 7: Run tests and typecheck**

Run: `pnpm test:unit -- google-books && pnpm typecheck`
Expected: PASS. Typecheck confirms no other call site relied on the old shape.

- [ ] **Step 8: Commit**

```bash
git add src/lib/books/types.ts src/lib/books/external/ next.config.ts
git commit -m "feat(books): map page count, publisher, year and preview link from external sources"
```

---

## Task 2: Dedupe key and extended duplicate check

Today's check compares `isbn_13` or `title_cs` + `author`, so a Czech record and its English twin never collide. That is the duplicate bug.

**Files:**
- Create: `src/lib/books/dedupe.ts`
- Test: `src/lib/books/dedupe.test.ts`
- Modify: `src/app/api/books/route.ts:58-72`

**Interfaces:**
- Consumes: `ExternalBookCandidate` from Task 1.
- Produces:
  - `normalizeTitleKey(value: string): string`
  - `MatchableBook` — `{ id: string; title_cs: string; title_en: string | null; author: string; isbn_13: string | null }`
  - `findDuplicate(candidate: DuplicateProbe, books: MatchableBook[]): MatchableBook | null`
  - `DuplicateProbe` — `{ title_cs: string; title_en?: string | null; author: string; isbn_13?: string | null }`

- [ ] **Step 1: Write the failing test**

Create `src/lib/books/dedupe.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { findDuplicate, normalizeTitleKey, type MatchableBook } from './dedupe';

const SPRINT_CS: MatchableBook = {
  id: 'book-cs',
  title_cs: 'Sprint: Jak vyřešit velké problémy',
  title_en: 'Sprint',
  author: 'Jake Knapp',
  isbn_13: '9788075550699',
};

describe('normalizeTitleKey', () => {
  it('lowercases, strips diacritics, punctuation and collapses whitespace', () => {
    expect(normalizeTitleKey('Pátá   disciplína!')).toBe('pata disciplina');
    expect(normalizeTitleKey('Radikální otevřenost')).toBe('radikalni otevrenost');
  });

  it('is stable across punctuation-only differences', () => {
    expect(normalizeTitleKey('Sprint: Jak na to')).toBe(normalizeTitleKey('Sprint - jak na to'));
  });
});

describe('findDuplicate', () => {
  it('matches on ISBN-13 when both sides have one', () => {
    const hit = findDuplicate(
      { title_cs: 'Úplně jiný název', author: 'Někdo Jiný', isbn_13: '9788075550699' },
      [SPRINT_CS],
    );
    expect(hit?.id).toBe('book-cs');
  });

  it('matches an English candidate against a Czech record via title_en', () => {
    const hit = findDuplicate({ title_cs: 'Sprint', author: 'Jake Knapp' }, [SPRINT_CS]);
    expect(hit?.id).toBe('book-cs');
  });

  it('matches a Czech candidate against an English-only record', () => {
    const englishOnly: MatchableBook = {
      id: 'book-en',
      title_cs: 'Sprint',
      title_en: null,
      author: 'Jake Knapp',
      isbn_13: null,
    };
    const hit = findDuplicate(
      { title_cs: 'Jiné vydání', title_en: 'Sprint', author: 'Jake Knapp' },
      [englishOnly],
    );
    expect(hit?.id).toBe('book-en');
  });

  it('does not match when the author differs', () => {
    expect(findDuplicate({ title_cs: 'Sprint', author: 'Jiný Autor' }, [SPRINT_CS])).toBeNull();
  });

  it('matches a multi-author string, which is how Google Books reports co-authors', () => {
    const coAuthored: MatchableBook = {
      id: 'book-multi',
      title_cs: 'Sprint',
      title_en: null,
      author: 'Jake Knapp, John Zeratsky, Braden Kowitz',
      isbn_13: null,
    };
    const hit = findDuplicate(
      { title_cs: 'Sprint', author: 'Jake Knapp, John Zeratsky, Braden Kowitz' },
      [coAuthored],
    );
    expect(hit?.id).toBe('book-multi');
  });

  it('ignores a null ISBN on either side rather than treating it as equal', () => {
    const noIsbn: MatchableBook = { ...SPRINT_CS, id: 'x', isbn_13: null, title_en: null, title_cs: 'Něco' };
    expect(findDuplicate({ title_cs: 'Jiné', author: 'Jake Knapp' }, [noIsbn])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- dedupe`
Expected: FAIL — `Cannot find module './dedupe'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/books/dedupe.ts`:

```typescript
/**
 * Application-level duplicate detection. There is deliberately no UNIQUE
 * constraint on `isbn_13` — an ISBN identifies an edition, not a work — so the
 * check lives here and in `POST /api/books`.
 */

export interface MatchableBook {
  id: string;
  title_cs: string;
  title_en: string | null;
  author: string;
  isbn_13: string | null;
}

export interface DuplicateProbe {
  title_cs: string;
  title_en?: string | null;
  author: string;
  isbn_13?: string | null;
}

const DIACRITIC_RANGE = /[̀-ͯ]/g;
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]+/gu;

/** Lowercases, strips diacritics and punctuation, collapses whitespace. */
export function normalizeTitleKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(DIACRITIC_RANGE, '')
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, ' ')
    .trim();
}

function titleKeys(titleCs: string, titleEn: string | null | undefined): Set<string> {
  const keys = new Set<string>([normalizeTitleKey(titleCs)]);
  if (titleEn) keys.add(normalizeTitleKey(titleEn));
  keys.delete('');
  return keys;
}

/**
 * Returns the first book the probe duplicates: same ISBN-13 when both sides
 * have one, otherwise same author and an overlapping title in either language.
 */
export function findDuplicate(
  probe: DuplicateProbe,
  books: MatchableBook[],
): MatchableBook | null {
  const probeAuthor = normalizeTitleKey(probe.author);
  const probeTitles = titleKeys(probe.title_cs, probe.title_en);

  for (const book of books) {
    if (probe.isbn_13 && book.isbn_13 && probe.isbn_13 === book.isbn_13) {
      return book;
    }

    if (normalizeTitleKey(book.author) !== probeAuthor) continue;

    for (const key of titleKeys(book.title_cs, book.title_en)) {
      if (probeTitles.has(key)) return book;
    }
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:unit -- dedupe`
Expected: PASS (7 assertions across 7 tests).

- [ ] **Step 5: Use it in the create route**

In `src/app/api/books/route.ts`, replace the `.or(...)` duplicate query (currently lines 58–72) with two parameter-safe candidate fetches plus `findDuplicate`. The old `.or()` string interpolated user input into a PostgREST filter, which this removes — see the comment in the code below for why an `or` string cannot be used here at all.

```typescript
    // Duplicate check: same ISBN-13, or same author with an overlapping title in
    // either language, so a Czech record and its English twin collide.
    //
    // Two separate queries rather than one `.or(...)` string. A PostgREST `or`
    // filter is comma-delimited, and `ExternalBookCandidate.author` is built by
    // joining multiple authors with ", " — so interpolating an author into an
    // `or` string breaks the query outright for every multi-author book, and
    // lets a crafted value inject extra clauses. Values passed to `.ilike()` /
    // `.eq()` are encoded as single filter params, where a comma is just data.
    const candidateColumns = 'id, title_cs, title_en, author, isbn_13';

    const [byAuthor, byIsbn] = await Promise.all([
      supabase
        .from('books')
        .select(candidateColumns)
        .ilike('author', body.author.trim())
        .limit(DUPLICATE_CANDIDATE_LIMIT),
      body.isbn_13
        ? supabase.from('books').select(candidateColumns).eq('isbn_13', body.isbn_13).limit(1)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (byAuthor.error) throw byAuthor.error;
    if (byIsbn.error) throw byIsbn.error;

    const candidatesById = new Map(
      [...(byAuthor.data ?? []), ...(byIsbn.data ?? [])].map((book) => [book.id, book]),
    );

    const existing = findDuplicate(
      {
        title_cs: body.title.trim(),
        title_en: body.title_en ?? null,
        author: body.author.trim(),
        isbn_13: body.isbn_13 ?? null,
      },
      [...candidatesById.values()],
    );

    if (existing) {
      return NextResponse.json(
        { error: 'Tato kniha již existuje v katalogu', existingId: existing.id },
        { status: 409 },
      );
    }
```

Add the import at the top of the file, and the constant near the other module-level constants:

```typescript
import { findDuplicate } from '@/lib/books/dedupe';
```

```typescript
/** Books by the same author to consider when looking for a duplicate. */
const DUPLICATE_CANDIDATE_LIMIT = 50;
```

- [ ] **Step 6: Verify**

Run: `pnpm test && pnpm typecheck`
Expected: PASS. `body.title_en` will typecheck only after Task 3's `CreateBookInput` change — if it errors here, add `title_en?: string | null;` to `CreateBookInput` in `src/lib/books/types.ts` now and keep the rest of that task's fields for later.

- [ ] **Step 7: Commit**

```bash
git add src/lib/books/dedupe.ts src/lib/books/dedupe.test.ts src/app/api/books/route.ts src/lib/books/types.ts
git commit -m "fix(books): catch cross-language duplicates by matching title_en too"
```

---

## Task 3: Persist the enriched fields

`POST /api/books` currently drops `title_en`, `page_count`, `preview_link`, `book_points` and the points rationale on the floor.

**Files:**
- Modify: `src/lib/books/types.ts` (`CreateBookInput`)
- Modify: `src/app/api/books/route.ts` (POST insert)

**Interfaces:**
- Produces: `CreateBookInput` extended with `title_en?: string | null`, `page_count?: number | null`, `preview_link?: string | null`, `book_points?: 1 | 2 | 3 | null`, `points_reason?: string | null`.

- [ ] **Step 1: Extend the input type**

In `src/lib/books/types.ts`:

```typescript
export interface CreateBookInput {
  title: string;
  author: string;
  /** English/original title. Populated so cross-language duplicates collide. */
  title_en?: string | null;
  isbn_13?: string;
  description?: string;
  page_count?: number | null;
  preview_link?: string | null;
  /**
   * The cover's remote URL, stored as-is — we do not download covers.
   * `StorageImage` passes external URLs straight through via `isExternalUrl`,
   * and the POST route's existing `body.google_books_cover_url ?? null` branch
   * already skips `downloadAndStoreCover` when this is set.
   */
  google_books_cover_url?: string | null;
  /** AI suggestion or the submitter's own pick. A coach overrides it on review. */
  book_points?: 1 | 2 | 3 | null;
  /** Scoring rationale. Stored in `list_status_reason` — see the design doc. */
  points_reason?: string | null;
  tags?: string[];
  source: BookSource;
  external_id?: string;
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/integration/add-book.int.test.ts` with the first case. This layer is the only one that can prove a `processing` book with points awards nothing.

```typescript
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
  await client.query(
    `insert into public.profiles (name, work_email, user_id, role)
     values ('Téčko', 'tecko@studenti.czu.cz', $1, 'student')`,
    [userRows[0].id],
  );
  const { rows } = await client.query(
    'select id from public.profiles where user_id = $1',
    [userRows[0].id],
  );
  return { authId: auth.id, profileId: rows[0].id as string };
}

describe('adding a book', () => {
  it('stores title_en, page_count and preview_link', async () => {
    await withRollback(async (client) => {
      const student = await seedStudent(client);
      await asClaims(client, { sub: student.authId });

      const { rows } = await client.query(
        `insert into public.books
           (title_cs, title_en, author, page_count, preview_link,
            created_by_profile_id, updated_by_profile_id)
         values ('Sprint', 'Sprint', 'Jake Knapp', 288, 'https://books.google.com/x', $1, $1)
         returning title_en, page_count, preview_link, list_status`,
        [student.profileId],
      );

      expect(rows[0].title_en).toBe('Sprint');
      expect(rows[0].page_count).toBe(288);
      expect(rows[0].preview_link).toBe('https://books.google.com/x');
      expect(rows[0].list_status).toBe('processing');
    });
  });

  it('awards no points while the book is still processing', async () => {
    await withRollback(async (client) => {
      const student = await seedStudent(client);
      await asClaims(client, { sub: student.authId });

      await client.query(
        `insert into public.books
           (title_cs, author, book_points, list_status,
            created_by_profile_id, updated_by_profile_id)
         values ('Nová kniha', 'Autor', 3, 'processing', $1, $1)`,
        [student.profileId],
      );

      const { rows } = await client.query(
        `select coalesce(sum(book_points), 0)::int as total
         from public.books
         where created_by_profile_id = $1
           and list_status in ('shortlist', 'longlist')`,
        [student.profileId],
      );

      expect(rows[0].total).toBe(0);
    });
  });

  it('refuses a book created on behalf of another profile', async () => {
    await withRollback(async (client) => {
      const student = await seedStudent(client);
      const other = await seedStudent(client);
      await asClaims(client, { sub: student.authId });

      await expect(
        client.query(
          `insert into public.books (title_cs, author, created_by_profile_id, updated_by_profile_id)
           values ('Cizí kniha', 'Autor', $1, $1)`,
          [other.profileId],
        ),
      ).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm test:integration -- add-book`
Expected: FAIL on the first case — `column "title_en" of relation "books" does not exist` is **not** what you should see; the column exists. If instead the whole file fails with `Migration failed: <file>`, add the missing Supabase-managed object to `tests/setup/bootstrap.sql` and never edit `supabase/migrations/`. Otherwise expect the third case to fail if the RLS policy is missing.

- [ ] **Step 4: Persist the fields in the route**

In `src/app/api/books/route.ts`, replace the insert object:

```typescript
    const { data: inserted, error: insertError } = await supabase
      .from('books')
      .insert({
        title_cs: body.title.trim(),
        title_en: body.title_en?.trim() ?? null,
        author: body.author.trim(),
        isbn_13: body.isbn_13 ?? null,
        description: body.description ?? null,
        page_count: body.page_count ?? null,
        preview_link: body.preview_link ?? null,
        book_points: body.book_points ?? null,
        // The scoring rationale lives here: the review UI already surfaces
        // `list_status_reason` as DŮVOD ZAŘAZENÍ, and `classify` replaces it
        // with the coach's own reason on approval.
        list_status_reason: body.points_reason?.trim() ?? null,
        source: body.source ?? 'manual',
        external_id: body.external_id ?? null,
        created_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
      })
      .select()
      .single();
```

- [ ] **Step 5: Verify**

Run: `pnpm test:integration -- add-book && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/books/types.ts src/app/api/books/route.ts tests/integration/add-book.int.test.ts
git commit -m "feat(books): persist title_en, page count, preview link and the scoring rationale"
```

---

## Task 4: Rubric constants and system prompt

**Files:**
- Create: `src/lib/books/enrichment/rubric.ts`
- Test: `src/lib/books/enrichment/rubric.test.ts`

**Interfaces:**
- Produces:
  - `BOOK_POINT_CATEGORIES` — `readonly` array of `{ points: 1 | 2 | 3; name: string; description: string; examples: string }`, exported for reuse by Krok 1 and the manual points picker.
  - `buildSystemPrompt(): string`

- [ ] **Step 1: Write the failing test**

Create `src/lib/books/enrichment/rubric.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { BOOK_CATEGORIES } from '@/lib/books/types';

import { BOOK_POINT_CATEGORIES, buildSystemPrompt } from './rubric';

describe('BOOK_POINT_CATEGORIES', () => {
  it('describes exactly the three scoring categories, one per point value', () => {
    expect(BOOK_POINT_CATEGORIES.map((c) => c.points)).toEqual([1, 2, 3]);
    for (const category of BOOK_POINT_CATEGORIES) {
      expect(category.name.length).toBeGreaterThan(0);
      expect(category.description.length).toBeGreaterThan(0);
      expect(category.examples.length).toBeGreaterThan(0);
    }
  });
});

describe('buildSystemPrompt', () => {
  const prompt = buildSystemPrompt();

  it('lists every thematic tag verbatim so the model cannot invent one', () => {
    for (const tag of BOOK_CATEGORIES) {
      expect(prompt).toContain(tag);
    }
  });

  it('carries the ego/manipulation override with its canonical example', () => {
    expect(prompt).toContain('48 zákonů moci');
    expect(prompt).toMatch(/nikdy.*kategorie 3/i);
  });

  it('carries the resilience override', () => {
    expect(prompt).toMatch(/stoicis/i);
    expect(prompt).toMatch(/odolnost/i);
  });

  it('explains the extent correction with both worked examples', () => {
    expect(prompt).toMatch(/50/);
    expect(prompt).toMatch(/800/);
  });

  it('defines the school slang the voice depends on', () => {
    expect(prompt).toContain('Téčko');
    expect(prompt).toContain('Book of Books');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- rubric`
Expected: FAIL — `Cannot find module './rubric'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/books/enrichment/rubric.ts`:

```typescript
import { BOOK_CATEGORIES } from '@/lib/books/types';

/**
 * The three scoring categories, from Petr's *Kategorie pro bodování knih*
 * (revised 2026-06-02). Shared by the Krok 1 gate, the manual points picker,
 * and the Perplexity system prompt, so the rubric is stated in exactly one place.
 */
export const BOOK_POINT_CATEGORIES = [
  {
    points: 1,
    name: 'Inspirace',
    description:
      'Populárně-naučné úvody, biografie úspěšných osobností, self-help literatura. Text se čte snadno, neobsahuje složitou odbornou terminologii ani jasné návody krok za krokem.',
    examples: 'Steven Bartlett – Deník CEO; Angela Duckworth – Houževnatost',
  },
  {
    points: 2,
    name: 'Praktická dovednost, proces a nástroj',
    description:
      'Procesní manuály, „how-to“ příručky a oborové učebnice pro rozvoj dovedností. Vysoká specifičnost: konkrétní frameworky, odrážkové seznamy kroků, případové studie s daty. Téčko by mělo být po přečtení schopné vzít z knihy model a vyřešit s ním reálný problém v byznysu.',
    examples: 'Jake Knapp – Sprint; Chris Voss – Nikdy nedělej kompromis; Kim Scott – Radikální otevřenost',
  },
  {
    points: 3,
    name: 'Komplexní změna paradigmatu a systémové myšlení',
    description:
      'Kognitivně a filozoficky nejnáročnější díla. Zabývají se systémovým myšlením. Transformují uvažování Téček i celého týmu z „já“ na „my“ a formují schopnost řešit komplexní situace. Slouží jako palivo pro dlouhé reflexe na čtyřhodinových týmových trénincích a dialozích.',
    examples: 'Peter Senge – Pátá disciplína; William Isaacs – Dialog; John C. Maxwell – 17 zákonů týmové spolupráce',
  },
] as const;

const GLOSSARY = `Slovník, který musíš znát:
- Téčko = student studijního programu TAP na Tiimi Akatemia. Píšeš pro něj.
- TAP = studijní program, ve kterém Téčka podnikají v týmech místo klasické výuky.
- BOB = Book of Books, databáze knih, do které tato kniha míří.
- ATP = Apply Theory to Practice; princip, že teorie z knihy se má okamžitě zkusit v praxi.`;

const EXTENT_CORRECTION = `Korekce rozsahem:
Kategorie určuje výchozí počet bodů, ale finální příděl koriguj fyzickým rozsahem a hustotou textu, aby nedocházelo k devalvaci bodů.
- Vynikající, ale jen 50stránkový návod na digitální reklamu spadá do Kategorie 2, a přesto dostane 1 bod.
- Kotlerův Marketing management, 800 stran nabitých frameworky, dostane 3 body.`;

const OVERRIDE_EGO = `Výjimka A (ego a manipulace):
Knihy zaměřené na prosazování individuálního ega, manipulaci a machiavelismus (kanonický příklad: 48 zákonů moci) NIKDY nezařazuj do Kategorie 3, ať jsou teoreticky jakkoli složité. Zařaď je do Kategorie 1 (osobní taktika) za 1 bod, protože nepodporují sdílenou vizi ani týmovou spolupráci.`;

const OVERRIDE_RESILIENCE = `Výjimka B (odolnost a disciplína):
Pokud kniha spadá do Kategorie 1, ale prokazatelně trénuje osobní disciplínu, hlubokou koncentraci a psychickou odolnost (například stoicismus nebo překonávání krizí), doporuč 2 body jako odměnu za budování klíčových kompetencí pro 21. století.`;

const VOICE = `Jak psát pole "description":
Píšeš česky, ve druhé osobě, pro Téčko. Struktura: nejdřív jednou nebo dvěma větami, co kniha je a co si z ní Téčko odnese konkrétně — co bude po přečtení umět, ne jaká témata kniha „pokrývá“. Pak upřímně to, co může Téčko od čtení odradit: příliš velký rozsah, hustý text, slabá opora v datech, příklady jen z USA, velký překryv s knihami, které v BOBovi už jsou. Pokud najdeš veřejné hodnocení (přednostně Goodreads, jinak databazeknih.cz), uveď ho na konci včetně zdroje.
Nepiš marketingový blurb z přebalu. Nepiš, že kniha je „must-read“. Nevymýšlej si.`;

const TAGS = `Tematické zařazení — pole "tag" musí být PŘESNĚ jedna z těchto hodnot, opsaná znak po znaku:
${BOOK_CATEGORIES.map((tag) => `- ${tag}`).join('\n')}`;

const RULES = `Další pravidla:
- title_cs je český název, title_en anglický (originální). Vyplň oba; pokud český překlad neexistuje, dej do title_cs anglický název.
- Pozor na podtitul: skutečný název knihy nemusí být to, co vyhledávač zobrazí jako první (kniha Tiimiakatemia se často uvádí pod svým podtitulem How to Grow into a Teampreneur).
- page_count potřebujeme pro korekci rozsahem. Když ho nenajdeš, vrať null a nastav confidence na "low".
- Když si nejsi jistý autorem, rozsahem nebo obsahem knihy, nastav confidence na "low". Nikdy si nevymýšlej fakta, abys pole zaplnil.`;

/** The full system prompt. Stable across every book — Perplexity has no prompt caching, so keep it tight. */
export function buildSystemPrompt(): string {
  const categories = BOOK_POINT_CATEGORIES.map(
    (c) => `Kategorie ${c.points} — ${c.name} (standardně ${c.points} b.)\n${c.description}\nTypické příklady: ${c.examples}`,
  ).join('\n\n');

  return [
    'Jsi knihovník pro studijní program TAP na Tiimi Akatemia. Hledáš na webu fakta o knize a hodnotíš ji podle rubriky níže. Odpovídáš výhradně česky a výhradně ve struktuře, kterou dostaneš.',
    GLOSSARY,
    `Bodovací rubrika:\n\n${categories}`,
    EXTENT_CORRECTION,
    OVERRIDE_EGO,
    OVERRIDE_RESILIENCE,
    TAGS,
    VOICE,
    RULES,
  ].join('\n\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:unit -- rubric`
Expected: PASS. If the ego-override regex fails, check that the sentence really contains both "nikdy" and "Kategorie 3" — the test is deliberately asserting the *substance* of the override, not its wording, so fix the prompt rather than loosening the test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/books/enrichment/rubric.ts src/lib/books/enrichment/rubric.test.ts
git commit -m "feat(books): encode the book scoring rubric as shared constants"
```

---

## Task 5: Enrichment response schema and validation

**Files:**
- Create: `src/lib/books/enrichment/schema.ts`
- Test: `src/lib/books/enrichment/schema.test.ts`

**Interfaces:**
- Produces:
  - `ENRICHMENT_JSON_SCHEMA` — the object passed as `response_format.json_schema.schema`.
  - `EnrichedBook` — `{ title_cs: string; title_en: string | null; author: string; isbn_13: string | null; page_count: number | null; description: string; tag: string; suggested_points: 1 | 2 | 3; points_reason: string; confidence: 'high' | 'low' }`
  - `parseEnrichment(raw: unknown): { ok: true; value: EnrichedBook } | { ok: false; error: string }`

- [ ] **Step 1: Write the failing test**

Create `src/lib/books/enrichment/schema.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { parseEnrichment } from './schema';

const VALID = {
  title_cs: 'Sprint',
  title_en: 'Sprint',
  author: 'Jake Knapp',
  isbn_13: '9781501121746',
  page_count: 288,
  description: 'Naučíš se během pěti dnů otestovat nápad. Je to hutné a hodně procesní.',
  tag: 'Inovace & kreativita',
  suggested_points: 2,
  points_reason: 'Kategorie 2 — procesní manuál s konkrétními frameworky, 288 stran.',
  confidence: 'high',
};

describe('parseEnrichment', () => {
  it('accepts a well-formed payload', () => {
    const result = parseEnrichment(VALID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.suggested_points).toBe(2);
  });

  it('accepts nulls for the optional metadata', () => {
    const result = parseEnrichment({ ...VALID, title_en: null, isbn_13: null, page_count: null });
    expect(result.ok).toBe(true);
  });

  it('rejects a tag outside the eight thematic categories', () => {
    // A student cannot INSERT into `tags` (RLS requires is_coach_or_admin), so an
    // invented tag name would fail at write time. Reject it here instead.
    const result = parseEnrichment({ ...VALID, tag: 'Beletrie' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/tag/);
  });

  it('rejects points outside 1-3', () => {
    expect(parseEnrichment({ ...VALID, suggested_points: 0 }).ok).toBe(false);
    expect(parseEnrichment({ ...VALID, suggested_points: 4 }).ok).toBe(false);
  });

  it('rejects a missing description or points_reason', () => {
    expect(parseEnrichment({ ...VALID, description: '' }).ok).toBe(false);
    expect(parseEnrichment({ ...VALID, points_reason: '   ' }).ok).toBe(false);
  });

  it('rejects a non-object payload', () => {
    expect(parseEnrichment(null).ok).toBe(false);
    expect(parseEnrichment('{}').ok).toBe(false);
  });

  it('defaults an unrecognised confidence to low rather than failing', () => {
    const result = parseEnrichment({ ...VALID, confidence: 'medium' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.confidence).toBe('low');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- enrichment/schema`
Expected: FAIL — `Cannot find module './schema'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/books/enrichment/schema.ts`:

```typescript
import { BOOK_CATEGORIES } from '@/lib/books/types';

export const SUGGESTED_POINTS_VALUES = [1, 2, 3] as const;
export type SuggestedPoints = (typeof SUGGESTED_POINTS_VALUES)[number];

export interface EnrichedBook {
  title_cs: string;
  title_en: string | null;
  author: string;
  isbn_13: string | null;
  page_count: number | null;
  description: string;
  tag: string;
  suggested_points: SuggestedPoints;
  points_reason: string;
  confidence: 'high' | 'low';
}

/** Passed as `response_format.json_schema.schema`. Perplexity enforces the shape server-side. */
export const ENRICHMENT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title_cs: { type: 'string' },
    title_en: { type: ['string', 'null'] },
    author: { type: 'string' },
    isbn_13: { type: ['string', 'null'] },
    page_count: { type: ['integer', 'null'] },
    description: { type: 'string' },
    tag: { type: 'string', enum: [...BOOK_CATEGORIES] },
    suggested_points: { type: 'integer', enum: [...SUGGESTED_POINTS_VALUES] },
    points_reason: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'low'] },
  },
  required: [
    'title_cs',
    'author',
    'description',
    'tag',
    'suggested_points',
    'points_reason',
    'confidence',
  ],
} as const;

export type ParseResult =
  | { ok: true; value: EnrichedBook }
  | { ok: false; error: string };

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function nullableInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * Validates a Perplexity payload. `response_format` makes a violation unlikely
 * but not impossible, and a bad tag would surface as an RLS failure at write
 * time — so nothing reaches the database unvalidated.
 */
export function parseEnrichment(raw: unknown): ParseResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Odpověď není objekt.' };
  }

  const source = raw as Record<string, unknown>;

  const titleCs = nonEmptyString(source.title_cs);
  if (!titleCs) return { ok: false, error: 'Chybí title_cs.' };

  const author = nonEmptyString(source.author);
  if (!author) return { ok: false, error: 'Chybí author.' };

  const description = nonEmptyString(source.description);
  if (!description) return { ok: false, error: 'Chybí description.' };

  const pointsReason = nonEmptyString(source.points_reason);
  if (!pointsReason) return { ok: false, error: 'Chybí points_reason.' };

  const tag = nonEmptyString(source.tag);
  if (!tag || !(BOOK_CATEGORIES as readonly string[]).includes(tag)) {
    return { ok: false, error: `Neznámý tag: ${String(source.tag)}` };
  }

  const points = source.suggested_points;
  if (!SUGGESTED_POINTS_VALUES.includes(points as SuggestedPoints)) {
    return { ok: false, error: `Neplatné suggested_points: ${String(points)}` };
  }

  return {
    ok: true,
    value: {
      title_cs: titleCs,
      title_en: nullableString(source.title_en),
      author,
      isbn_13: nullableString(source.isbn_13),
      page_count: nullableInteger(source.page_count),
      description,
      tag,
      suggested_points: points as SuggestedPoints,
      points_reason: pointsReason,
      // Anything we don't recognise is treated as uncertain, so Krok 4 flags it.
      confidence: source.confidence === 'high' ? 'high' : 'low',
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:unit -- enrichment/schema`
Expected: PASS (10 assertions across 7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/books/enrichment/schema.ts src/lib/books/enrichment/schema.test.ts
git commit -m "feat(books): validate the enrichment payload before it reaches the DB"
```

---

## Task 6: Perplexity client and circuit breaker

**Files:**
- Create: `src/lib/books/enrichment/enrich.ts`
- Test: `src/lib/books/enrichment/enrich.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `buildSystemPrompt` (Task 4), `ENRICHMENT_JSON_SCHEMA` / `parseEnrichment` / `EnrichedBook` (Task 5).
- Produces:
  - `EnrichmentProbe` — `{ title: string; author: string; isbn_13?: string | null; page_count?: number | null; publisher?: string | null; published_year?: number | null }`
  - `enrichBook(probe: EnrichmentProbe): Promise<EnrichmentOutcome>`
  - `EnrichmentOutcome` — `{ ok: true; value: EnrichedBook; citations: string[] } | { ok: false; reason: 'unavailable' | 'invalid'; message: string }`
  - `resetCircuitBreaker(): void` — test seam.

- [ ] **Step 1: Install the SDK and confirm its import shape**

```bash
pnpm add @perplexity-ai/perplexity_ai@0.38.1
```

Then confirm the client constructor name — do **not** guess it:

```bash
grep -rn "export default\|export declare class\|export class" node_modules/@perplexity-ai/perplexity_ai/index.d.ts | head
```

Use whatever that reports. The rest of the call surface is documented as
`client.chat.completions.create({ messages, model, response_format })`. The code below assumes
a default export named `Perplexity`; if the grep shows otherwise, adjust the import only.

- [ ] **Step 2: Add the env vars**

Append to `.env.example`:

```
# Perplexity — book enrichment. Set a hard spend limit on the Perplexity account:
# it is the only control that actually bounds spend (see the add-book design doc).
PERPLEXITY_API_KEY=
PERPLEXITY_MODEL=sonar-pro
```

- [ ] **Step 3: Write the failing test**

Create `src/lib/books/enrichment/enrich.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();

vi.mock('@perplexity-ai/perplexity_ai', () => ({
  default: class {
    chat = { completions: { create } };
  },
}));

import { enrichBook, resetCircuitBreaker, CIRCUIT_BREAKER_THRESHOLD } from './enrich';

const PROBE = { title: 'Sprint', author: 'Jake Knapp', page_count: 288 };

const VALID_CONTENT = JSON.stringify({
  title_cs: 'Sprint',
  title_en: 'Sprint',
  author: 'Jake Knapp',
  isbn_13: null,
  page_count: 288,
  description: 'Naučíš se otestovat nápad za pět dní.',
  tag: 'Inovace & kreativita',
  suggested_points: 2,
  points_reason: 'Kategorie 2 — procesní manuál, 288 stran.',
  confidence: 'high',
});

beforeEach(() => {
  vi.stubEnv('PERPLEXITY_API_KEY', 'test-key');
  create.mockReset();
  resetCircuitBreaker();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('enrichBook', () => {
  it('returns the parsed record and the citations', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: VALID_CONTENT } }],
      citations: ['https://goodreads.com/sprint'],
    });

    const outcome = await enrichBook(PROBE);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.suggested_points).toBe(2);
      expect(outcome.citations).toEqual(['https://goodreads.com/sprint']);
    }
  });

  it('sends the probe metadata and the JSON schema', async () => {
    create.mockResolvedValue({ choices: [{ message: { content: VALID_CONTENT } }] });

    await enrichBook(PROBE);

    const args = create.mock.calls[0][0];
    expect(args.response_format.type).toBe('json_schema');
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[1].content).toContain('Sprint');
    expect(args.messages[1].content).toContain('288');
  });

  it('reports invalid when the payload violates the schema', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ title_cs: 'X' }) } }],
    });

    const outcome = await enrichBook(PROBE);

    expect(outcome).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('reports invalid when the content is not JSON', async () => {
    create.mockResolvedValue({ choices: [{ message: { content: 'Tady je odpověď:' } }] });

    expect(await enrichBook(PROBE)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('reports unavailable when the API throws', async () => {
    create.mockRejectedValue(new Error('429 rate limited'));

    expect(await enrichBook(PROBE)).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('reports unavailable without calling the API when the key is missing', async () => {
    vi.stubEnv('PERPLEXITY_API_KEY', '');

    expect(await enrichBook(PROBE)).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(create).not.toHaveBeenCalled();
  });

  it('opens the circuit after consecutive failures and stops calling the API', async () => {
    create.mockRejectedValue(new Error('500'));

    for (let i = 0; i < CIRCUIT_BREAKER_THRESHOLD; i += 1) {
      await enrichBook(PROBE);
    }
    const callsWhileFailing = create.mock.calls.length;

    const outcome = await enrichBook(PROBE);

    expect(outcome).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(create.mock.calls.length).toBe(callsWhileFailing);
  });

  it('closes the circuit again after a success', async () => {
    create.mockRejectedValueOnce(new Error('500'));
    await enrichBook(PROBE);

    create.mockResolvedValue({ choices: [{ message: { content: VALID_CONTENT } }] });
    expect((await enrichBook(PROBE)).ok).toBe(true);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm test:unit -- enrichment/enrich`
Expected: FAIL — `Cannot find module './enrich'`.

- [ ] **Step 5: Write the implementation**

Create `src/lib/books/enrichment/enrich.ts`:

```typescript
import Perplexity from '@perplexity-ai/perplexity_ai';

import { buildSystemPrompt } from './rubric';
import { ENRICHMENT_JSON_SCHEMA, parseEnrichment, type EnrichedBook } from './schema';

const DEFAULT_MODEL = 'sonar-pro';
const SCHEMA_NAME = 'enriched_book';
/** Prefer the two sources the coaches actually trust for Czech titles and ratings. */
const SEARCH_DOMAINS = ['goodreads.com', 'databazeknih.cz'] as const;
const SEARCH_LANGUAGES = ['cs', 'en'] as const;

/** Consecutive failures before we stop trying. Per-instance and best-effort by design. */
export const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000;

let consecutiveFailures = 0;
let circuitOpenedAt: number | null = null;

/** Test seam — clears breaker state between cases. */
export function resetCircuitBreaker(): void {
  consecutiveFailures = 0;
  circuitOpenedAt = null;
}

function circuitIsOpen(): boolean {
  if (circuitOpenedAt === null) return false;
  if (Date.now() - circuitOpenedAt > CIRCUIT_BREAKER_COOLDOWN_MS) {
    resetCircuitBreaker();
    return false;
  }
  return true;
}

function recordFailure(): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD && circuitOpenedAt === null) {
    circuitOpenedAt = Date.now();
  }
}

export interface EnrichmentProbe {
  title: string;
  author: string;
  isbn_13?: string | null;
  page_count?: number | null;
  publisher?: string | null;
  published_year?: number | null;
}

export type EnrichmentOutcome =
  | { ok: true; value: EnrichedBook; citations: string[] }
  | { ok: false; reason: 'unavailable' | 'invalid'; message: string };

function buildUserPrompt(probe: EnrichmentProbe): string {
  const known = [
    `Název: ${probe.title}`,
    `Autor: ${probe.author}`,
    probe.isbn_13 ? `ISBN-13: ${probe.isbn_13}` : null,
    probe.page_count ? `Počet stran: ${probe.page_count}` : null,
    probe.publisher ? `Vydavatel: ${probe.publisher}` : null,
    probe.published_year ? `Rok vydání: ${probe.published_year}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  return `Dohledej informace o této knize a ohodnoť ji podle rubriky.\n\n${known}\n\nPokud si u některého údaje nejsi jistý, nastav confidence na "low".`;
}

export async function enrichBook(probe: EnrichmentProbe): Promise<EnrichmentOutcome> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: 'unavailable', message: 'PERPLEXITY_API_KEY není nastavený.' };
  }

  if (circuitIsOpen()) {
    return { ok: false, reason: 'unavailable', message: 'Perplexity opakovaně neodpovídá.' };
  }

  const client = new Perplexity({ apiKey });

  let content: string | null | undefined;
  let citations: string[] = [];

  try {
    const response = await client.chat.completions.create({
      model: process.env.PERPLEXITY_MODEL ?? DEFAULT_MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(probe) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: SCHEMA_NAME, schema: ENRICHMENT_JSON_SCHEMA },
      },
      search_domain_filter: [...SEARCH_DOMAINS],
      search_language_filter: [...SEARCH_LANGUAGES],
    });

    content = response.choices?.[0]?.message?.content;
    citations = response.citations ?? [];
  } catch (error) {
    recordFailure();
    console.error('Perplexity enrichment failed:', error);
    return { ok: false, reason: 'unavailable', message: 'Perplexity teď neodpovídá.' };
  }

  if (!content) {
    recordFailure();
    return { ok: false, reason: 'invalid', message: 'Perplexity vrátila prázdnou odpověď.' };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(content);
  } catch {
    recordFailure();
    return { ok: false, reason: 'invalid', message: 'Odpověď nešla přečíst jako JSON.' };
  }

  const parsed = parseEnrichment(payload);
  if (!parsed.ok) {
    recordFailure();
    return { ok: false, reason: 'invalid', message: parsed.error };
  }

  resetCircuitBreaker();
  return { ok: true, value: parsed.value, citations };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test:unit -- enrichment/enrich && pnpm typecheck`
Expected: PASS. If typecheck complains that `search_domain_filter` or `citations` are not on the SDK's types, check the installed `index.d.ts` — do not cast to `any`; widen with a narrow local interface if the SDK omits a documented field.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml .env.example src/lib/books/enrichment/enrich.ts src/lib/books/enrichment/enrich.test.ts
git commit -m "feat(books): call Perplexity for book enrichment behind a circuit breaker"
```

---

## Task 7: The enrich API route

**Files:**
- Create: `src/app/api/books/enrich/route.ts`

**Interfaces:**
- Consumes: `enrichBook`, `EnrichmentProbe` (Task 6).
- Produces: `POST /api/books/enrich` → `200 { data: EnrichedBook, citations: string[] }`, `401`, `400`, `429`, or `503 { error }`.

- [ ] **Step 1: Write the route**

Create `src/app/api/books/enrich/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { enrichBook, type EnrichmentProbe } from '@/lib/books/enrichment/enrich';

/**
 * Courtesy guard, not a boundary: per-instance state does not hold across
 * serverless invocations. The hard spend limit lives on the Perplexity account.
 */
const MAX_PER_WINDOW = 20;
const WINDOW_MS = 60 * 60 * 1000;
const recentByProfile = new Map<string, number[]>();

function withinBudget(profileId: string): boolean {
  const now = Date.now();
  const recent = (recentByProfile.get(profileId) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    recentByProfile.set(profileId, recent);
    return false;
  }
  recent.push(now);
  recentByProfile.set(profileId, recent);
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    if (!withinBudget(profile.id)) {
      return NextResponse.json(
        { error: 'Zkusil jsi to příliš mnohokrát. Zkus to za chvíli, nebo vyplň údaje ručně.' },
        { status: 429 },
      );
    }

    const body: Partial<EnrichmentProbe> = await request.json();
    if (!body.title?.trim() || !body.author?.trim()) {
      return NextResponse.json({ error: 'Název a autor jsou povinné' }, { status: 400 });
    }

    const outcome = await enrichBook({
      title: body.title.trim(),
      author: body.author.trim(),
      isbn_13: body.isbn_13 ?? null,
      page_count: body.page_count ?? null,
      publisher: body.publisher ?? null,
      published_year: body.published_year ?? null,
    });

    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.message }, { status: 503 });
    }

    return NextResponse.json({ data: outcome.value, citations: outcome.citations });
  } catch (error) {
    console.error('POST /api/books/enrich error:', error);
    return NextResponse.json({ error: 'Nepodařilo se dohledat údaje' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/books/enrich/route.ts
git commit -m "feat(books): add the enrichment endpoint"
```

---

## Task 8: Book notification emails

**Files:**
- Create: `src/lib/notifications/book-notifications.ts`
- Test: `src/lib/notifications/book-notifications.test.ts`
- Modify: `src/lib/notifications/email-templates.ts`
- Modify: `src/app/api/books/route.ts` (POST, after insert)
- Modify: `src/app/api/books/[id]/route.ts` (`classify` branch)

**Interfaces:**
- Produces:
  - `BookSubmittedEmailContext` — `{ bookTitle: string; bookAuthor: string; submitterName: string; suggestedPoints: number | null; pointsReason: string | null; reviewUrl: string }`
  - `BookDecisionEmailContext` — `{ bookTitle: string; approved: boolean; points: number | null; reason: string; bookUrl: string }`
  - `bookSubmittedEmail(ctx): EmailContent`, `bookDecisionEmail(ctx): EmailContent`
  - `notifyBookSubmitted(supabase, { bookId, submitterProfileId, origin }): Promise<void>`
  - `notifyBookDecided(supabase, { bookId, origin }): Promise<void>`
  - `selectCoachRecipients(coaches, submitterTeamId): CoachRecipient[]` — exported for unit testing.

- [ ] **Step 1: Write the failing test**

Create `src/lib/notifications/book-notifications.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { selectCoachRecipients, type CoachRecipient } from './book-notifications';

const TEAM = 'team-1';

const teamCoach: CoachRecipient = {
  id: 'c1',
  work_email: 'coach1@studenti.czu.cz',
  team_id: TEAM,
  beta_access_granted_at: '2026-01-01T00:00:00Z',
};
const otherTeamCoach: CoachRecipient = {
  id: 'c2',
  work_email: 'coach2@studenti.czu.cz',
  team_id: 'team-2',
  beta_access_granted_at: '2026-01-01T00:00:00Z',
};
const noBeta: CoachRecipient = {
  id: 'c3',
  work_email: 'coach3@studenti.czu.cz',
  team_id: TEAM,
  beta_access_granted_at: null,
};
const noEmail: CoachRecipient = {
  id: 'c4',
  work_email: null,
  team_id: TEAM,
  beta_access_granted_at: '2026-01-01T00:00:00Z',
};

describe('selectCoachRecipients', () => {
  it('prefers coaches on the submitter\'s own team', () => {
    const picked = selectCoachRecipients([teamCoach, otherTeamCoach], TEAM);
    expect(picked.map((c) => c.id)).toEqual(['c1']);
  });

  it('falls back to every coach when the team has none', () => {
    const picked = selectCoachRecipients([otherTeamCoach], TEAM);
    expect(picked.map((c) => c.id)).toEqual(['c2']);
  });

  it('falls back to every coach when the submitter has no team', () => {
    const picked = selectCoachRecipients([teamCoach, otherTeamCoach], null);
    expect(picked.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('drops coaches without beta access or without a work email', () => {
    expect(selectCoachRecipients([noBeta, noEmail], TEAM)).toEqual([]);
  });

  it('returns nothing when there are no coaches at all', () => {
    expect(selectCoachRecipients([], TEAM)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- book-notifications`
Expected: FAIL — `Cannot find module './book-notifications'`.

- [ ] **Step 3: Add the two email templates**

Append to `src/lib/notifications/email-templates.ts`, matching the existing helpers' markup style (open the file and reuse whatever wrapper `bookLoanEmail` uses):

```typescript
export interface BookSubmittedEmailContext {
  bookTitle: string;
  bookAuthor: string;
  submitterName: string;
  suggestedPoints: number | null;
  pointsReason: string | null;
  reviewUrl: string;
}

export interface BookDecisionEmailContext {
  bookTitle: string;
  approved: boolean;
  points: number | null;
  reason: string;
  bookUrl: string;
}

export function bookSubmittedEmail(ctx: BookSubmittedEmailContext): EmailContent {
  const points = ctx.suggestedPoints === null ? 'bez návrhu' : `${ctx.suggestedPoints} b.`;
  return {
    subject: `Nová kniha ke schválení: ${ctx.bookTitle}`,
    html: `
      <p><strong>${ctx.submitterName}</strong> přidal knihu do BOBa a čeká na schválení.</p>
      <p><strong>${ctx.bookTitle}</strong><br />${ctx.bookAuthor}</p>
      <p>Navržené hodnocení: <strong>${points}</strong></p>
      ${ctx.pointsReason ? `<p>${ctx.pointsReason}</p>` : ''}
      <p><a href="${ctx.reviewUrl}">Zkontrolovat knihu</a></p>
    `,
  };
}

export function bookDecisionEmail(ctx: BookDecisionEmailContext): EmailContent {
  const verdict = ctx.approved ? 'schválena' : 'zamítnuta';
  return {
    subject: `Kniha ${ctx.bookTitle} byla ${verdict}`,
    html: `
      <p>Kniha <strong>${ctx.bookTitle}</strong>, kterou jsi přidal do BOBa, byla ${verdict}.</p>
      ${ctx.approved && ctx.points !== null ? `<p>Přidělené body: <strong>${ctx.points}</strong></p>` : ''}
      <p><strong>Důvod:</strong> ${ctx.reason}</p>
      <p><a href="${ctx.bookUrl}">Zobrazit knihu</a></p>
    `,
  };
}
```

- [ ] **Step 4: Write the notification module**

Create `src/lib/notifications/book-notifications.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';
import { POINTS_ELIGIBLE_LIST_STATUSES } from '@/lib/books/types';

import { sendEmail } from './send-email';
import { bookDecisionEmail, bookSubmittedEmail } from './email-templates';

export interface CoachRecipient {
  id: string;
  work_email: string | null;
  team_id: string | null;
  beta_access_granted_at: string | null;
}

interface Reachable {
  work_email: string | null;
  beta_access_granted_at: string | null;
}

/**
 * There are no notification-preference columns for book emails — the schema is
 * frozen — so this follows `notifyBookBorrowed`, which also has no preference
 * check, plus the `beta_access_granted_at` gate used by essay notifications.
 */
function isReachable(profile: Reachable | null): boolean {
  return Boolean(profile?.work_email) && Boolean(profile?.beta_access_granted_at);
}

/** Coaches on the submitter's team, or all coaches when that team has none. */
export function selectCoachRecipients(
  coaches: CoachRecipient[],
  submitterTeamId: string | null,
): CoachRecipient[] {
  const reachable = coaches.filter(isReachable);
  if (!submitterTeamId) return reachable;

  const sameTeam = reachable.filter((coach) => coach.team_id === submitterTeamId);
  return sameTeam.length > 0 ? sameTeam : reachable;
}

export interface NotifyBookSubmittedParams {
  bookId: string;
  submitterProfileId: string;
  origin: string;
}

export async function notifyBookSubmitted(
  supabase: SupabaseClient<Database>,
  params: NotifyBookSubmittedParams,
): Promise<void> {
  const [{ data: book }, { data: submitter }, { data: coaches }] = await Promise.all([
    supabase
      .from('books')
      .select('title_cs, author, book_points, list_status_reason')
      .eq('id', params.bookId)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('name, team_id')
      .eq('id', params.submitterProfileId)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('id, work_email, team_id, beta_access_granted_at')
      .eq('role', 'coach'),
  ]);

  if (!book || !submitter) return;

  const recipients = selectCoachRecipients(coaches ?? [], submitter.team_id);
  if (recipients.length === 0) return;

  const { subject, html } = bookSubmittedEmail({
    bookTitle: book.title_cs,
    bookAuthor: book.author,
    submitterName: submitter.name ?? 'Téčko',
    suggestedPoints: book.book_points === null ? null : Number(book.book_points),
    pointsReason: book.list_status_reason,
    reviewUrl: `${params.origin}/cteni/sprava`,
  });

  await Promise.all(
    recipients.map((coach) => sendEmail({ to: coach.work_email as string, subject, html })),
  );
}

export interface NotifyBookDecidedParams {
  bookId: string;
  origin: string;
}

export async function notifyBookDecided(
  supabase: SupabaseClient<Database>,
  params: NotifyBookDecidedParams,
): Promise<void> {
  const { data: book } = await supabase
    .from('books')
    .select('title_cs, book_points, list_status, list_status_reason, created_by_profile_id')
    .eq('id', params.bookId)
    .maybeSingle();

  if (!book) return;

  const { data: submitter } = await supabase
    .from('profiles')
    .select('work_email, beta_access_granted_at')
    .eq('id', book.created_by_profile_id)
    .maybeSingle();

  if (!isReachable(submitter)) return;

  const approved = (POINTS_ELIGIBLE_LIST_STATUSES as readonly string[]).includes(book.list_status);

  const { subject, html } = bookDecisionEmail({
    bookTitle: book.title_cs,
    approved,
    points: book.book_points === null ? null : Number(book.book_points),
    reason: book.list_status_reason ?? 'Kouč neuvedl důvod.',
    bookUrl: `${params.origin}/cteni/knihy/${params.bookId}`,
  });

  await sendEmail({ to: submitter!.work_email as string, subject, html });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:unit -- book-notifications`
Expected: PASS (5 tests).

- [ ] **Step 6: Wire both call sites**

In `src/app/api/books/route.ts`, after tags are set and before the success response:

```typescript
    // A failed email must never fail the submission.
    try {
      await notifyBookSubmitted(supabase, {
        bookId: inserted.id,
        submitterProfileId: profile.id,
        origin: new URL(request.url).origin,
      });
    } catch (notifyError) {
      console.error('notifyBookSubmitted failed:', notifyError);
    }
```

In `src/app/api/books/[id]/route.ts`, at the end of the `classify` branch, after the update succeeds:

```typescript
      try {
        await notifyBookDecided(supabase, {
          bookId: id,
          origin: new URL(request.url).origin,
        });
      } catch (notifyError) {
        console.error('notifyBookDecided failed:', notifyError);
      }
```

Add the imports to both files. Confirm the `id` variable name matches what that route already destructures from its params.

- [ ] **Step 7: Verify and commit**

Run: `pnpm test && pnpm typecheck`

```bash
git add src/lib/notifications/ src/app/api/books/
git commit -m "feat(books): email the coach on submit and the submitter on the verdict"
```

---

## Task 9: Shared draft type and the Krok 1 gate

**Files:**
- Create: `src/components/books/add-book/types.ts`
- Create: `src/components/books/add-book/step-gate.tsx`
- Test: `src/components/books/add-book/step-gate.test.tsx`

**Interfaces:**
- Consumes: `BOOK_POINT_CATEGORIES` (Task 4), `EnrichedBook` (Task 5), `ExternalBookCandidate` (Task 1).
- Produces:
  - `AddBookDraft` — `{ candidate: ExternalBookCandidate | null; enriched: EnrichedBook | null; citations: string[]; manual: boolean }`
  - `StepGate` — props `{ onContinue: () => void }`

- [ ] **Step 1: Write the shared type**

Create `src/components/books/add-book/types.ts`:

```typescript
import type { EnrichedBook } from '@/lib/books/enrichment/schema';
import type { ExternalBookCandidate } from '@/lib/books/types';

/** The working record as it moves through the four steps. Mirrored to sessionStorage. */
export interface AddBookDraft {
  candidate: ExternalBookCandidate | null;
  enriched: EnrichedBook | null;
  citations: string[];
  /** True when the submitter is filling the record in by hand. */
  manual: boolean;
}

export const EMPTY_DRAFT: AddBookDraft = {
  candidate: null,
  enriched: null,
  citations: [],
  manual: false,
};

/** Things that must never be added, from the 2026-07-27 curation pass. */
export const DOES_NOT_BELONG = [
  'Duplicity — kniha, která už v BOBovi je pod jiným jazykem nebo vydáním',
  'Ne-knihy — články, kurzy, podcasty, PDF příručky',
  'Pseudověda',
  'Beletrie',
  'Knihy v rozporu s našimi hodnotami',
] as const;
```

- [ ] **Step 2: Write the failing test**

Create `src/components/books/add-book/step-gate.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BOOK_POINT_CATEGORIES } from '@/lib/books/enrichment/rubric';

import { StepGate } from './step-gate';
import { DOES_NOT_BELONG } from './types';

describe('StepGate', () => {
  it('shows all three scoring categories with their point values', () => {
    render(<StepGate onContinue={vi.fn()} />);

    for (const category of BOOK_POINT_CATEGORIES) {
      expect(screen.getByText(category.name)).toBeInTheDocument();
    }
  });

  it('lists what does not belong in BOBa', () => {
    render(<StepGate onContinue={vi.fn()} />);

    for (const item of DOES_NOT_BELONG) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it('continues only when the affirm button is pressed', async () => {
    const onContinue = vi.fn();
    render(<StepGate onContinue={onContinue} />);

    expect(onContinue).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /chci přidat/i }));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test:component -- step-gate`
Expected: FAIL — `Cannot find module './step-gate'`.

- [ ] **Step 4: Write the component**

Create `src/components/books/add-book/step-gate.tsx`:

```typescript
'use client';

import { ArrowRight, Ban } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { BOOK_POINT_CATEGORIES } from '@/lib/books/enrichment/rubric';

import { DOES_NOT_BELONG } from './types';

export function StepGate({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Patří ta kniha do BOBa?</h2>
        <p className="text-sm text-muted-foreground">
          BOB je naše knihovna doporučené literatury. Než knihu přidáš, projdi si, co do ní patří —
          kouč ji potom schvaluje a přiděluje body.
        </p>
      </div>

      <div className="space-y-3">
        {BOOK_POINT_CATEGORIES.map((category) => (
          <div key={category.points} className="rounded-xl border bg-card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold">{category.name}</h3>
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {category.points} b.
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {category.description}
            </p>
            <p className="mt-2 text-xs text-muted-foreground/80">Např. {category.examples}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-center gap-2">
          <Ban className="size-4 text-destructive" />
          <h3 className="text-sm font-semibold">Do BOBa naopak nepatří</h3>
        </div>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {DOES_NOT_BELONG.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <Button onClick={onContinue} className="w-full gap-2 sm:w-auto">
        Ano, tuhle knihu tam chci přidat
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:component -- step-gate`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/books/add-book/types.ts src/components/books/add-book/step-gate.tsx src/components/books/add-book/step-gate.test.tsx
git commit -m "feat(books): add the BOB gate step"
```

---

## Task 10: Krok 2 — search

**Files:**
- Create: `src/components/books/add-book/step-search.tsx`
- Test: `src/components/books/add-book/step-search.test.tsx`

**Interfaces:**
- Consumes: `ExternalBookCandidate` (Task 1), `AddBookDraft` (Task 9).
- Produces: `StepSearch` — props `{ initialQuery: string; onSelect: (candidate: ExternalBookCandidate) => void; onManual: (title: string, author: string) => void }`

- [ ] **Step 1: Write the failing test**

Create `src/components/books/add-book/step-search.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StepSearch } from './step-search';

const CATALOGUE_HIT = { id: 'existing-1', title_cs: 'Sprint', author: 'Jake Knapp' };
const EXTERNAL_HIT = {
  title: 'Sprint',
  author: 'Jake Knapp',
  isbn_13: '9781501121746',
  description: null,
  cover_url: null,
  page_count: 288,
  publisher: 'Simon & Schuster',
  published_year: 2016,
  preview_link: null,
  source: 'google_books',
  external_id: 'vol-1',
};

function mockRoutes({ local = [], external = [] }: { local?: unknown[]; external?: unknown[] }) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string) => {
      const body = input.includes('external-search') ? { data: external } : { data: local };
      return Promise.resolve({ ok: true, json: async () => body });
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('StepSearch', () => {
  it('shows catalogue matches before external ones so a duplicate dead-ends', async () => {
    mockRoutes({ local: [CATALOGUE_HIT], external: [EXTERNAL_HIT] });
    render(<StepSearch initialQuery="sprint" onSelect={vi.fn()} onManual={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/už v bobovi/i)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /Sprint/ })).toHaveAttribute(
      'href',
      '/cteni/knihy/existing-1',
    );
  });

  it('shows page count and publisher on external candidates', async () => {
    mockRoutes({ external: [EXTERNAL_HIT] });
    render(<StepSearch initialQuery="sprint" onSelect={vi.fn()} onManual={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/288/)).toBeInTheDocument());
    expect(screen.getByText(/Simon & Schuster/)).toBeInTheDocument();
  });

  it('passes the chosen candidate up', async () => {
    const onSelect = vi.fn();
    mockRoutes({ external: [EXTERNAL_HIT] });
    render(<StepSearch initialQuery="sprint" onSelect={onSelect} onManual={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /vybrat/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /vybrat/i }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ external_id: 'vol-1' }));
  });

  it('offers manual entry and requires both title and author', async () => {
    const onManual = vi.fn();
    mockRoutes({});
    render(<StepSearch initialQuery="neznámá" onSelect={vi.fn()} onManual={onManual} />);

    await userEvent.click(await screen.findByRole('button', { name: /zadat ručně/i }));

    const submit = screen.getByRole('button', { name: /pokračovat/i });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/název/i), 'Tiimiakatemia');
    await userEvent.type(screen.getByLabelText(/autor/i), 'Partanen');
    await userEvent.click(submit);

    expect(onManual).toHaveBeenCalledWith('Tiimiakatemia', 'Partanen');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:component -- step-search`
Expected: FAIL — `Cannot find module './step-search'`.

- [ ] **Step 3: Write the component**

Create `src/components/books/add-book/step-search.tsx`:

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Plus, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { StorageImage } from '@/components/storage/storage-image';
import type { ExternalBookCandidate } from '@/lib/books/types';

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

interface CatalogueHit {
  id: string;
  title_cs: string;
  author: string;
  google_books_cover_url?: string | null;
}

interface StepSearchProps {
  initialQuery: string;
  onSelect: (candidate: ExternalBookCandidate) => void;
  onManual: (title: string, author: string) => void;
}

export function StepSearch({ initialQuery, onSelect, onManual }: StepSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [catalogue, setCatalogue] = useState<CatalogueHit[]>([]);
  const [external, setExternal] = useState<ExternalBookCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthor, setManualAuthor] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setCatalogue([]);
      setExternal([]);
      return;
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const q = encodeURIComponent(query.trim());
        const [localRes, externalRes] = await Promise.all([
          fetch(`/api/books/search?q=${q}`),
          fetch(`/api/books/external-search?q=${q}`),
        ]);
        const [localJson, externalJson] = await Promise.all([localRes.json(), externalRes.json()]);
        setCatalogue(localJson.data ?? []);
        setExternal(externalJson.data ?? []);
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  const manualReady = manualTitle.trim().length > 0 && manualAuthor.trim().length > 0;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="book-search">Najdi knihu</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            id="book-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Název knihy nebo jméno autora…"
            className="h-11 pl-9"
          />
          {searching && (
            <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2" />
          )}
        </div>
      </div>

      {catalogue.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Už v BOBovi
          </h3>
          <div className="divide-y overflow-hidden rounded-xl border bg-card">
            {catalogue.map((book) => (
              <Link
                key={book.id}
                href={`/cteni/knihy/${book.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex h-11 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                  {book.google_books_cover_url ? (
                    <StorageImage
                      storageKey={book.google_books_cover_url}
                      alt={book.title_cs}
                      width={32}
                      height={44}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <BookOpen className="size-3.5 text-muted-foreground/40" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{book.title_cs}</p>
                  <p className="truncate text-xs text-muted-foreground">{book.author}</p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  Zobrazit
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      )}

      {external.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Mimo katalog
          </h3>
          <div className="space-y-2">
            {external.map((candidate) => (
              <div
                key={`${candidate.source}-${candidate.external_id}`}
                className="flex gap-3 rounded-xl border bg-card p-3"
              >
                <div className="flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                  {candidate.cover_url ? (
                    // Remote cover, not yet in storage — plain img is correct here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={candidate.cover_url}
                      alt={candidate.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <BookOpen className="size-4 text-muted-foreground/40" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium">{candidate.title}</p>
                  <p className="text-xs text-muted-foreground">{candidate.author}</p>
                  <p className="text-xs text-muted-foreground/80">
                    {[
                      candidate.published_year,
                      candidate.publisher,
                      candidate.page_count ? `${candidate.page_count} s.` : null,
                      candidate.isbn_13 ? `ISBN ${candidate.isbn_13}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="shrink-0 self-center"
                  onClick={() => onSelect(candidate)}
                >
                  Vybrat
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {!manualOpen ? (
        <Button variant="outline" className="gap-2" onClick={() => setManualOpen(true)}>
          <Plus className="size-4" />
          Nenašel jsi ji? Zadat ručně
        </Button>
      ) : (
        <section className="space-y-3 rounded-xl border bg-muted/40 p-4">
          <p className="text-sm text-muted-foreground">
            Zadej název a autora. Ostatní údaje se pokusíme dohledat.
          </p>
          <div className="space-y-1">
            <Label htmlFor="manual-title">Název</Label>
            <Input
              id="manual-title"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="manual-author">Autor</Label>
            <Input
              id="manual-author"
              value={manualAuthor}
              onChange={(e) => setManualAuthor(e.target.value)}
            />
          </div>
          <Button
            disabled={!manualReady}
            onClick={() => onManual(manualTitle.trim(), manualAuthor.trim())}
          >
            Pokračovat
          </Button>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:component -- step-search`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the ISBN scanner**

Reuse the pattern from `src/components/library/library-import-scanner.tsx:115` — read that file first and copy its `BarcodeScanner` props and the `react-barcode-scanner/polyfill` import verbatim. Add a toggle button next to the search input that opens the scanner and, on a detected code, sets `query` to the scanned ISBN. Users scan the barcode of a book they are holding up to the screen.

Add a test asserting the toggle renders:

```typescript
  it('offers the ISBN scanner', async () => {
    mockRoutes({});
    render(<StepSearch initialQuery="" onSelect={vi.fn()} onManual={vi.fn()} />);

    expect(screen.getByRole('button', { name: /naskenovat/i })).toBeInTheDocument();
  });
```

- [ ] **Step 6: Verify and commit**

Run: `pnpm test:component -- step-search && pnpm typecheck`

```bash
git add src/components/books/add-book/step-search.tsx src/components/books/add-book/step-search.test.tsx
git commit -m "feat(books): add the search step with covers, page counts and ISBN scan"
```

---

## Task 11: Krok 3 — enriching

**Files:**
- Create: `src/components/books/add-book/step-enriching.tsx`
- Test: `src/components/books/add-book/step-enriching.test.tsx`

**Interfaces:**
- Consumes: `EnrichedBook` (Task 5), the `POST /api/books/enrich` contract (Task 7).
- Produces: `StepEnriching` — props `{ probe: { title: string; author: string; isbn_13: string | null; page_count: number | null; publisher: string | null; published_year: number | null }; onDone: (enriched: EnrichedBook, citations: string[]) => void; onManual: () => void }`

- [ ] **Step 1: Write the failing test**

Create `src/components/books/add-book/step-enriching.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StepEnriching } from './step-enriching';

const PROBE = {
  title: 'Sprint',
  author: 'Jake Knapp',
  isbn_13: null,
  page_count: 288,
  publisher: null,
  published_year: null,
};

const ENRICHED = {
  title_cs: 'Sprint',
  title_en: 'Sprint',
  author: 'Jake Knapp',
  isbn_13: null,
  page_count: 288,
  description: 'Naučíš se otestovat nápad za pět dní.',
  tag: 'Inovace & kreativita',
  suggested_points: 2,
  points_reason: 'Kategorie 2 — procesní manuál, 288 stran.',
  confidence: 'high',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('StepEnriching', () => {
  it('hands the enriched record up on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: ENRICHED, citations: ['https://goodreads.com/x'] }),
    }));
    const onDone = vi.fn();

    render(<StepEnriching probe={PROBE} onDone={onDone} onManual={vi.fn()} />);

    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith(ENRICHED, ['https://goodreads.com/x']),
    );
  });

  it('names what it is doing rather than showing a bare spinner', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    render(<StepEnriching probe={PROBE} onDone={vi.fn()} onManual={vi.fn()} />);

    expect(screen.getByText(/hledám/i)).toBeInTheDocument();
  });

  it('offers retry and manual entry when enrichment fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Perplexity teď neodpovídá.' }),
    }));
    const onManual = vi.fn();

    render(<StepEnriching probe={PROBE} onDone={vi.fn()} onManual={onManual} />);

    await waitFor(() => expect(screen.getByText(/neodpovídá/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /zkusit znovu/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /vyplnit ručně/i }));
    expect(onManual).toHaveBeenCalledTimes(1);
  });

  it('treats a network rejection as a failure, not a hang', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    render(<StepEnriching probe={PROBE} onDone={vi.fn()} onManual={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /vyplnit ručně/i })).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:component -- step-enriching`
Expected: FAIL — `Cannot find module './step-enriching'`.

- [ ] **Step 3: Write the component**

Create `src/components/books/add-book/step-enriching.tsx`:

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, PencilLine, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { EnrichedBook } from '@/lib/books/enrichment/schema';

/** Named so the wait reads as progress rather than a hang. */
const PHASES = [
  'Hledám český popis a hodnocení…',
  'Porovnávám s knihami v BOBovi…',
  'Hodnotím podle kritérií…',
] as const;
const PHASE_INTERVAL_MS = 6_000;

interface EnrichProbe {
  title: string;
  author: string;
  isbn_13: string | null;
  page_count: number | null;
  publisher: string | null;
  published_year: number | null;
}

interface StepEnrichingProps {
  probe: EnrichProbe;
  onDone: (enriched: EnrichedBook, citations: string[]) => void;
  onManual: () => void;
}

export function StepEnriching({ probe, onDone, onManual }: StepEnrichingProps) {
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const run = useCallback(async () => {
    setError(null);
    setPhase(0);
    try {
      const res = await fetch('/api/books/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(probe),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Údaje se nepodařilo dohledat.');
        return;
      }
      onDone(json.data as EnrichedBook, json.citations ?? []);
    } catch {
      setError('Nepodařilo se připojit k serveru.');
    }
  }, [probe, onDone]);

  useEffect(() => {
    void run();
  }, [run, attempt]);

  useEffect(() => {
    if (error) return;
    const id = setInterval(
      () => setPhase((current) => Math.min(current + 1, PHASES.length - 1)),
      PHASE_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [error]);

  if (error) {
    return (
      <div className="space-y-4 rounded-xl border border-amber-300/50 bg-amber-50/50 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-medium">{error}</p>
            <p className="text-sm text-muted-foreground">
              Můžeš to zkusit znovu, nebo údaje vyplnit sám — kniha se dá odeslat i tak.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setAttempt((n) => n + 1)}>
            <RotateCw className="size-4" />
            Zkusit znovu
          </Button>
          <Button className="gap-2" onClick={onManual}>
            <PencilLine className="size-4" />
            Vyplnit ručně
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-10 text-center">
      <Spinner className="mx-auto size-6" />
      <div className="space-y-1">
        <p className="font-medium">{PHASES[phase]}</p>
        <p className="text-sm text-muted-foreground">
          {probe.title} — může to trvat půl minuty.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:component -- step-enriching`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/books/add-book/step-enriching.tsx src/components/books/add-book/step-enriching.test.tsx
git commit -m "feat(books): add the enrichment step with a manual escape hatch"
```

---

## Task 12: Krok 4 — checkout

**Files:**
- Create: `src/components/books/add-book/step-review.tsx`
- Test: `src/components/books/add-book/step-review.test.tsx`

**Interfaces:**
- Consumes: `AddBookDraft` (Task 9), `BOOK_POINT_CATEGORIES` (Task 4), `BOOK_CATEGORIES` (existing), `CreateBookInput` (Task 3).
- Produces: `StepReview` — props `{ draft: AddBookDraft; submitting: boolean; onSubmit: (input: CreateBookInput) => void }`

- [ ] **Step 1: Write the failing test**

Create `src/components/books/add-book/step-review.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StepReview } from './step-review';
import type { AddBookDraft } from './types';

const CANDIDATE = {
  title: 'Sprint',
  author: 'Jake Knapp',
  isbn_13: '9781501121746',
  description: null,
  cover_url: null,
  page_count: 288,
  publisher: 'Simon & Schuster',
  published_year: 2016,
  preview_link: 'https://books.google.com/x',
  source: 'google_books' as const,
  external_id: 'vol-1',
};

const ENRICHED_DRAFT: AddBookDraft = {
  candidate: CANDIDATE,
  enriched: {
    title_cs: 'Sprint',
    title_en: 'Sprint',
    author: 'Jake Knapp',
    isbn_13: '9781501121746',
    page_count: 288,
    description: 'Naučíš se otestovat nápad za pět dní. Je to hutné.',
    tag: 'Inovace & kreativita',
    suggested_points: 2,
    points_reason: 'Kategorie 2 — procesní manuál, 288 stran.',
    confidence: 'high',
  },
  citations: ['https://goodreads.com/sprint'],
  manual: false,
};

const MANUAL_DRAFT: AddBookDraft = {
  candidate: CANDIDATE,
  enriched: null,
  citations: [],
  manual: true,
};

describe('StepReview', () => {
  it('shows the whole record including the points rationale and the sources', () => {
    render(<StepReview draft={ENRICHED_DRAFT} submitting={false} onSubmit={vi.fn()} />);

    expect(screen.getByDisplayValue('Sprint')).toBeInTheDocument();
    expect(screen.getByText(/procesní manuál/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /goodreads/i })).toBeInTheDocument();
  });

  it('states that a coach reviews it and gets an email', () => {
    render(<StepReview draft={ENRICHED_DRAFT} submitting={false} onSubmit={vi.fn()} />);

    expect(screen.getByText(/kouč/i)).toBeInTheDocument();
    expect(screen.getByText(/e-mail/i)).toBeInTheDocument();
  });

  it('submits the edited record with points and rationale', async () => {
    const onSubmit = vi.fn();
    render(<StepReview draft={ENRICHED_DRAFT} submitting={false} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: /odeslat/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sprint',
        title_en: 'Sprint',
        author: 'Jake Knapp',
        page_count: 288,
        book_points: 2,
        points_reason: 'Kategorie 2 — procesní manuál, 288 stran.',
        tags: ['Inovace & kreativita'],
        source: 'google_books',
        preview_link: 'https://books.google.com/x',
      }),
    );
  });

  it('forwards the remote cover URL unchanged rather than downloading it', async () => {
    const onSubmit = vi.fn();
    const withCover: AddBookDraft = {
      ...ENRICHED_DRAFT,
      candidate: { ...CANDIDATE, cover_url: 'https://books.google.com/cover.jpg' },
    };
    render(<StepReview draft={withCover} submitting={false} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: /odeslat/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ google_books_cover_url: 'https://books.google.com/cover.jpg' }),
    );
  });

  it('blocks submission until description and tag are filled in manual mode', async () => {
    render(<StepReview draft={MANUAL_DRAFT} submitting={false} onSubmit={vi.fn()} />);

    expect(screen.getByRole('button', { name: /odeslat/i })).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/popis/i), 'Proč to číst: naučíš se…');
    await userEvent.selectOptions(screen.getByLabelText(/oblast/i), 'Leadership');

    expect(screen.getByRole('button', { name: /odeslat/i })).toBeEnabled();
  });

  it('blocks submission when the title is cleared', async () => {
    render(<StepReview draft={ENRICHED_DRAFT} submitting={false} onSubmit={vi.fn()} />);

    await userEvent.clear(screen.getByLabelText(/český název/i));

    expect(screen.getByRole('button', { name: /odeslat/i })).toBeDisabled();
  });

  it('warns about unverified fields when confidence is low', () => {
    render(
      <StepReview
        draft={{ ...ENRICHED_DRAFT, enriched: { ...ENRICHED_DRAFT.enriched!, confidence: 'low' } }}
        submitting={false}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText(/zkontroluj/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:component -- step-review`
Expected: FAIL — `Cannot find module './step-review'`.

- [ ] **Step 3: Write the component**

Create `src/components/books/add-book/step-review.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { AlertTriangle, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { BOOK_POINT_CATEGORIES } from '@/lib/books/enrichment/rubric';
import { BOOK_CATEGORIES, type CreateBookInput } from '@/lib/books/types';

import type { AddBookDraft } from './types';

const DESCRIPTION_ROWS = 6;

interface StepReviewProps {
  draft: AddBookDraft;
  submitting: boolean;
  onSubmit: (input: CreateBookInput) => void;
}

export function StepReview({ draft, submitting, onSubmit }: StepReviewProps) {
  const { candidate, enriched } = draft;

  const [titleCs, setTitleCs] = useState(enriched?.title_cs ?? candidate?.title ?? '');
  const [titleEn, setTitleEn] = useState(enriched?.title_en ?? '');
  const [author, setAuthor] = useState(enriched?.author ?? candidate?.author ?? '');
  const [description, setDescription] = useState(enriched?.description ?? '');
  const [tag, setTag] = useState(enriched?.tag ?? '');
  const [points, setPoints] = useState<1 | 2 | 3 | null>(enriched?.suggested_points ?? null);
  const [pageCount, setPageCount] = useState(
    String(enriched?.page_count ?? candidate?.page_count ?? ''),
  );

  const ready =
    titleCs.trim().length > 0 &&
    author.trim().length > 0 &&
    description.trim().length > 0 &&
    tag.length > 0 &&
    points !== null;

  const handleSubmit = () => {
    onSubmit({
      title: titleCs.trim(),
      title_en: titleEn.trim() || null,
      author: author.trim(),
      isbn_13: enriched?.isbn_13 ?? candidate?.isbn_13 ?? undefined,
      description: description.trim(),
      page_count: pageCount ? Number.parseInt(pageCount, 10) : null,
      preview_link: candidate?.preview_link ?? null,
      // Stored as-is; covers are not downloaded into our storage.
      google_books_cover_url: candidate?.cover_url ?? null,
      book_points: points,
      points_reason: enriched?.points_reason ?? null,
      tags: [tag],
      source: candidate?.source ?? 'manual',
      // Manual candidates carry no external id; send undefined, not ''.
      external_id: candidate?.external_id ? candidate.external_id : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Zkontroluj a odešli</h2>
        <p className="text-sm text-muted-foreground">
          Tohle se uloží do BOBa. Cokoli můžeš přepsat.
        </p>
      </div>

      {enriched?.confidence === 'low' && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300/50 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm">
            U některých údajů si nejsme jistí — zkontroluj je prosím, než knihu odešleš.
          </p>
        </div>
      )}

      <div className="space-y-4 rounded-xl border bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="review-title-cs">Český název</Label>
            <Input id="review-title-cs" value={titleCs} onChange={(e) => setTitleCs(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="review-title-en">Anglický název</Label>
            <Input id="review-title-en" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="review-author">Autor</Label>
            <Input id="review-author" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="review-pages">Počet stran</Label>
            <Input
              id="review-pages"
              inputMode="numeric"
              value={pageCount}
              onChange={(e) => setPageCount(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="review-description">Popis — proč to číst</Label>
          <Textarea
            id="review-description"
            rows={DESCRIPTION_ROWS}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Co si Téčko z knihy odnese, a co ho může od čtení odradit."
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="review-tag">Oblast</Label>
          <select
            id="review-tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="focus-ring h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Vyber oblast…</option>
            {BOOK_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Knižní body</legend>
          <div className="flex flex-wrap gap-2">
            {BOOK_POINT_CATEGORIES.map((category) => (
              <Button
                key={category.points}
                type="button"
                variant={points === category.points ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPoints(category.points)}
              >
                {category.points} b. — {category.name}
              </Button>
            ))}
          </div>
          {enriched?.points_reason && (
            <p className="text-sm text-muted-foreground italic">{enriched.points_reason}</p>
          )}
        </fieldset>
      </div>

      {draft.citations.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Zdroje
          </h3>
          <ul className="space-y-0.5 text-sm">
            {draft.citations.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2 rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
        <p>Kniha půjde ke schválení kouči. Bodové hodnocení je návrh — kouč ho může změnit.</p>
        <p>Tvému kouči odejde e-mail.</p>
      </div>

      <Button disabled={!ready || submitting} onClick={handleSubmit} className="w-full gap-2 sm:w-auto">
        {submitting ? <Spinner className="size-4" /> : <Send className="size-4" />}
        Odeslat ke schválení
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:component -- step-review`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/books/add-book/step-review.tsx src/components/books/add-book/step-review.test.tsx
git commit -m "feat(books): add the checkout step with an editable, gated record"
```

---

## Task 13: The flow container and the page

**Files:**
- Create: `src/components/books/add-book/add-book-flow.tsx`
- Test: `src/components/books/add-book/add-book-flow.test.tsx`
- Modify: `src/app/(main)/cteni/knihy/nova/page.tsx`
- Delete: `src/components/books/add-book-wizard.tsx`

**Interfaces:**
- Consumes: all four step components, `AddBookDraft` / `EMPTY_DRAFT` (Task 9).
- Produces: `AddBookFlow` — props `{ initialQuery: string; returnTo: string | null }`

- [ ] **Step 1: Write the failing test**

Create `src/components/books/add-book/add-book-flow.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { AddBookFlow } from './add-book-flow';

beforeEach(() => {
  push.mockReset();
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AddBookFlow', () => {
  it('starts on the gate and does not search until it is affirmed', async () => {
    render(<AddBookFlow initialQuery="sprint" returnTo={null} />);

    expect(screen.getByRole('heading', { name: /patří ta kniha do boba/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/najdi knihu/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /chci přidat/i }));

    expect(await screen.findByLabelText(/najdi knihu/i)).toBeInTheDocument();
  });

  it('restores a draft from sessionStorage instead of starting over', async () => {
    sessionStorage.setItem(
      'tappka:add-book-draft',
      JSON.stringify({
        step: 'review',
        draft: {
          candidate: {
            title: 'Sprint',
            author: 'Jake Knapp',
            isbn_13: null,
            description: null,
            cover_url: null,
            page_count: 288,
            publisher: null,
            published_year: null,
            preview_link: null,
            source: 'google_books',
            external_id: 'vol-1',
          },
          enriched: null,
          citations: [],
          manual: true,
        },
      }),
    );

    render(<AddBookFlow initialQuery="" returnTo={null} />);

    expect(await screen.findByLabelText(/český název/i)).toHaveValue('Sprint');
  });

  it('navigates to the existing book when the API reports a duplicate', async () => {
    sessionStorage.setItem(
      'tappka:add-book-draft',
      JSON.stringify({
        step: 'review',
        draft: {
          candidate: null,
          enriched: {
            title_cs: 'Sprint',
            title_en: null,
            author: 'Jake Knapp',
            isbn_13: null,
            page_count: 288,
            description: 'Naučíš se…',
            tag: 'Leadership',
            suggested_points: 2,
            points_reason: 'Kategorie 2.',
            confidence: 'high',
          },
          citations: [],
          manual: false,
        },
      }),
    );

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Tato kniha již existuje v katalogu', existingId: 'dup-1' }),
    }));

    render(<AddBookFlow initialQuery="" returnTo={null} />);
    await userEvent.click(await screen.findByRole('button', { name: /odeslat/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/cteni/knihy/dup-1'));
  });

  it('returns to the essay editor with the new book preselected', async () => {
    sessionStorage.setItem(
      'tappka:add-book-draft',
      JSON.stringify({
        step: 'review',
        draft: {
          candidate: null,
          enriched: {
            title_cs: 'Sprint',
            title_en: null,
            author: 'Jake Knapp',
            isbn_13: null,
            page_count: 288,
            description: 'Naučíš se…',
            tag: 'Leadership',
            suggested_points: 2,
            points_reason: 'Kategorie 2.',
            confidence: 'high',
          },
          citations: [],
          manual: false,
        },
      }),
    );

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'new-1' } }),
    }));

    render(<AddBookFlow initialQuery="" returnTo="/cteni/eseje/e1/upravit" />);
    await userEvent.click(await screen.findByRole('button', { name: /odeslat/i }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/cteni/eseje/e1/upravit?book=new-1'),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:component -- add-book-flow`
Expected: FAIL — `Cannot find module './add-book-flow'`.

- [ ] **Step 3: Write the container**

Create `src/components/books/add-book/add-book-flow.tsx`:

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import type { CreateBookInput, ExternalBookCandidate } from '@/lib/books/types';
import type { EnrichedBook } from '@/lib/books/enrichment/schema';

import { StepEnriching } from './step-enriching';
import { StepGate } from './step-gate';
import { StepReview } from './step-review';
import { StepSearch } from './step-search';
import { EMPTY_DRAFT, type AddBookDraft } from './types';

const DRAFT_STORAGE_KEY = 'tappka:add-book-draft';

type Step = 'gate' | 'search' | 'enriching' | 'review';

const STEP_LABELS: Record<Step, string> = {
  gate: 'Patří do BOBa?',
  search: 'Najdi knihu',
  enriching: 'Doplňujeme údaje',
  review: 'Zkontroluj a odešli',
};

const STEP_ORDER: Step[] = ['gate', 'search', 'enriching', 'review'];

interface PersistedFlow {
  step: Step;
  draft: AddBookDraft;
}

function readPersisted(): PersistedFlow | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedFlow;
  } catch {
    return null;
  }
}

interface AddBookFlowProps {
  initialQuery: string;
  /** Where to go after a successful submit; the new book id is appended as `?book=`. */
  returnTo: string | null;
}

export function AddBookFlow({ initialQuery, returnTo }: AddBookFlowProps) {
  const router = useRouter();
  const persisted = readPersisted();

  const [step, setStep] = useState<Step>(persisted?.step ?? 'gate');
  const [draft, setDraft] = useState<AddBookDraft>(persisted?.draft ?? EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);

  // Survive a refresh so an enrichment already paid for is not thrown away.
  useEffect(() => {
    if (step === 'gate') {
      window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ step, draft }));
  }, [step, draft]);

  const handleSelect = useCallback((candidate: ExternalBookCandidate) => {
    setDraft({ ...EMPTY_DRAFT, candidate });
    setStep('enriching');
  }, []);

  const handleManualCandidate = useCallback((title: string, author: string) => {
    setDraft({
      ...EMPTY_DRAFT,
      candidate: {
        title,
        author,
        isbn_13: null,
        description: null,
        cover_url: null,
        page_count: null,
        publisher: null,
        published_year: null,
        preview_link: null,
        source: 'manual',
        external_id: '',
      },
    });
    setStep('enriching');
  }, []);

  const handleEnriched = useCallback((enriched: EnrichedBook, citations: string[]) => {
    setDraft((current) => ({ ...current, enriched, citations, manual: false }));
    setStep('review');
  }, []);

  const handleFillManually = useCallback(() => {
    setDraft((current) => ({ ...current, enriched: null, citations: [], manual: true }));
    setStep('review');
  }, []);

  const handleSubmit = useCallback(
    async (input: CreateBookInput) => {
      setSubmitting(true);
      try {
        const res = await fetch('/api/books', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const json = await res.json();

        if (res.status === 409 && json.existingId) {
          toast.info('Tuhle knihu už v BOBovi máme.');
          window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
          router.push(`/cteni/knihy/${json.existingId}`);
          return;
        }

        if (!res.ok || !json.data?.id) {
          // Never report a save the database refused.
          toast.error(json.error ?? 'Knihu se nepodařilo uložit.');
          return;
        }

        window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        toast.success('Kniha odeslána ke schválení.');
        router.push(
          returnTo ? `${returnTo}?book=${json.data.id}` : `/cteni/knihy/${json.data.id}`,
        );
      } catch {
        toast.error('Nepodařilo se připojit k serveru.');
      } finally {
        setSubmitting(false);
      }
    },
    [returnTo, router],
  );

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {STEP_ORDER.map((candidateStep, index) => (
          <li
            key={candidateStep}
            aria-current={candidateStep === step ? 'step' : undefined}
            className={cn(
              'flex items-center gap-1.5',
              candidateStep === step ? 'font-semibold text-foreground' : 'text-muted-foreground',
            )}
          >
            <span className="tabular-nums">{index + 1}.</span>
            {STEP_LABELS[candidateStep]}
          </li>
        ))}
      </ol>

      {step === 'gate' && <StepGate onContinue={() => setStep('search')} />}

      {step === 'search' && (
        <StepSearch
          initialQuery={initialQuery}
          onSelect={handleSelect}
          onManual={handleManualCandidate}
        />
      )}

      {step === 'enriching' && draft.candidate && (
        <StepEnriching
          probe={{
            title: draft.candidate.title,
            author: draft.candidate.author,
            isbn_13: draft.candidate.isbn_13,
            page_count: draft.candidate.page_count,
            publisher: draft.candidate.publisher,
            published_year: draft.candidate.published_year,
          }}
          onDone={handleEnriched}
          onManual={handleFillManually}
        />
      )}

      {step === 'review' && (
        <StepReview draft={draft} submitting={submitting} onSubmit={handleSubmit} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rewrite the page**

Replace `src/app/(main)/cteni/knihy/nova/page.tsx` entirely:

```typescript
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/ui/page-shell';
import { AddBookFlow } from '@/components/books/add-book/add-book-flow';

interface NovaKnihaPageProps {
  searchParams: Promise<{ q?: string; from?: string; essayId?: string }>;
}

export default async function NovaKnihaPage({ searchParams }: NovaKnihaPageProps) {
  const { q, from, essayId } = await searchParams;

  const cameFromEssay = from === 'esej' && Boolean(essayId);
  const backHref = cameFromEssay ? `/cteni/eseje/${essayId}/upravit` : '/cteni/hledat';
  const backLabel = cameFromEssay ? 'Zpět k eseji' : 'Zpět do hledání';

  return (
    <PageShell size="narrow">
      <Button variant="ghost" asChild className="gap-2">
        <Link href={backHref}>
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
      </Button>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Přidat knihu do BOBa</h1>
        <p className="text-sm text-muted-foreground">
          Projdeme to spolu ve čtyřech krocích. Kouč knihu nakonec schválí a přidělí body.
        </p>
      </div>

      <AddBookFlow
        initialQuery={q ?? ''}
        returnTo={cameFromEssay ? `/cteni/eseje/${essayId}/upravit` : null}
      />
    </PageShell>
  );
}
```

Confirm the `searchParams` shape against another route in this codebase that reads it — Next.js versions differ on whether it is a promise.

- [ ] **Step 5: Delete the old wizard**

```bash
git rm src/components/books/add-book-wizard.tsx
```

- [ ] **Step 6: Verify**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS. Typecheck will fail if anything still imports `AddBookWizard` — fix the importer.

- [ ] **Step 7: Commit**

```bash
git add -A src/components/books/add-book/ src/app/\(main\)/cteni/knihy/nova/page.tsx
git commit -m "feat(books): rebuild /cteni/knihy/nova as a four-step flow"
```

---

## Task 14: The shared entry point

**Files:**
- Create: `src/components/books/book-not-found-card.tsx`
- Test: `src/components/books/book-not-found-card.test.tsx`
- Modify: `src/components/search/search-page-client.tsx`
- Modify: `src/components/essays/essay-editor-form.tsx`

**Interfaces:**
- Produces: `BookNotFoundCard` — props `{ query: string; from: 'hledat' | 'esej'; essayId?: string }`

- [ ] **Step 1: Write the failing test**

Create `src/components/books/book-not-found-card.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BookNotFoundCard } from './book-not-found-card';

describe('BookNotFoundCard', () => {
  it('links to the flow carrying the query and the search context', () => {
    render(<BookNotFoundCard query="atomic habits" from="hledat" />);

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/cteni/knihy/nova?q=atomic+habits&from=hledat',
    );
  });

  it('carries the essay id when opened from the editor', () => {
    render(<BookNotFoundCard query="sprint" from="esej" essayId="e1" />);

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/cteni/knihy/nova?q=sprint&from=esej&essayId=e1',
    );
  });

  it('works with an empty query', () => {
    render(<BookNotFoundCard query="" from="hledat" />);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/cteni/knihy/nova?from=hledat');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:component -- book-not-found-card`
Expected: FAIL — `Cannot find module './book-not-found-card'`.

- [ ] **Step 3: Write the component**

Create `src/components/books/book-not-found-card.tsx`:

```typescript
import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';

interface BookNotFoundCardProps {
  query: string;
  from: 'hledat' | 'esej';
  essayId?: string;
}

export function BookNotFoundCard({ query, from, essayId }: BookNotFoundCardProps) {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  params.set('from', from);
  if (essayId) params.set('essayId', essayId);

  return (
    <Link
      href={`/cteni/knihy/nova?${params.toString()}`}
      className="focus-ring group flex items-center gap-3 rounded-xl border border-dashed bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/50"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Plus className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">Nenašel jsi knihu?</span>
        <span className="block text-xs text-muted-foreground">
          Najdi ji mimo katalog a přidej do BOBa.
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:component -- book-not-found-card`
Expected: PASS (3 tests).

- [ ] **Step 5: Mount it in the global search**

In `src/components/search/search-page-client.tsx`, `SearchResultsView` needs the query, which it does not currently receive. Change its signature and its call site:

```typescript
function SearchResultsView({
  essays, books, query,
}: { essays: EssayWithVoted[]; books: BookResult[]; query: string }) {
```

Call site (around line 160):

```typescript
            <SearchResultsView essays={results.essays} books={results.books} query={query} />
```

Add the import, then render the card in both the empty state and after the book list:

```typescript
  if (essays.length === 0 && books.length === 0) {
    return (
      <div className="space-y-4">
        <div className="space-y-2 py-12 text-center">
          <Search className="mx-auto size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Žádné výsledky</p>
        </div>
        <BookNotFoundCard query={query} from="hledat" />
      </div>
    );
  }
```

And immediately after the `</section>` that closes the books block:

```typescript
      <BookNotFoundCard query={query} from="hledat" />
```

- [ ] **Step 6: Mount it in the essay editor**

In `src/components/essays/essay-editor-form.tsx`, inside the no-book-selected branch, replace the closing hint paragraph (`Píšeš o něčem mimo seznam? …`) with that paragraph **plus** the card, so both routes are offered:

```typescript
                <p className="text-xs text-muted-foreground">
                  Píšeš o něčem mimo seznam? Nech pole prázdné — esej se počítá jako četba nad
                  rámec.
                </p>

                {essayId && <BookNotFoundCard query={bookQuery} from="esej" essayId={essayId} />}
```

- [ ] **Step 7: Verify and commit**

Run: `pnpm test && pnpm typecheck`

```bash
git add src/components/books/book-not-found-card.tsx src/components/books/book-not-found-card.test.tsx src/components/search/search-page-client.tsx src/components/essays/essay-editor-form.tsx
git commit -m "feat(books): offer adding a missing book from both search surfaces"
```

---

## Task 15: Preselect the new book in the essay editor

`AddBookFlow` already pushes `?book=<id>`; nothing consumes it yet.

**Files:**
- Modify: `src/components/essays/essay-editor-form.tsx`
- Test: `src/components/essays/essay-editor-form.test.tsx` (create if absent)

**Interfaces:**
- Consumes: the `?book=<id>` query param written by `AddBookFlow` (Task 13).

- [ ] **Step 1: Write the failing test**

Add to `src/components/essays/essay-editor-form.test.tsx` (create the file with the imports the other component tests use if it does not exist):

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const searchParams = new URLSearchParams('book=new-1');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => searchParams,
}));

import { EssayEditorForm } from './essay-editor-form';

describe('EssayEditorForm book preselect', () => {
  it('selects the book named in ?book= after returning from the add-book flow', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'new-1',
          title_cs: 'Sprint',
          author: 'Jake Knapp',
          book_points: 2,
          list_status: 'processing',
          is_rocket_model: false,
          google_books_cover_url: null,
          highlight_category: null,
        },
      }),
    }));

    render(<EssayEditorForm essayId="e1" initialEssay={null} />);

    await waitFor(() => expect(screen.getByText('Sprint')).toBeInTheDocument());
  });
});
```

Match the real `EssayEditorForm` props — open the file and use its actual required props rather than the placeholder above.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:component -- essay-editor-form`
Expected: FAIL — no book is rendered, because nothing reads the param.

- [ ] **Step 3: Consume the param**

In `src/components/essays/essay-editor-form.tsx`, add `useSearchParams` and an effect that runs once when no book is selected:

```typescript
  const searchParams = useSearchParams();
  const preselectBookId = searchParams.get('book');

  // Returning from /cteni/knihy/nova: attach the book the author just created.
  useEffect(() => {
    if (!preselectBookId || selectedBook) return;

    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/books/${preselectBookId}`);
      if (!res.ok) return;
      const { data } = await res.json();
      if (!cancelled && data) handleBookChange(data as BookSearchResult);
    })();

    return () => {
      cancelled = true;
    };
  }, [preselectBookId, selectedBook, handleBookChange]);
```

If `handleBookChange` is not already stable, wrap it in `useCallback` first. Confirm `GET /api/books/[id]` exists and returns `{ data }`; if it does not, add that handler to `src/app/api/books/[id]/route.ts` following the shape of the existing PATCH in that file.

- [ ] **Step 4: Verify and commit**

Run: `pnpm test && pnpm typecheck`

```bash
git add src/components/essays/essay-editor-form.tsx src/components/essays/essay-editor-form.test.tsx
git commit -m "feat(essays): attach the freshly added book when returning to the editor"
```

---

## Task 16: Coach re-run of enrichment

Covers books submitted while Perplexity was down. Nothing tracks which those are — the coach re-runs on demand.

**Files:**
- Modify: `src/components/books/coach-book-row.tsx`
- Test: `src/components/books/coach-book-row.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `POST /api/books/enrich` (Task 7), `PATCH /api/books/[id]` `action: 'edit'` (existing, at `src/app/api/books/[id]/route.ts:145`).

- [ ] **Step 1: Write the failing test**

Create `src/components/books/coach-book-row.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CoachBookRow } from './coach-book-row';

afterEach(() => {
  vi.unstubAllGlobals();
});

// Fill in the remaining required fields by reading the component's props type.
const PROCESSING_BOOK = {
  id: 'b1',
  title_cs: 'Sprint',
  title_en: null,
  author: 'Jake Knapp',
  description: null,
  book_points: null,
  list_status: 'processing',
  page_count: 288,
} as never;

describe('CoachBookRow re-enrichment', () => {
  it('offers re-running enrichment on a processing book', () => {
    render(<CoachBookRow book={PROCESSING_BOOK} />);

    expect(screen.getByRole('button', { name: /dohledat údaje/i })).toBeInTheDocument();
  });

  it('writes the fresh description and points back to the book', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            title_cs: 'Sprint',
            title_en: 'Sprint',
            author: 'Jake Knapp',
            isbn_13: null,
            page_count: 288,
            description: 'Naučíš se otestovat nápad.',
            tag: 'Inovace & kreativita',
            suggested_points: 2,
            points_reason: 'Kategorie 2 — 288 stran.',
            confidence: 'high',
          },
          citations: [],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) });
    vi.stubGlobal('fetch', fetchMock);

    render(<CoachBookRow book={PROCESSING_BOOK} />);
    await userEvent.click(screen.getByRole('button', { name: /dohledat údaje/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/books/b1');
    expect(JSON.parse(init.body as string)).toMatchObject({
      action: 'edit',
      description: 'Naučíš se otestovat nápad.',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:component -- coach-book-row`
Expected: FAIL — no such button.

- [ ] **Step 3: Add the action**

Read `src/components/books/coach-book-row.tsx` first and follow its existing prop and state conventions. Add a button, shown only when `book.list_status === 'processing'`, that calls `/api/books/enrich` with the book's title/author/page count, then PATCHes the result back with `action: 'edit'`. Surface failure with `toast.error` and success with `toast.success`. Confirm which fields the `edit` action accepts by reading `src/app/api/books/[id]/route.ts:145` and send only those.

- [ ] **Step 4: Verify and commit**

Run: `pnpm test && pnpm typecheck`

```bash
git add src/components/books/coach-book-row.tsx src/components/books/coach-book-row.test.tsx
git commit -m "feat(books): let a coach re-run enrichment on a pending book"
```

---

## Task 17: End-to-end coverage

**Files:**
- Create: `tests/e2e/add-book.spec.ts`

- [ ] **Step 1: Read an existing spec for the auth helper**

```bash
ls tests/e2e/ && head -40 tests/e2e/*.spec.ts | head -60
```

Reuse whatever login/storage-state helper the existing specs use. Do not invent a new auth path.

- [ ] **Step 2: Write the spec**

Create `tests/e2e/add-book.spec.ts`. Stub both network boundaries so the test is deterministic and never spends money:

```typescript
import { expect, test } from '@playwright/test';

const ENRICHED = {
  data: {
    title_cs: 'Sprint',
    title_en: 'Sprint',
    author: 'Jake Knapp',
    isbn_13: '9781501121746',
    page_count: 288,
    description: 'Naučíš se otestovat nápad za pět dní. Je to hutné a procesní.',
    tag: 'Inovace & kreativita',
    suggested_points: 2,
    points_reason: 'Kategorie 2 — procesní manuál s frameworky, 288 stran.',
    confidence: 'high',
  },
  citations: ['https://www.goodreads.com/book/show/35019409-sprint'],
};

test.describe('adding a book', () => {
  test('gate → search → enrichment → checkout → submitted', async ({ page }) => {
    await page.route('**/api/books/external-search**', (route) =>
      route.fulfill({
        json: {
          data: [{
            title: 'Sprint',
            author: 'Jake Knapp',
            isbn_13: '9781501121746',
            description: null,
            cover_url: null,
            page_count: 288,
            publisher: 'Simon & Schuster',
            published_year: 2016,
            preview_link: null,
            source: 'google_books',
            external_id: 'vol-1',
          }],
        },
      }),
    );
    await page.route('**/api/books/enrich', (route) => route.fulfill({ json: ENRICHED }));

    await page.goto('/cteni/knihy/nova?q=sprint&from=hledat');

    // Krok 1 — the gate must be affirmed before search appears.
    await expect(page.getByText(/do BOBa naopak nepatří/i)).toBeVisible();
    await page.getByRole('button', { name: /chci přidat/i }).click();

    // Krok 2 — the candidate card carries the metadata the rubric needs.
    await expect(page.getByText('288')).toBeVisible();
    await page.getByRole('button', { name: /vybrat/i }).click();

    // Krok 4 — the enriched record, editable.
    await expect(page.getByLabel(/český název/i)).toHaveValue('Sprint');
    await expect(page.getByText(/procesní manuál/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /2 b\./i })).toBeVisible();

    await page.getByRole('button', { name: /odeslat ke schválení/i }).click();

    await expect(page.getByText(/odeslána ke schválení/i)).toBeVisible();
    await expect(page).toHaveURL(/\/cteni\/knihy\/[0-9a-f-]{36}$/);
  });

  test('submits a co-authored book without a server error', async ({ page }) => {
    // Regression guard for the duplicate-check query. `ExternalBookCandidate.author`
    // is built as `authors.join(', ')`, and a comma is the clause separator inside a
    // PostgREST `or` filter — an interpolated `or` string 500s on every co-authored
    // book. Task 2's unit tests cover findDuplicate's matching but cannot see the
    // route's query, so the guard has to live here.
    await page.route('**/api/books/external-search**', (route) =>
      route.fulfill({
        json: {
          data: [{
            title: 'Sprint',
            author: 'Jake Knapp, John Zeratsky, Braden Kowitz',
            isbn_13: '9781501121746',
            description: null,
            cover_url: null,
            page_count: 288,
            publisher: 'Simon & Schuster',
            published_year: 2016,
            preview_link: null,
            source: 'google_books',
            external_id: 'vol-1',
          }],
        },
      }),
    );
    await page.route('**/api/books/enrich', (route) =>
      route.fulfill({
        json: {
          ...ENRICHED,
          data: { ...ENRICHED.data, author: 'Jake Knapp, John Zeratsky, Braden Kowitz' },
        },
      }),
    );

    const createResponses: number[] = [];
    page.on('response', (response) => {
      if (response.url().endsWith('/api/books') && response.request().method() === 'POST') {
        createResponses.push(response.status());
      }
    });

    await page.goto('/cteni/knihy/nova?q=sprint&from=hledat');
    await page.getByRole('button', { name: /chci přidat/i }).click();
    await page.getByRole('button', { name: /vybrat/i }).click();
    await expect(page.getByLabel(/autor/i)).toHaveValue(/Zeratsky/);
    await page.getByRole('button', { name: /odeslat ke schválení/i }).click();

    await expect(page.getByText(/odeslána ke schválení/i)).toBeVisible();
    // 201 created, or 409 if a prior run already added it — never 500.
    expect(createResponses.every((status) => status !== 500)).toBe(true);
  });

  test('falls back to manual entry when enrichment is unavailable', async ({ page }) => {
    await page.route('**/api/books/external-search**', (route) =>
      route.fulfill({ json: { data: [] } }),
    );
    await page.route('**/api/books/enrich', (route) =>
      route.fulfill({ status: 503, json: { error: 'Perplexity teď neodpovídá.' } }),
    );

    await page.goto('/cteni/knihy/nova?from=hledat');
    await page.getByRole('button', { name: /chci přidat/i }).click();

    await page.getByRole('button', { name: /zadat ručně/i }).click();
    await page.getByLabel(/^název$/i).fill('Tiimiakatemia');
    await page.getByLabel(/^autor$/i).fill('Johannes Partanen');
    await page.getByRole('button', { name: /pokračovat/i }).click();

    await expect(page.getByText(/neodpovídá/i)).toBeVisible();
    await page.getByRole('button', { name: /vyplnit ručně/i }).click();

    // The record is still completable by hand, and still gated.
    const submit = page.getByRole('button', { name: /odeslat ke schválení/i });
    await expect(submit).toBeDisabled();

    await page.getByLabel(/popis/i).fill('Naučíš se, jak funguje týmové podnikání na Tiimi.');
    await page.getByLabel(/oblast/i).selectOption('Leadership');
    await page.getByRole('button', { name: /1 b\./i }).click();

    await expect(submit).toBeEnabled();
  });
});
```

- [ ] **Step 3: Run it**

Run: `pnpm test:e2e -- add-book`
Expected: PASS. If the first test's final URL assertion fails, check what `AddBookFlow` pushes when `returnTo` is null and match it.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/add-book.spec.ts
git commit -m "test(books): cover the add-book flow and its manual fallback end to end"
```

---

## Task 18: Documentation and final verification

**Files:**
- Modify: `docs/reading-feature.md`
- Modify: `docs/superpowers/specs/2026-08-10-add-book-flow-design.md` (status line)

- [ ] **Step 1: Document the flow**

Open `docs/reading-feature.md`, find where the book lifecycle is described, and add a short section covering: the four steps, that enrichment is Perplexity and optional, that `list_status_reason` carries the AI's scoring rationale until a coach replaces it, that a bulk re-score must restrict itself to `list_status = 'processing'`, and that `PERPLEXITY_API_KEY` needs a spend limit set on the Perplexity account.

- [ ] **Step 2: Mark the spec implemented**

Change the spec's `**Status:**` line from `Approved design` to `Implemented`.

- [ ] **Step 3: Full verification**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm test:integration && pnpm test:e2e
```

Expected: all pass. Do not claim completion on a partial run — if a layer fails, fix it before committing.

- [ ] **Step 4: Confirm nothing touched the schema**

```bash
git diff --stat production... -- db/schema supabase/migrations
```

Expected: **empty output.** Any change here violates the plan's core constraint — revert it.

- [ ] **Step 5: Commit**

```bash
git add docs/
git commit -m "docs(books): document the add-book flow and mark the spec implemented"
```

---

## Self-Review Notes

Checked against the spec:

- Entry point in both surfaces → Task 14. Four steps → Tasks 9–13. Duplicate detection → Task 2. Perplexity with `response_format`, domain and language filters → Task 6. Rubric with both overrides and the extent correction → Task 4. Manual fallback → Tasks 11, 12, 17. Circuit breaker → Task 6. In-process guard + account limit → Tasks 6, 7, 18. Both emails with the `beta_access_granted_at` gate → Task 8. Return to the essay editor → Tasks 13, 15. Coach re-run → Task 16. No-migration constraint → verified explicitly in Task 18 Step 4.
- Two deviations from a naive reading of the spec, both noted inline: `page_count` is persisted while `publisher`/`published_year` are display-only (no columns exist), and the duplicate check fetches by author then matches in code so `title_en` participates.

Four places where the plan deliberately tells the implementer to verify against the codebase
rather than trusting a snippet, because guessing would produce plausible-but-wrong code:

| Where | What to check |
| --- | --- |
| Task 6 Step 1 | The Perplexity SDK's exported client name, from the installed `index.d.ts`. |
| Task 10 Step 5 | `BarcodeScanner` props, copied from `library-import-scanner.tsx`. |
| Task 13 Step 4 | Whether this Next.js version's `searchParams` is a promise. |
| Task 15 Step 3 | That `GET /api/books/[id]` exists and returns `{ data }`; add it if not. |
