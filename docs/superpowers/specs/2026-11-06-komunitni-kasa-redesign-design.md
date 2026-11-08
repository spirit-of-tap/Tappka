# Komunitní kasa redesign — design

Date: 2026-11-06 · Status: approved in conversation, builder check answered

## Intent

Komunitní kasa (`/komunitni-kasa`) exists to **inform** the people who pay into it
(190 Kč/month per member). A member who opens it wants, in this order:

1. to see **transparently where the money goes** and how much is there,
2. to know **who to contact**,
3. to understand **how decisions about the money are made**,
4. to **download the brand materials** for labelling things the kasa paid for.

Today's page fails at this: it is a grid of equal-weight cards (balance strip, two
charts, full transaction table) with no hierarchy, and the `stanovy` subpage is a
legal archive disconnected from the money. The owner called it "terrible, so many
cards" and "the subpage is confusing". The redesign must look professional, calm and
be easy to understand for people who don't read legal documents.

## Goals

- One calm main page with a clear hierarchy: state of the kasa → where money went →
  how decisions work → contact → links to the two subpages.
- A visual, icon-driven explainer of the *Směrnice o rozhodování o výdajích*.
- A brand page in Tappka where anyone can **download** the brand assets and quickly
  learn how to use them, including generators (stickers, role poster).
- A simple documents page replacing today's `stanovy` subpage.

## Non-goals

- No expense-approval workflow, monthly-budget tracking, team-vote tracking or a
  table of manually recorded expenses. The owner said these processes are not decided
  yet; "for now, just inform on the situation". Do not build UI that implies they exist.
- No database schema changes. Data still comes from the Raiffeisenbank transparent
  account API (`src/app/api/komunitni-kasa/route.ts`) and static data files.
- No piggy-bank brand variant (`kom_kasa/oznaceni-prasatko`). Only the six-segment mark.
- No change to feature gating (`komunitniKasa` is already in `RELEASED_FEATURES`).

## Anti-goals (would be a failure even if it works)

- Many bordered cards in a grid again. Prefer typographic hierarchy, whitespace and
  plain section dividers; use a surface only where it groups something real.
- Presenting the směrnice as if it were in force. It is **not approved**.
- Legalese on the main page. The explainer must be readable in under a minute.
- A brand page that is a wall of manual text with downloads buried at the bottom.

## Sources (outside the repo)

All in `~/development/timii/kom_kasa/`:

- `oznaceni/src.html` — the brand manual ("Manuál označení komunitní kasy", v1.0,
  listopad 2026), seven chapters + an inline JS that generates every downloadable
  asset as SVG/PNG/ZIP and fills a role poster from form fields. `oznaceni/index.html`
  is the same with inlined fonts. **This is the canonical source for the mark
  geometry (`SEG6` path + centre circle r=11 in a 100×100 viewBox), colours, asset
  templates, sizes and the official texts.** Port from it; do not redraw.
- `oznaceni/tisk/archy.html|pdf` — A4 print sheets of the 60 × 25 mm sticker.
- `oznaceni/latex/` — LaTeX class for kasa documents (README describes it).
- `oznaceni/latex/fonts/`, `dokumenty/fonts/` — Poppins (OFL) and Roboto (Apache).
- `dokumenty/build/09b_smernice_o_vydajich_brand.pdf` — the směrnice (draft, signature
  date empty, "per rollam č. 3/2026" pending). Text source:
  `dokumenty/smernice_o_vydajich_obsah.tex`.

## Brand essentials (from the manual)

- Colours: red `#A3202E`, dark `#2B1B1E`, white; muted text `#6E5F61`.
- Type: headings Poppins Bold, text Roboto Regular.
- Clear space: the diameter of the centre coin. Min size: 10 mm print, 24 px screen.
- Don'ts: no distorting, recolouring, shadows/effects, rotating. TAP logo goes left
  when both appear.
- Meaning: six segments = six cooperatives (even if fewer exist), gaps = each stays
  independent, centre coin = the kasa, equally far from every segment (one vote each).
- Official texts (copy exactly): plná „Financováno z komunitní kasy Spirit of TAP, z.s.“,
  krátká „Z komunitní kasy“, akce „Akci podpořila komunitní kasa Spirit of TAP, z.s.“,
  role „Role financovaná z komunitní kasy Spirit of TAP, z.s.“, EN „Funded by the
  Spirit of TAP community fund“.

**Brand colours inside Tappka:** the kasa red is a brand asset, not an app token. Use
it only inside the rendered mark/asset previews (SVG fills). All surrounding UI uses
the app's semantic tokens per `DESIGN.md`. If a kasa accent is needed in UI chrome,
add a semantic token in `src/app/globals.css` with light/dark values rather than
hard-coding hex in components.

## Main page — `/komunitni-kasa`

Single column, max readable width, sections separated by headings/dividers, not cards.

1. **Header** — the six-segment mark (inline SVG, ~32–40 px), title "Komunitní kasa",
   one line: what it is (shared money of all cooperatives, 190 Kč/month per member).
2. **Stav kasy** — current balance in large tabular type; under it, plain text for
   this month's income and spending, plus a quieter "letos" line (income, spending,
   refunds year to date). A month with no movement reads naturally ("Tento měsíc zatím
   bez pohybu"), not as 0 Kč / 0 Kč. Context: the account is new (12 transactions since
   July 2025); regular 190 Kč member contributions start in December 2026, so the
   header line "190 Kč měsíčně od každého člena" is correct as stated; account number with copy + "Otevřít v bance"
   link; a single small balance-trend chart (reuse `BalanceTrendChart`). The monthly
   cashflow chart is dropped from the main page.
3. **Kam jdou peníze** — the most recent expenses as a readable list: date, plain
   description, category, amount. A few items (builder's call, ~5–8). Link "Zobrazit
   všechny pohyby" to the full searchable table.

   Raw bank text is unreadable (`PK:408361XXXXXX7726` / `zasilkovna.cz; Praha 9`, empty
   payees), and some outgoing transfers are refunds to cooperatives ("Vrácení
   nevyčerpané části příspěvku"), not spending. Therefore: a typed static file
   (e.g. `src/lib/komunitni-kasa/transaction-notes.ts`) maps the bank `idTransaction` →
   `{ description, category }` with categories such as `nakup`, `sluzba`, `vraceni`.
   Merge it onto the API data. Refunds (`vraceni`) are excluded from the expense list and
   from spending totals and shown separately in the "letos" line. Unmapped transactions
   fall back to the bank text with card numbers (`PK:…`) stripped. This is an annotation
   file maintained in the repo by the owner, **not** the "table of manually recorded
   expenses" excluded in Non-goals (no DB, no UI for entering expenses). Seed it with
   the 7 existing outgoing transactions (builder fetches them from the RB API and asks
   the owner only for purposes that can't be inferred).
4. **Jak se o penězích rozhoduje** — clearly badged **„Návrh · zatím neschváleno“** with
   one sentence that it is waiting for approval by the cooperatives. Content, with icons:
   - Two kinds of expense side by side:
     *Provozní* — the chair decides alone; one-off purchases; together at most 30 % of
     last month's member contributions (example: 45 × 190 Kč = 8 550 Kč → limit 2 565 Kč).
     *Strategické* — the cooperatives approve in advance by per rollam vote; recurring
     payments/subscriptions, community roles, house budgets, spending from gifts or
     other income, anything over the limit. One vote per cooperative, 7 days, no answer
     = against, majority of all cooperatives (3 of 4, 4 of 6).
   - The monthly cycle in 3–4 icon steps: needs are collected (TAP Spirit, first
     Wednesday) → chair prepares next month's plan → strategic items go to a vote →
     every expense is recorded in Tappka and the item is labelled with the brand.
   - Link "Celé znění směrnice" to its in-app rendering on the documents page.
   Content should live in a typed data file (like `stanovy-data.ts`) so it is easy to
   update when the směrnice is approved, and the draft badge is driven by one flag.
5. **Kontakt** — Julie Holá: avatar + name from her profile, link to
   `/komunita/profil/4056f252-0b8e-4435-be86-b03af8b261c6`, line like
   "S dotazy ke kase se obrať na Julii." Store the profile id as a named constant.
   Load name/picture from `profiles` via supabase-js (RLS already allows verified
   users to view profiles); fall back to static text if the query fails.
6. **Footer links** — two quiet links: "Značka a materiály" → `/komunitni-kasa/znacka`,
   "Dokumenty spolku" → `/komunitni-kasa/dokumenty`.

Loading/error/empty states stay (skeleton, destructive alert with retry, `Empty*`),
restyled to the new layout.

### Full transaction list

The existing searchable/filterable table (`TransactionsTable`, search + income/expense
filter) moves off the main page. Builder's call whether it is a subpage
(`/komunitni-kasa/pohyby`) or an in-page expandable section; it must be reachable from
"Zobrazit všechny pohyby" and keep search and filter.

## Brand page — `/komunitni-kasa/znacka`

Ordered around downloading. Port the manual's content, condensed.

1. **Intro** — one paragraph: why we label (from chapter 01, shortened; it is required
   by čl. 5 odst. 3 of the směrnice — mention that the směrnice is a draft).
2. **Ke stažení** — first and most prominent. A grid/list of assets with a live preview,
   name, one-line usage hint, and download buttons (SVG, PNG; PDF where the manual
   has it). Assets = the manual's `FILES`: Značka, Značka bílá, Sestava s textem,
   Samolepka 60 × 25 mm, Tkaný štítek 40 × 15 mm, Odznak světlý, Odznak tmavý,
   Příspěvek 1080 × 1080, Banner 1920 × 600. Plus "Stáhnout vše (ZIP)" (jszip is
   already a dependency).
3. **Nástroje (generators)**:
   - **Plakát komunitní role** — form fields (role, kdo, družstvo, období, náplň), live
     preview, download PNG/PDF (A4). Port the manual's `plakat` template and
     `naplnLines` wrapping.
   - **Arch samolepek** — print-ready A4 sheet of 60 × 25 mm stickers (as in
     `tisk/archy`). Builder's call whether to offer the prebuilt PDF or generate it.
4. **Jak značku používat** — compact visual rules: colour swatches with HEX/RGB/CMYK and
   copy, type samples, clear space and min size, the four don'ts as small illustrated
   tiles, placement per medium (product sticker, textile label, slides bottom-right
   ~6 % height, social, documents footer-left 45 mm, e-mail = sentence only).
5. **Texty** — the five official sentences, each with a copy button (sonner toast).
6. **Co značka znamená** — the three meaning lines, small, at the end.
7. Footer note from the manual: consult Brand House before print; convert SVG text to
   curves for printers.

Fonts in generated SVG/PNG: assets render text in Poppins/Roboto, so downloads must
not depend on the viewer having them installed. Embed the fonts (`@font-face` with
data URIs inside the SVG, as the manual does, and ensure fonts are loaded before
canvas rasterising for PNG). Font files may be added under `public/` (licences
OFL/Apache — include licence files).

## Documents page — `/komunitni-kasa/dokumenty`

Replaces `/komunitni-kasa/stanovy` (add a redirect from the old URL). **No PDFs are
shipped or downloaded** (owner's decision): documents are presented as friendly,
good-looking, hardcoded content inside the app, and official copies are linked
externally.

- Spolek identity line: name, IČO, spisová značka (from `SPOLOK_REJSTRIK_INFO`).
- A short list of documents, each row: icon, name, one-line plain description,
  date/status, one action:
  - **Stanovy** (platné, 3. 6. 2026) → "Číst" opens the in-app rendering (today's
    searchable, expandable articles from `stanovy-data.ts`, restyled, one click deeper).
  - **Směrnice o rozhodování o výdajích** (badge „Návrh“) → "Číst" opens an in-app
    rendering of its six articles, hardcoded in a typed data file from
    `kom_kasa/dokumenty/smernice_o_vydajich_obsah.tex` (the same file can feed the
    main-page explainer). Draft badge driven by the same single flag.
  - **Zápis z členské schůze 3. 6. 2026**, **Výpis ze spolkového rejstříku**,
    **Sbírka listin** → external links to justice.cz (they contain personal data;
    do not host them).
- Remove the unused `pdfSoubor` fields from `stanovy-data.ts` if nothing uses them.

## Copy rules

Czech, informal "ty", gender-neutral per `DESIGN.md` → "Czech copy" and the
`inclusive-czech-writing` skill (`:` pairs only when unavoidable; prefer neutral forms).

## Constraints

- Follow `DESIGN.md` and `CLAUDE.md`: semantic tokens only, shared primitives
  (`Button`, `PageHeader`/`PageShell`, `Empty*`, sonner `toast`), no raw `<button>`,
  Server Components by default, light + dark verified, mobile first (16 px gutters).
- Accessibility: icons decorative (`aria-hidden`) with text labels; the explainer
  must make sense without icons; previews have alt text; downloads are real buttons.
- Keep `komunitniKasa` feature gating on every route (main, znacka, dokumenty, pohyby).
- Update `src/lib/navigation.ts` description for the nav entry if it no longer fits.
- Tests: unit tests for asset/generator pure functions (SVG templates, text wrapping,
  expense summaries); component tests for the main view states and the explainer
  draft flag; update/replace existing `komunitni-kasa-view.test.tsx` and
  `stanovy-view.test.tsx`.

## Decided in conversation (owner)

- Main purpose: inform payers — transparency of spending, contact, current situation.
- Show the směrnice, marked as not approved.
- Six-segment mark only.
- Contact person: Julie Holá, her Tappka profile.
- Brand page: download assets, learn how to use them, sticker/poster tools; very
  user-friendly.
- Směrnice explained with icons/imagery for accessibility.
- No mockups wanted; the structure above was approved as described.
- Member contributions of 190 Kč/month start next month (December 2026); the header
  line stays as the rule.
- Documents page: no PDFs; friendly hardcoded in-app content, zápis and court
  documents linked to justice.cz.

## Calls made by the designer (not explicitly decided by the owner)

- Cashflow chart removed from the main page; balance trend kept.
- Full transaction table moved off the main page.
- Brand manual condensed into one page ordered download-first.
- `stanovy` subpage replaced by a documents list with stanovy one click deeper.
- Transaction annotation file (descriptions + categories, refunds excluded from
  spending), maintained in the repo by the owner. Recommended to the owner; not
  explicitly confirmed.
- Stav kasy shows this month plus a "letos" line.

## Left to the builder

- Exact visual styling within `DESIGN.md`, icon choice (lucide), number of recent
  expenses shown, whether the full transaction list is a subpage or expandable,
  how the sticker sheet and role poster PDFs are produced (brand tools only; may add
  a small PDF library or use print), redirect type for `/stanovy`, profile fallback.
- Fonts: the app already self-hosts Poppins and Roboto in `src/app/fonts/`; reuse them
  for embedding in generated assets.
