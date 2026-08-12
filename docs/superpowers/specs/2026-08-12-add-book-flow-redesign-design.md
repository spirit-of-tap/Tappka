# Přidání knihy do BOBa: vizuální redesign čtyřkrokového flow

**Date:** 2026-08-12
**Status:** Approved design
**Touches:** `src/app/(main)/cteni/knihy/nova/page.tsx`, `src/components/books/add-book/**`, `src/lib/books/queries.ts`, `tests/e2e/add-book.spec.ts`
**Schema:** unchanged — no migration, no new tables, no new columns
**Supersedes the UI layer of:** `docs/superpowers/specs/2026-08-10-add-book-flow-design.md` (its data flow, API routes and rubric stay as built)

## Problem

The flow shipped on 2026-08-11 works but nobody reads it. Three concrete failures:

1. **Krok 1 is a wall of text.** `step-gate.tsx` renders all three
   `BOOK_POINT_CATEGORIES` — name, a 200-character description, and examples — plus a
   five-item `DOES_NOT_BELONG` list. That is ~350 words on the first screen. The screen's
   actual job is to be the first layer of protection against unrelated books, and prose
   nobody reads protects nothing.
2. **The point categories are shown to the wrong audience.** They exist so Perplexity can
   assign a score (`buildSystemPrompt()` in `rubric.ts` embeds them verbatim). A submitter
   does not need the rubric — they need the number and the reason it was chosen. Rendering
   the rubric twice (Krok 1 and the Krok 4 picker) teaches the submitter to argue with it.
3. **The submitter can overwrite the AI's judgement.** `step-review.tsx` renders
   `BOOK_POINT_CATEGORIES` as a button group plus a 0-point option, so the score that
   reaches the coach is whatever the submitter last clicked. The score is meant to be an
   objective suggestion *for the coach*, not a submitter preference.

A fourth problem is latent: the rubric's Výjimka C/D make Perplexity return
`suggested_points: 0` with `description` set to `"ZAMÍTNUTO: …"`. Today that falls straight
through to Krok 4, where the submitter fills in a form and spends coach review time on a
book the AI already rejected.

## Decisions

| Question | Decision |
| --- | --- |
| Does Krok 1 keep the point categories? | No. `BOOK_POINT_CATEGORIES` leaves the UI entirely and lives only in the Perplexity prompt. |
| How does Krok 1 communicate instead? | Two shelves: real covers from BOB for what belongs, icon chips for what does not. ~12 words of prose. |
| Where do the "belongs" covers come from? | Live from the database — rocket models first, topped up with the highest-scored shortlisted books. Not hardcoded. |
| Do the "does not belong" chips show real books? | No. Naming real titles as rejects is not something we publish, even internally. |
| What happens to the step indicator? | It becomes the flow map from Krok 1, rendered compact. One component, two densities. |
| Can the submitter change the score? | No. `book_points` and `points_reason` are read-only in Krok 4. The picker is deleted. |
| Can the submitter change anything? | Yes — `title_cs`, `title_en`, `author`, `page_count`, `tag`, `description`. Facts and framing are theirs; judgement is not. |
| What happens on a 0-point rejection? | A dead-end screen with the reason, plus a quiet appeal path that still reaches the coach. |
| Does the appeal need a new column? | No. The appeal note reuses `description`; the AI's verdict already travels in `points_reason`. |
| Who scores a manually-filled book? | Nobody, at submit time. It goes in with `book_points: null` for the coach to assign. |

## Architecture

Five steps instead of four; the fifth is a terminal branch, not a stage.

```
gate ──▶ search ──▶ enriching ──┬──▶ review ──▶ POST /api/books
                                │       ▲
                                └──▶ rejected ──┘  (appeal path only)
```

`Step` in `add-book-flow.tsx` gains `'rejected'`. `AddBookDraft` gains `appealing: boolean`.
Both are already carried through `sessionStorage` by the existing persistence effect, so a
refusal survives a refresh like any other state.

### Component inventory

| File | Change |
| --- | --- |
| `flow-map.tsx` | **New.** The four-node journey strip. `variant="expanded" \| "compact"`. |
| `step-gate.tsx` | Rewritten as two badge groups. Takes only `onContinue`. |
| `step-search.tsx` | Reworked layout; duplicate block promoted, scanner moved into the input. |
| `step-enriching.tsx` | Phase text becomes a ticking checklist beside the cover. |
| `step-rejected.tsx` | **New.** Terminal refusal screen with the appeal escape. |
| `step-review.tsx` | Split into a read-only verdict card and an editable facts form. |
| `add-book-flow.tsx` | Routes to `rejected`, renders the flow map in both variants. |
| `types.ts` | `DOES_NOT_BELONG` replaced by `DOES_NOT_BELONG_CHIPS`, `BELONGS_CHIPS` added; `appealing` added to the draft. |
| `page.tsx` | Subtitle drops (the flow map says it better). No new data fetching. |
| `queries.ts` | Unchanged. |

## The flow map

`FlowMap` is the single source of "what happens when". Four nodes, matching the four stages
a submitter passes through:

| Node | Icon | Label |
| --- | --- | --- |
| `gate` | `ShieldCheck` | Pravidla |
| `search` | `Search` | Najdi knihu |
| `enriching` | `Sparkles` | AI to doplní |
| `review` | `Send` | Odeslat kouči |

`variant="expanded"` — used only on Krok 1 — renders icons in tinted circles with labels
beneath and connecting rules between them. It is the teaching visual: *this is the whole
journey, it is four steps, the AI does the hard part.*

`variant="compact"` — used on Kroky 2–4 — renders the same four nodes as small dots with
the active label only, replacing today's `<ol>` of numbered text. On the `rejected` step the
compact map shows `enriching` as the active node, since a refusal happens there.

Both variants mark the active node with `aria-current="step"` and completed nodes with a
check, so the accessible reading is unchanged from the current list.

## Krok 1 — the gate

Two groups of badges, no imagery. Prose budget: the heading, two group labels, and one
closing line.

```
┌────────────────────────────────────────────┐
│  🛡 ──── 🔍 ──── ✨ ──── 📮                │
│ Pravidla Najdi   AI to  Odeslat            │
│          knihu   doplní kouči              │
│                                            │
│  Co patří do BOBa?                         │
│                                            │
│  ✅ Tyhle knihy hledáme                    │
│  ╭───────────────────────────╮ ╭─────────╮ │
│  │🔧 Praktické manuály a how-to│ │🧩 Systém…│ │
│  ╰───────────────────────────╯ ╰─────────╯ │
│  ╭────────────────────────────╮ ╭────────╮ │
│  │👥 Vedení a týmová spolupráce │ │📈 Byznys│ │
│  ╰────────────────────────────╯ ╰────────╯ │
│  ╭─────────────────────────╮               │
│  │🧠 Disciplína a odolnost   │               │
│  ╰─────────────────────────╯               │
│                                            │
│  ⛔ Tyhle ne                               │
│  ╭──────────╮ ╭────────────╮               │
│  │📖 Beletrie│ │🔮 Pseudověda│              │
│  ╰──────────╯ ╰────────────╯               │
│  ╭─────────────────────────╮ ╭───────────╮ │
│  │🍳 Nesouvisí s podnikáním │ │📄 Články…  │ │
│  ╰─────────────────────────╯ ╰───────────╯ │
│  ╭──────────────────────────────╮          │
│  │💢 V rozporu s našimi hodnotami│          │
│  ╰──────────────────────────────╯          │
│                                            │
│  Nejsi si jistý? Přidej ji — kouč rozhodne.│
│                                            │
│         [ Pojďme na to → ]                 │
└────────────────────────────────────────────┘
```

An earlier revision put five real covers from BOB on the wanted side. It was built, seen in
the browser, and dropped: covers made the screen an image gallery that pushed the button
below the fold on mobile, and sourcing them safely meant depending on curation the database
does not reliably have. Badges say the same thing in one screen with no query behind them.

Both groups are the same component with a `tone`, because when both sides are chips the
tones have to carry the difference. Wanted chips sit forward — `border-success/30
bg-success/10`, `text-sm font-medium`, larger padding. Unwanted chips recede — `border-border
bg-muted/40`, `text-xs text-muted-foreground`. Telling the groups apart must not require
reading a word.

```ts
export const BELONGS_CHIPS = [
  { icon: Wrench, label: 'Praktické manuály a how-to' },
  { icon: Puzzle, label: 'Systémové myšlení' },
  { icon: Users, label: 'Vedení a týmová spolupráce' },
  { icon: TrendingUp, label: 'Byznys a inovace' },
  { icon: Brain, label: 'Disciplína a odolnost' },
] as const;

export const DOES_NOT_BELONG_CHIPS = [
  { icon: BookMarked, label: 'Beletrie' },
  { icon: Wand2, label: 'Pseudověda' },
  { icon: UtensilsCrossed, label: 'Nesouvisí s podnikáním' },
  { icon: FileText, label: 'Články, kurzy, PDF' },
  { icon: HeartCrack, label: 'V rozporu s našimi hodnotami' },
] as const;
```

`BELONGS_CHIPS` describes books the way a submitter would describe one to a teammate. It is
deliberately **not** the three rubric categories: those exist so the model can pick a
number, and naming them here invites an argument about scoring on the one screen whose job
is to filter by subject.

The five unwanted chips replace the old five-item `DOES_NOT_BELONG` list one-for-one, except
that *Duplicity* moves out — Krok 2 handles duplicates far better than a warning ever could.

`StepGate` takes no props but `onContinue`. Nothing on this screen is fetched, so the gate
renders instantly and cannot fail.


## Krok 2 — search

Same data sources and same debounce (`350 ms`, `MIN_QUERY_LENGTH = 2`). Three layout changes:

1. **Duplicates get promoted.** A catalogue hit currently renders as a quiet grey row below
   the input. It moves *above* the external results into an info-toned block headed
   *Tuhle knihu už v BOBovi máme*, with the same tappable rows through to
   `/cteni/knihy/{id}`. When there is a catalogue hit, external results render collapsed
   behind *Přesto přidat jinou verzi* — adding a duplicate stays possible but stops being
   the path of least resistance.
2. **The scanner moves into the input.** Today it is a `Naskenovat ISBN` button on its own
   line. It becomes a camera icon button inside the input's trailing edge (`InputGroup`),
   toggling the same `BarcodeScanner` panel. Saves a line and reads as part of searching.
3. **External rows become fully tappable.** The row itself is the button; the `Vybrat`
   button is removed. Bigger target, one less thing to read. Cover, title, author, then the
   existing `year · publisher · pages · ISBN` meta line.

Manual entry stays a collapsed disclosure at the bottom, with its helper line cut to
*Doplníme, co půjde.*

## Krok 3 — enriching

```
┌──────────────────────────────────────┐
│  ┌─────┐   ✓  Našel jsem knihu       │
│  │cover│   ⟳  Hledám český popis     │
│  │     │   ○  Porovnávám s BOBem     │
│  └─────┘   ○  Hodnotím body          │
│                                      │
│  Sprint · Jake Knapp                 │
│  Chvilku to trvá — asi půl minuty.   │
└──────────────────────────────────────┘
```

Four checklist items driven by the existing `phase` counter and `PHASE_INTERVAL_MS = 6_000`.
Item 0 is complete on mount; items below `phase + 1` show a check, item `phase + 1` shows a
spinner, the rest show a hollow ring. The counter still clamps at the last item, so a slow
call parks on *Hodnotím body* rather than claiming to be finished.

`ENRICH_PHASES` moves to a named `as const` array of labels — it is the same data the
current `PHASES` holds, one entry longer.

Cover comes from `draft.candidate.cover_url` (a remote Google Books URL at this point, so a
plain `<img>` with the existing eslint exemption, matching `step-search.tsx`). Manual
candidates have no cover; the slot falls back to a `BookOpen` placeholder.

The error branch keeps both escapes — `Zkusit znovu` and `Vyplnit ručně` — with its two
explanatory sentences cut to one.

## Krok 3b — rejected

Reached when the enrichment succeeds but `enriched.suggested_points === 0`. Detection is on
the number, not on the `"ZAMÍTNUTO:"` prefix — the rubric guarantees 0 points for every
refusal, and the prefix is prose we should not be parsing.

```
┌──────────────────────────────────────┐
│                ⛔                     │
│  Tuhle knihu do BOBa nezapíšeme      │
│                                      │
│  ┌─────┐  Harry Potter               │
│  │cover│  J. K. Rowling              │
│  └─────┘                             │
│                                      │
│  Beletrie — rozhoduje žánr, ne téma. │
│                                      │
│  [ Zkusit jinou knihu ]              │
│                                      │
│  AI se mýlí? › Pošli to kouči přesto │
└──────────────────────────────────────┘
```

The reason line is `enriched.points_reason`, which the rubric requires on every refusal.
`enriched.description` — the `"ZAMÍTNUTO: …"` sentence — is deliberately not shown; it
duplicates the verdict in flatter words.

**`Zkusit jinou knihu`** resets the draft to `EMPTY_DRAFT` and returns to `search`. The
gate is not re-shown; they have already read it.

**`Pošli to kouči přesto`** goes to `review` with `appealing: true`. In that mode Krok 4:

- keeps the verdict card, showing `⭐ 0` and the AI's reason, so the coach sees exactly what
  the submitter is arguing against;
- clears `description` and relabels the field *Napiš kouči, proč kniha do BOBa patří*, with
  submit gated on it being non-empty. An appeal with no argument is not a submission.

Nothing else changes: the POST body is the same shape, `book_points: 0` and the AI's
`points_reason` travel as they always would, and the coach's existing review surface
(`coach-book-row.tsx`) already renders both.

## Krok 4 — review

Two blocks with a clear line between them: what the AI decided, and what you may fix.

```
┌────────────────────────────────────────┐
│  ┌─────┐  Sprint                       │
│  │cover│  Jake Knapp                   │
│  └─────┘                               │
│            ╭───────╮                   │
│            │  ⭐ 2  │ knižní body       │
│            ╰───────╯                   │
│  „Procesní manuál s konkrétními        │
│   frameworky a případovými studiemi.“  │
│                                        │
│  Návrh AI pro kouče. Kouč ho může      │
│  změnit.                               │
└────────────────────────────────────────┘

⚠ Zkontroluj: autor, počet stran.

Oprav, co AI spletla
Český název  [ Sprint             ]
Anglický     [ Sprint             ]
Autor        [ Jake Knapp         ] ⚠
Počet stran  [ 288                ]
Oblast       [ Byznys a inovace  ▾]

Popis — proč to číst
┌──────────────────────────────────────┐
│ Naučí tě za pět dní ověřit nápad…    │
└──────────────────────────────────────┘

▸ Zdroje (3)

Kniha půjde kouči ke schválení — dostane e-mail.

        [ Odeslat kouči → ]
```

### Read-only verdict

The `<fieldset>` of `BOOK_POINT_CATEGORIES` buttons is deleted. `points` stops being state
and becomes `enriched?.suggested_points ?? null`, rendered as a badge. `points_reason` sits
beneath it as plain text, not italic muted — it is the substance of the screen, not a
footnote.

The badge shows the number and the words `knižní body`. It never shows a category name.
Category names are rubric vocabulary; the submitter's mental model is a number.

### Editable facts

Unchanged fields and validation, minus the points requirement:

```ts
const ready =
  titleCs.trim().length > 0 &&
  author.trim().length > 0 &&
  description.trim().length > 0 &&
  tag.length > 0;
```

Low-confidence handling stays exactly as built — the amber ring per field via
`UNCERTAIN_CLASSES` and the `data-uncertain` attribute — but the banner shrinks from two
sentences to `Zkontroluj: {fields}.`

`suggested_points` needs separate handling, because asking someone to check a field they
cannot edit is nonsense. It is **excluded from the banner's field list** and instead renders
as a caveat line inside the verdict card — *Hodnocením si AI nebyla jistá.* Its entry in
`LOW_CONFIDENCE_LABELS` is therefore no longer used by the banner; keep the entry (the type
is derived from `LOW_CONFIDENCE_FIELDS`) but filter it out where the list is built. Same
treatment for `isbn_13`, which likewise has no visible control.

Citations move into a native `<details>` labelled `Zdroje (n)`, closed by default.

### The manual path

When enrichment failed and the submitter chose *Vyplnit ručně*, `enriched` is null, so
there is no verdict card and no score. The verdict block is replaced by one line —
*Body přidělí kouč.* — and the POST goes out with `book_points: null` and
`points_reason: null`. `CreateBookInput.book_points` is already `0 | 1 | 2 | 3 | null` and
`src/app/api/books/route.ts:66` already guards with `body.book_points != null`, so no route
change is needed.

This is the one place the submitter previously chose a score. They no longer can, anywhere
in the flow.

## Page header

The `h1` stays. The subtitle *"Projdeme to spolu ve čtyřech krocích. Kouč knihu nakonec
schválí a přidělí body."* is removed — the expanded flow map states both facts visually,
and a subtitle that repeats the graphic below it is exactly the kind of text this redesign
is removing.

## What is deliberately not changing

- Every API route, the Perplexity prompt, `parseEnrichment`, and the dedupe logic.
- `BOOK_POINT_CATEGORIES` itself. It stays in `rubric.ts` and stays in the system prompt.
  Only its UI consumers go away, which means `step-gate.tsx` and `step-review.tsx` stop
  importing it.
- `sessionStorage` persistence, the `?from=esej&essayId=` return path, and the 409
  duplicate redirect.
- The coach's review surfaces.

## Testing

Component tests sit next to their components; the E2E spec covers the flow end to end.

| Test | Change |
| --- | --- |
| `flow-map.test.tsx` | **New.** Both variants render four nodes; the active node carries `aria-current="step"`. |
| `step-gate.test.tsx` | Rewritten. Asserts no rubric category name or description appears, both groups render their full chip list as separate lists, and the screen contains no images at all. |
| `step-enriching.test.tsx` | Keeps its success, failure and network-rejection cases; phase assertions move to checklist state. |
| `step-rejected.test.tsx` | **New.** Shows `points_reason`; `Zkusit jinou knihu` returns to search with a cleared draft; the appeal path reaches review with `appealing: true`. |
| `step-review.test.tsx` | The 0-point picker test is deleted — that behaviour is now `step-rejected`'s. New: the score renders read-only with no control able to change it; submit succeeds without any points interaction; the manual path submits `book_points: null`; the appeal path requires a non-empty note; a `suggested_points` uncertainty flag renders on the verdict card and never in the banner list. |
| `add-book-flow.test.tsx` | New: a 0-point enrichment routes to `rejected`, not `review`. |
| `tests/e2e/add-book.spec.ts` | Updated for the new labels and the removed points picker; a rejection path case added against a stubbed enrich response. |

Nothing in this change touches the database, so there is no new query to cover and nothing
for `bootstrap.sql`.

## Risks

**The wanted badges are a fixed list in code.** If what BOB is looking for shifts, the chips
go stale silently — there is no data behind them to drift with the catalogue. That is the
accepted cost of a screen that cannot fail to load; the list is five lines in `types.ts`.

**Removing the points picker removes an escape hatch.** If Perplexity scores a book badly
and the submitter cannot correct it, a wrong number reaches the coach. This is the intended
trade — the coach is the authority and already overrides scores on review — but it means
enrichment quality now has no in-flow correction. The uncertainty flag on
`suggested_points` is the signal that keeps this visible.
