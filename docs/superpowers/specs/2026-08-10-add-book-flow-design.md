# Přidání knihy do BOBa: gate, Perplexity enrichment, checkout

**Date:** 2026-08-10
**Status:** Approved design
**Touches:** `src/app/(main)/cteni/knihy/nova/**`, `src/components/books/**`, `src/components/search/search-page-client.tsx`, `src/components/essays/essay-editor-form.tsx`, `src/lib/books/**`, `src/lib/notifications/**`, `src/app/api/books/**`
**Schema:** unchanged — no migration, no new tables, no new columns

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

Therefore the old `AddBookWizard` and `/cteni/knihy/nova` are removed and rebuilt from scratch,
not patched.

## Decisions

| Question | Decision |
| --- | --- |
| Where is the entry point? | One shared component mounted in both search surfaces. |
| Modal or page? | A page. Clicking it navigates to `/cteni/knihy/nova`. |
| Is there a gate before searching? | Yes — a read-and-affirm screen on what belongs in BOB  (Nickname for the database in long. It means Book of Books.). Not a checkbox list. |
| Who enriches the record? | Perplexity `sonar-pro`, web-grounded, server-side only. |
| Where does the AI's score live? | Directly in `books.book_points`, with `books.points_reason`. The coach overrides with the existing `PointsDialog`. |
| What protects a coach's override? | `list_status <> 'processing'` already means a human ruled. A future bulk re-score restricts itself to `processing` books. No new column. |
| Does this need a migration? | **No.** Every field lands in a column that already exists; three of them (`title_en`, `page_count`, `preview_link`) simply start being populated. |
| What if Perplexity is down? | Manual completion is a first-class path, not an error state. Submission is always completable. |
| Who is emailed on submit? | The submitter's team coach(es); all coaches if their team has none. And only if they have betta access enabled |
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
  `src/components/library/library-import-scanner.tsx:115`. Users can scan a barcode of a book they are holding near their screen.
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
`title_en`, author, ISBN, page count, the description (why-read, caveats and public rating in
one field), the tag, and the suggested points with the rationale quoted. Every field editable
inline. Perplexity's `citations` are listed below the record so the submitter can check a claim
before sending; they are not saved.

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

**1. Glossary.** Téčko (a student in the TAP programme), TAP, BOB (Book of Books), ATP (Apply Theory to Practice),
Tiimi Akatemia. Without this the model writes for a generic audience.

**2. The scoring rubric.**

- **1. Bod — Inspirace.** Popular-science introductions, biographies of successful
  people, self-help. Reads easily, no dense terminology, no step-by-step method.
  *Examples: Bartlett — Deník CEO; Duckworth — Houževnatost.* → **1 bod.**
- **2. Body — Praktická dovednost, proces a nástroj.** Process manuals, how-to guides,
  field textbooks. High specificity: concrete frameworks, step lists, case studies with data.
  A Téčko should finish it able to take a model and solve a real business problem.
  *Examples: Knapp — Sprint; Voss — Nikdy nedělej kompromis; Scott — Radikální otevřenost.*
  → **2 body.**
- **3. Body — Komplexní změna paradigmatu a systémové myšlení.** The cognitively and
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
| `title_cs` | string | Czech title, normalised. Translation of the google books title. |
| `title_en` | string | English title, normalised. Translation of the google books title. |
| `author` | string | Required.  |
| `isbn_13`, `page_count` | | `page_count` is load-bearing — the extent correction depends on it. Publisher and year are shown in Krok 2 for edition disambiguation but are **not** persisted; there are no columns for them and adding some is not in scope. |
| `description` | string | Combined field that answers *why read* in second person, plus optional caveats and public rating. Concrete: what you will be able to do afterwards. Not a blurb. written for Téčko (a Tiimiakatemia student) This is what truncates into cards and search results at `line-clamp-2`.  |
| `tag` | string | One out of the eight labels above. |
| `suggested_points` | 1 \| 2 \| 3 | After extent correction and both overrides. |
| `points_reason` | string | Names the category and the extent that produced the number. Stored in `list_status_reason`, where the review UI already shows it as *DŮVOD ZAŘAZENÍ*. This is what a coach reads before accepting or changing the score. |
| `confidence` | `high` \| `low` | `low` makes Krok 4 mark the uncertain fields rather than presenting a guess as fact. |


### Manual fallback

Perplexity is never load-bearing. On timeout, 429, 5xx, or a schema violation, Krok 3 says so
plainly and offers *Zkusit znovu* or *Vyplnit ručně*.

*Vyplnit ručně* opens Krok 4 with the Google Books fields filled, the description empty, and a
points picker showing the same three category cards from Krok 1 — so the human applies the
rubric the model would have. The required-field gate still applies, so a manual record is a
complete record.

A circuit breaker skips the call entirely after repeated consecutive failures for a cooldown
period, so nobody waits 30 s for a request that is already failing. It is per-instance and
therefore best-effort — on serverless it will not trip uniformly across invocations. That is
acceptable: it exists to spare the user a pointless wait, not to enforce a budget. The
Perplexity account spend limit is what actually bounds spend (see Data model).

A coach can re-run enrichment from `/cteni/sprava` on any `processing` book, which covers
anything submitted while Perplexity was down. Nothing tracks which books were skipped — the
re-run is an on-demand action, not a queue to work through.

## Data model

**No migration. No new tables, no new columns, no new enum values.** Everything this feature
needs already exists in `books`; three columns that exist today simply start being populated.
`db/schema/*.ts` is not touched, `pnpm db:migrate` is never run, and
`tests/setup/bootstrap.sql` needs nothing.

### Where each piece of enriched data lives

| Data | Column | Notes |
| --- | --- | --- |
| Czech title | `title_cs` | Existing. |
| English title | `title_en` | **Exists, never populated today.** This is what stops new EN/CZ/SK duplicates. |
| Author, ISBN | `author`, `isbn_13` | Existing. |
| Page count | `page_count` | **Exists, never populated today.** Load-bearing: the extent correction depends on it. |
| Preview link | `preview_link` | **Exists, never populated today.** |
| Cover | `google_books_cover_url` | The remote URL, stored as-is — covers are **not** downloaded into our storage. `StorageImage` already passes external URLs through via `isExternalUrl`, and `next.config.ts` already allowlists `books.google.com`; `covers.openlibrary.org` gets added alongside it. The tradeoff: a cover breaks if the upstream host drops the URL. `downloadAndStoreCover` stays in place for other callers but is no longer reached from this path. |
| Why read + caveats + public rating | `description` | One combined field, as revised above. |
| Suggested points | `book_points` | The AI's proposal. Coach overrides via `PointsDialog`. |
| Points rationale | `list_status_reason` | See below. |
| Tag | `book_tags` | Existing join, written by `setBookTags`. |

### Two consequences of staying inside the schema

**The points rationale rides `list_status_reason`.** That column is already surfaced to
reviewers as *DŮVOD ZAŘAZENÍ*, which is exactly where a coach should read why a book is being
proposed at a given score — so it needs no new column and no new render path. The tradeoff is
real and accepted: `classify` requires a reason when a book leaves `processing`
(`src/app/api/books/[id]/route.ts:66`), so the coach's verdict **overwrites** the AI's
rationale on approval. The proposal is visible exactly when it matters — during review — and
does not linger as stale AI text on an approved book.

**Re-score protection needs no flag.** `list_status <> 'processing'` already means a human has
ruled on the book, because `classify` is the only path that changes it and it stamps
`list_status_changed_by_profile_id`. A future bulk re-score restricts itself to
`list_status = 'processing'` and cannot clobber a coach's decision. This replaces the
`points_confirmed_by_profile_id` column from the earlier draft and is strictly better —
it derives the fact instead of duplicating it.

Consequently there is also no `enriched_at`: a coach re-running enrichment from `/cteni/sprava`
acts on any `processing` book on demand, rather than the app tracking which ones were skipped.
Perplexity's `citations` are shown in Krok 4 so the submitter can verify a claim before
sending, but are not persisted.

RLS is unchanged. The existing insert policy (`created_by_profile_id = current_profile_id()`)
means a student can write `book_points` on insert. That is intended — a `processing` book
awards nothing, because points eligibility requires `shortlist` or `longlist`
(`POINTS_ELIGIBLE_LIST_STATUSES`).

### Bounding Perplexity spend without a table

There is no rate-limit table, so the cap is not database-backed and cannot be exact:

1. **A hard spend limit on the Perplexity account.** This is the real control, it costs no
   schema, and it is the only one that holds regardless of application bugs.
2. A best-effort in-process guard per profile — it will not hold across serverless
   invocations, and is documented as a courtesy, not a boundary.

Residual risk, stated plainly: an authenticated user scripting `POST /api/books/enrich`
could run up a bill at roughly $0.03 per call until the account limit stops them. Given the
endpoint requires a logged-in TAP account, this is accepted.

## Notifications

A new `src/lib/notifications/book-notifications.ts` mirroring the structure of
`library-notifications.ts`, with templates added to `email-templates.ts`.

There are **no notification-preference columns** for these two emails, since the schema is
frozen. That follows existing precedent rather than inventing one: `notifyBookBorrowed` in
`library-notifications.ts` already sends with no preference check, gated only on the recipient
having a `work_email`. Both new emails do the same, and additionally require
`beta_access_granted_at`, matching `essay-notifications.ts:36`.

**On submit** — `notifyBookSubmitted`. Recipients: profiles where `role = 'coach'` and
`team_id` matches the submitter's; if that team has no coach, all coaches. Each recipient must
have a `work_email` and `beta_access_granted_at`. Body carries the title, author, the suggested
points with its rationale, and a link to `/cteni/sprava`.

**On decision** — `notifyBookDecided`, hooked into the `classify` branch of
`PATCH /api/books/[id]` (`src/app/api/books/[id]/route.ts:51`). Recipient:
`books.created_by_profile_id`, same `work_email` + `beta_access_granted_at` gate. Approved vs
rejected in the subject; the body carries the final points and the coach's reason. That reason
is already mandatory when a book leaves `processing` or lands in `archived` (`route.ts:66`), so
there is nothing extra to enforce.

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
| In-process guard hit | Stated plainly; manual entry stays available. |
| Perplexity account limit reached | Surfaces as an API error, so it lands in the *enrichment unavailable* path above — the flow degrades to manual rather than breaking. |

## Module boundaries

New:

- `src/lib/books/enrichment/rubric.ts` — glossary, rubric, overrides, category labels, voice
  spec, all as named constants / `as const` objects.
- `src/lib/books/enrichment/schema.ts` — the JSON schema and its derived TypeScript type.
- `src/lib/books/enrichment/enrich.ts` — the Perplexity call, validation, circuit breaker.
- `src/app/api/books/enrich/route.ts` — auth, in-process guard, delegation.
- `src/lib/notifications/book-notifications.ts` — the two emails.
- `src/components/books/add-book/` — one component per step plus the container, replacing
  `add-book-wizard.tsx`.
- `src/components/books/book-not-found-card.tsx` — the shared entry point.

Removed and rebuilt:

- `src/components/books/add-book-wizard.tsx` — deleted outright.
- `src/app/(main)/cteni/knihy/nova/page.tsx` — rewritten: it currently renders a back-link plus
  the wizard, and becomes the shell for the four-step container, reading `q` and `from`.

Splitting the flow per step keeps each file focused; the current single 229-line component
already mixes three unrelated screens with its own fetching.

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

No migration means no new schema to verify, so this layer only covers behaviour that touches
the DB through constraints and policies:

- RLS: a student inserts a book as themselves; cannot insert as another profile; cannot update
  someone else's book.
- A `processing` book with `book_points` set contributes nothing to a student's total, so an
  AI-suggested score cannot leak points before review.
- `title_en`, `page_count` and `preview_link` round-trip — they have never been written before,
  so this is the first coverage they get.

**E2E** (`tests/e2e/*.spec.ts`)
- Essay picker → *Nenašel jsi knihu?* → gate → search → enrichment (mocked) → checkout →
  submit → back in the editor with the book selected.
- Coach opens `/cteni/sprava`, classifies the book with a reason, the decision email is
  dispatched (mocked transport).

## Timing constraint

The stabilization phase starting 2026-10-01 admits no new features for the winter semester.
This work needs to land before then or it slips a semester.
