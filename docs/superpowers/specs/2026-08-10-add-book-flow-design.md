# Přidání knihy do BOBa: gate, Perplexity enrichment, checkout

**Date:** 2026-08-10
**Status:** Approved design
**Touches:** `src/app/(main)/cteni/knihy/nova/**`, `src/components/books/**`, `src/components/search/search-page-client.tsx`, `src/components/essays/essay-editor-form.tsx`, `src/lib/books/**`, `src/lib/notifications/**`, `src/app/api/books/**`, `db/schema/books.ts`, `db/schema/notification-preferences.ts`

## Problem

There are two places a user searches for a book, and neither offers a way to add one that
isn't there:

- `/cteni/hledat` — the global search. `SearchResultsView`
  (`src/components/search/search-page-client.tsx:581`) renders "Žádné výsledky" and stops.
- The essay editor's book picker (`src/components/essays/essay-editor-form.tsx:381`) — it
  tells the author to leave the field blank and have the essay count as *četba nad rámec*,
  which silently costs them BookPoints.

The add flow that does exist, `AddBookWizard` at `/cteni/knihy/nova`, produces low-quality
records. It has no covers in results, searches only on a button press, shares one tag
selection across every result card, fails silently on error, and never populates
`page_count`, `preview_link`, or `title_en` even though all three columns exist. The last of
those is why the same book appears three times in Czech, English and Slovak and gets scored
differently each time.

Separately, coaches score books by hand against a written rubric (Petr's *Kategorie pro
bodování knih*, revised 2026-06-02). Nothing in the app knows that rubric exists, so the
scoring lives entirely in a coach's head and a spreadsheet.

## Decisions

| Question | Decision |
| --- | --- |
| Where is the entry point? | One shared component mounted in both search surfaces. |
| Modal or page? | A page. Clicking it navigates to `/cteni/knihy/nova`. |
| Is there a gate before searching? | Yes — a read-and-affirm screen on what belongs in BOBa. Not a checkbox list. |
| Who enriches the record? | Perplexity `sonar-pro`, web-grounded, server-side only. |
| Where does the AI's score live? | Directly in `books.book_points`, with `books.points_reason`. The coach overrides with the existing `PointsDialog`. |
| What protects a coach's override? | A nullable `points_confirmed_by_profile_id`, set when a coach saves points. A future bulk re-score skips those rows. |
| What if Perplexity is down? | Manual completion is a first-class path, not an error state. Submission is always completable. |
| Who is emailed on submit? | The submitter's team coach(es); all coaches if their team has none. |
| Who is emailed on decision? | `books.created_by_profile_id`, with the coach's reason. |
| Who may add a book? | Any authenticated user. Unchanged — existing RLS insert policy already scopes to `created_by_profile_id = current_profile_id()`. |

### Explicitly out of scope

These came up in the same source conversation and are **not** part of this work:

- Per-category point ceilings (max 30b from Kategorie 1; the ~20b cap on general-interest
  titles like *Sapiens*). This is a portfolio/limits feature, and the principle behind it is
  still contested.
- TOP BOB / shortlist / longlist curation and the bulk archivace pass.
- Esejbanka feedback (coach statistics, wandercoaching cross-team views, essay ratings).

## Flow

Four steps at `/cteni/knihy/nova`, `PageShell size="narrow"`, with a persistent step
indicator. The working draft is mirrored to `sessionStorage` so a refresh does not discard an
enrichment already paid for.

### Entry point

A new `BookNotFoundCard` renders at the end of results in both surfaces and links to
`/cteni/knihy/nova?q=<query>&from=<context>`.

From the essay editor the link carries `from=esej&essayId=<id>`. Leaving is safe because the
editor autosaves, and on submit we return to `/cteni/eseje/<id>/upravit?book=<newId>` with the
new book pre-selected. This works with no changes to essay scoring: essays on `processing`
books are already handled — points are held pending review (`src/lib/essays/queries.ts:550`).

### Krok 1 — Patří ta kniha do BOBa?

The self-assessment gate. Three compact cards, one per scoring category, each with a
one-line description and a real example. Below them, the *what does not belong* list, taken
from the 2026-07-27 curation pass: duplicity, ne-knihy, pseudověda, beletrie, rozpor s našimi
hodnotami.

One primary button: *Ano, tuhle knihu tam chci přidat*.

Read-and-affirm rather than a checklist on purpose. A checklist trains people to tick through
it; a page you must read and then affirm is the honest form of the same gate.

### Krok 2 — Najdi knihu

Debounced search hitting the catalogue and Google Books in parallel.

- Catalogue hits render first under **Už v BOBovi**, linking to the book. This dead-ends a
  duplicate before it is ever created.
- External hits render as full cards — cover, author, year, publisher, page count, ISBN.
  A chooser without covers is how the wrong edition gets picked. This requires extending
  `ExternalBookCandidate` and both mappers (`src/lib/books/external/google-books.ts`,
  `open-library.ts`), which today parse only title, author, ISBN-13, description and
  thumbnail — no page count, publisher, year or preview link.
- An ISBN scan button reusing the existing `BarcodeScanner` setup from
  `src/components/library/library-import-scanner.tsx:115`.
- If nothing matches: *Zadat ručně* collects title + author only and drops into Krok 3, so a
  Czech book Google Books has never heard of still becomes a complete record rather than a
  stub.

#### Duplicate detection

The dedupe key is: ISBN-13 when both sides have one, otherwise a normalised match of author
against **either** `title_cs` **or** `title_en`. Normalisation lowercases, strips diacritics,
strips punctuation, and collapses whitespace.

Today's check in `POST /api/books` (`src/app/api/books/route.ts:59`) compares `isbn_13` or
`title_cs` + `author` only, so a Czech record and its English twin do not collide. It must be
extended to consider `title_en` on both sides. Note the existing comment on
`db/schema/books.ts` is deliberate and stays: ISBN identifies an edition, not a work, so there
is no `UNIQUE` constraint — this is an application-level check, not a database one.

### Krok 3 — Doplňujeme údaje

One enrichment call on the selected candidate. Progress state names what it is doing
(*hledám český popis* → *hodnotím podle kritérií*), because this takes 10–30 s and a bare
spinner reads as a hang.

### Krok 4 — Zkontroluj a odešli

The checkout. Everything about to be written, laid out as a record: cover, `title_cs` /
`title_en`, author, ISBN, page count, description, `why_read`, `caveats`, public rating,
tags, and the points with the AI's reasoning quoted. Every field editable inline.

Required to submit: title, author, description, and at least one tag. This is the quality
gate — a partial record cannot be sent for review.

Below the record, stated plainly:

- *Kniha půjde ke schválení kouči. Bodové hodnocení je návrh — kouč ho může změnit.*
- *Tvému kouči odejde e-mail.*

Submit writes the book as `processing` with `book_points` and `points_reason` set, then
notifies the coach.

## Enrichment

### Request

`POST /api/books/enrich`, authenticated. `PERPLEXITY_API_KEY` lives in env and is read only on
the server; it must never reach a client component.

Rate cap: 20 enrichments per profile per rolling hour, counted from a new
`book_enrichment_requests` table (see Data model). It has to be database-backed rather than
in-process — on serverless there is no shared memory between invocations, so an in-memory
counter would reset unpredictably and cap nothing.

Official Perplexity Node SDK, `chat.completions.create`:

| Parameter | Value | Why |
| --- | --- | --- |
| `model` | `sonar-pro`, read from env | Switchable to `sonar-reasoning-pro` without a code change. |
| `response_format` | `{ type: 'json_schema', json_schema: { name, schema } }` | Shape enforced server-side instead of scraped out of prose. |
| `search_domain_filter` | biased to `goodreads.com`, `databazeknih.cz` | This is the Czech-description fallback Petr asked for, done by the search layer rather than by us scraping. |
| `search_language_filter` | includes `cs` | Czech editions and Czech descriptions. |

Cost: roughly **$0.03 per book** ($3/M input, $15/M output, $6/1000 requests for search
context). Perplexity has no prompt caching, so the rubric system prompt is billed on every
call — keep it tight.

### System prompt

Stable across every book. Four parts, all extracted to named constants in
`src/lib/books/enrichment/rubric.ts` rather than inlined:

**1. Glossary.** Téčko (a student in the TAP programme), TAP, BOB (Book of Books), ATP,
Tiimi Akatemia. Without this the model writes for a generic audience.

**2. The scoring rubric.**

- **Kategorie 1 — Inspirace.** Popular-science introductions, biographies of successful
  people, self-help. Reads easily, no dense terminology, no step-by-step method.
  *Examples: Bartlett — Deník CEO; Duckworth — Houževnatost.* → **1 bod.**
- **Kategorie 2 — Praktická dovednost, proces a nástroj.** Process manuals, how-to guides,
  field textbooks. High specificity: concrete frameworks, step lists, case studies with data.
  A Téčko should finish it able to take a model and solve a real business problem.
  *Examples: Knapp — Sprint; Voss — Nikdy nedělej kompromis; Scott — Radikální otevřenost.*
  → **2 body.**
- **Kategorie 3 — Komplexní změna paradigmatu a systémové myšlení.** The cognitively and
  philosophically hardest works. Systems thinking. Shifts a team from "já" to "my" and builds
  the capacity to handle complex situations. Fuel for four-hour team trainings and dialogues.
  *Examples: Senge — Pátá disciplína; Isaacs — Dialog; Maxwell — 17 zákonů týmové spolupráce.*
  → **3 body.**

**Extent correction.** The category sets the baseline; physical extent and text density
correct the final award so points don't devalue. An excellent 50-page guide to digital
advertising is Kategorie 2 but earns 1 bod; Kotler's 800-page *Marketing management*, dense
with frameworks, earns 3.

**Override A (ego and manipulation).** Books oriented to advancing the individual ego,
manipulation, or machiavellianism — *48 zákonů moci* is the canonical case — are **never**
Kategorie 3, regardless of theoretical difficulty. They are Kategorie 1 (osobní taktika),
because they do not support shared vision or team collaboration.

**Override B (resilience and discipline).** A Kategorie 1 book that demonstrably trains
personal discipline, deep concentration, or psychological resilience — stoicism, overcoming
crises — is awarded **2 body**, as a deliberate incentive toward a key 21st-century
competence.

**3. The eight thematic categories**, from the existing `BOOK_CATEGORY_LABELS`: Osobní
rozvoj; Komunikace & prodej; Leadership; Management; Marketing; Inovace & kreativita;
Finance & ekonomika; Multidisciplinární.

**4. Voice specification** for the three prose fields — see the table below.

### Response schema

| Field | Type | Rule |
| --- | --- | --- |
| `title_cs` | string | Czech title, normalised. Watch the *Tiimiakatemia* case: the real title is not always the string a search engine shows, because a subtitle can dominate. |
| `title_en` | string \| null | English/original title. Null only when no such edition genuinely exists. This is what stops *new* EN/CZ/SK duplicates being created; merging the duplicates already in BOBa belongs to the curation pass, not here. |
| `author` | string | Required. Some existing records have none (*Dobrý lídr pokládá skvělé otázky*). |
| `isbn_13`, `page_count` | | `page_count` is load-bearing — the extent correction depends on it. Publisher and year are shown in Krok 2 for edition disambiguation but are **not** persisted; there are no columns for them and adding some is not in scope. |
| `description` | string | **Factual**, 2–3 sentences, no opinion. This is what truncates into cards and search results at `line-clamp-2`. |
| `why_read` | string | *Proč to čtu jako Téčko.* Second person, concrete: what you will be able to do afterwards. Not a blurb. |
| `caveats` | string | *Než se do ní pustíš.* Honest reasons to skip it: length, density, a thin evidence base, US-centric examples, heavy overlap with books already in BOBa. |
| `public_rating`, `public_rating_source` | number, string \| null | Goodreads first, databazeknih as fallback. |
| `tags` | string[] | From the eight labels above. |
| `category` | 1 \| 2 \| 3 | |
| `suggested_points` | 1 \| 2 \| 3 | After extent correction and both overrides. |
| `points_reason` | string | Names the category and the extent that produced the number. This is what a coach reads before accepting or changing it. |
| `confidence` | `high` \| `low` | `low` makes Krok 4 mark the uncertain fields rather than presenting a guess as fact. |

The response's `citations` array is stored in `enrichment_sources`, so a coach reviewing a
suggestion can see where a claim came from.

Splitting `description` from `why_read` / `caveats` is deliberate. An opinionated blurb reads
badly truncated in a results list, and the read/don't-read pair is worth rendering *as* a pair
on the book detail page.

### Manual fallback

Perplexity is never load-bearing. On timeout, 429, 5xx, or a schema violation, Krok 3 says so
plainly and offers *Zkusit znovu* or *Vyplnit ručně*.

*Vyplnit ručně* opens Krok 4 with the Google Books fields filled, the three prose fields
empty, and a points picker showing the same three category cards from Krok 1 — so the human
applies the rubric the model would have. The required-field gate still applies, so a manual
record is a complete record.

A circuit breaker skips the call entirely after repeated consecutive failures for a cooldown
period, so nobody waits 30 s for a request that is already failing. It is per-instance and
therefore best-effort — on serverless it will not trip uniformly across invocations. That is
acceptable: it exists to spare the user a pointless wait, not to enforce a budget. The
database-backed rate cap is what actually bounds spend.

Because `enriched_at` records which books were never enriched, a coach can re-run enrichment
later from `/cteni/sprava` on anything submitted while Perplexity was down.

## Data model

All new columns are additive and nullable, or carry a default. No bare `ADD COLUMN NOT NULL`
— that pattern passes on an empty local DB and fails with 23502 against production data.

### `db/schema/books.ts`

| Column | Type | Purpose |
| --- | --- | --- |
| `why_read` | `text` | *Proč to čtu jako Téčko.* |
| `caveats` | `text` | *Než se do ní pustíš.* |
| `points_reason` | `text` | The AI's scoring rationale. Distinct from `list_status_reason`, which is the coach's reason for a status change. |
| `public_rating` | `numeric(3,2)` | Goodreads or databazeknih score. |
| `public_rating_source` | `text` | Which of the two. |
| `points_confirmed_by_profile_id` | `uuid` FK → `profiles` | Set when a coach saves points. A bulk re-score skips rows where this is non-null. |
| `enriched_at` | `timestamptz` | Null means never enriched — the re-run target. |
| `enrichment_model` | `text` | Which model produced the suggestion. |
| `enrichment_sources` | `text[]` | Perplexity `citations`. |

Already present and finally populated: `title_en`, `page_count`, `preview_link`.

RLS is unchanged. The existing insert policy (`created_by_profile_id = current_profile_id()`)
already covers the new columns, which means a student can write `book_points` on insert. That
is intended — a `processing` book awards nothing, because points eligibility requires
`shortlist` or `longlist` (`POINTS_ELIGIBLE_LIST_STATUSES`).

### New table: `book_enrichment_requests`

Backs the rate cap. One row per enrichment attempt.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK, `defaultRandom()` | |
| `profile_id` | `uuid` FK → `profiles`, `on delete cascade` | |
| `created_at` | `timestamptz` `defaultNow()` not null | |

Index on `(profile_id, created_at desc)`. **RLS enabled**, as on every table: users select
their own rows, insert their own rows (`profile_id = current_profile_id()`); no update or
delete policy. Rows older than the rate window carry no meaning — pruning them is a later
housekeeping concern, not part of this work.

### `db/schema/notification-preferences.ts`

| Column | Type | Default |
| --- | --- | --- |
| `book_review_email` | `boolean` | `true` |
| `book_decision_email` | `boolean` | `true` |

Both surface in the existing `notification-preferences-form.tsx`.

### Migration procedure

Edit `db/schema/*.ts`, then **ask the user to run `pnpm db:migrate`** and to check the
generated migration for drops before it is applied. Commit the schema edit and the migration
together. If `pnpm test:integration` then fails with `Migration failed: <file>`, add the
missing object to `tests/setup/bootstrap.sql` — never edit `supabase/migrations/`.

## Notifications

A new `src/lib/notifications/book-notifications.ts` mirroring the structure of
`library-notifications.ts`, with templates added to `email-templates.ts`.

**On submit** — `notifyBookSubmitted`. Recipients: profiles where `role = 'coach'` and
`team_id` matches the submitter's; if that team has no coach, all coaches. Respects
`book_review_email`. Body carries the title, author, suggested points and `points_reason`, and
a link to `/cteni/sprava`.

**On decision** — `notifyBookDecided`, hooked into the `classify` branch of
`PATCH /api/books/[id]` (`src/app/api/books/[id]/route.ts:51`). Recipient:
`books.created_by_profile_id`. Respects `book_decision_email`. Approved vs rejected in the
subject; the body carries the final points and the coach's reason. That reason is already
mandatory when a book leaves `processing` or lands in `archived` (`route.ts:66`), so there is
nothing extra to enforce.

Neither send may fail the request that triggered it — wrap and log, same as the existing
notification call sites.

## Error handling

| Case | Behaviour |
| --- | --- |
| Enrichment unavailable | Krok 3 states it; *Zkusit znovu* or *Vyplnit ručně*. Never blocks submission. |
| Repeated enrichment failures | Circuit breaker routes straight to manual for a cooldown. |
| Low `confidence` | Krok 4 marks the affected fields for verification. |
| `POST /api/books` 409 duplicate | Navigate to the existing book, as the current wizard already does. |
| RLS refusal on insert | Surfaced as a failure. Never reported as a save — the lesson from `3d32ce6`. |
| Email send failure | Logged. The book is still created / still classified. |
| Rate cap hit | Stated with the reset time; manual entry stays available. |

## Module boundaries

New:

- `src/lib/books/enrichment/rubric.ts` — glossary, rubric, overrides, category labels, voice
  spec, all as named constants / `as const` objects.
- `src/lib/books/enrichment/schema.ts` — the JSON schema and its derived TypeScript type.
- `src/lib/books/enrichment/enrich.ts` — the Perplexity call, validation, circuit breaker.
- `src/app/api/books/enrich/route.ts` — auth, rate cap, delegation.
- `src/lib/notifications/book-notifications.ts` — the two emails.
- `src/components/books/add-book/` — one component per step plus the container, replacing
  `add-book-wizard.tsx`.
- `src/components/books/book-not-found-card.tsx` — the shared entry point.

`add-book-wizard.tsx` is deleted. Splitting the flow per step keeps each file focused; the
current single 229-line component already mixes three unrelated screens with its own fetching.

## Testing

Per `docs/runbooks/testing.md`. Perplexity is mocked at every layer — no test makes a live
call.

**Unit** (`src/lib/books/enrichment/*.test.ts`)
- Category → points mapping, including the extent correction and both overrides.
- Response validation: missing fields, out-of-range `suggested_points`, unknown tag values.
- The EN/CZ/SK dedupe key used to match a candidate against the catalogue.
- Circuit-breaker open/close transitions.

**Component** (`src/components/books/add-book/*.test.tsx`)
- Krok 1 gate: continue is only reachable via the affirm button.
- Krok 4: submission blocked until title, author, description and one tag are present.
- The Perplexity-down path: failure state renders, *Vyplnit ručně* reaches a submittable Krok 4.
- `BookNotFoundCard` renders in both mount contexts and carries `q` and `from`.

**Integration** (`tests/integration/*.int.test.ts`)
- New columns accept null and round-trip.
- RLS: a student inserts a book as themselves; cannot insert as another profile; cannot update
  someone else's book.
- `notification_preferences` defaults are `true` for both new flags.
- `points_confirmed_by_profile_id` FK behaviour.
- `book_enrichment_requests` RLS: a user reads and inserts only their own rows; the rolling
  one-hour count returns what the cap logic expects at the boundary.

**E2E** (`tests/e2e/*.spec.ts`)
- Essay picker → *Nenašel jsi knihu?* → gate → search → enrichment (mocked) → checkout →
  submit → back in the editor with the book selected.
- Coach opens `/cteni/sprava`, classifies the book with a reason, the decision email is
  dispatched (mocked transport).

## Timing constraint

The stabilization phase starting 2026-10-01 admits no new features for the winter semester.
This work needs to land before then or it slips a semester.
