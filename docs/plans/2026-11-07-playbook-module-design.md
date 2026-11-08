# Playbook module — design

Date: 2026-11-07 · Branch: `preview`

## Goal

A new in-app module "Playbook" containing the content of the internal
*TAP Playbook 26/27* document (53-page PDF), browsable by chapter and
searchable full-text, available to signed-in Tappka users.

## Decisions (validated with product owner)

1. **Storage & search:** static content in the repo + client-side search
   (MiniSearch). No DB, no embeddings, no API costs.
2. **Access:** logged-in users only — the PDF is marked "Interní".
   Reuse the existing `(main)` layout redirect; no new auth code.
3. **UI:** chapters + sidebar, search box scoped to the playbook module.
4. **Scope:** all chapters of the PDF, including Slovník TAP.

## Architecture

- Route: `/playbook` and `/playbook/[chapter]` inside `src/app/(main)/`.
- Content: typed static data, one file per chapter under
  `src/lib/playbook/content/`. Block model: heading / paragraph / list /
  table / note — the same data feeds rendering and the search index.
- Rendering: Server Components; `[chapter]` uses `generateStaticParams`.
- Search: MiniSearch index built at module load from content blocks,
  Czech diacritics handling, fuzzy + prefix matching; results grouped by
  chapter with highlighted snippets, clicking jumps to the section anchor.
- Navigation: register in `src/lib/navigation.ts` (`NAV_MODULES` +
  `MODULE_HUB_ORDER`) so the playbook appears in the sidebar and the
  Moduly grid.

## Content conversion

Extract text from `TAP_Playbook_26_27.pdf`, clean layout artifacts
(page headers "Interní", TOC entries, hyphenated line breaks), restructure
into the block model per chapter. Chapters follow the document TOC:

Obecné informace, Komunikační struktura, Fungování a principy TAP,
TRP + LC, Uchazeči & studenti, Metriky, TAP Spirit Houses,
Koučové & mentoři, Harmonogram a kalendář, Slovník TAP.

## Testing

- Unit: search index building, query normalization (diacritics), ranking.
- Component: search box + results, chapter navigation, block renderer.
- E2E: a signed-in user opens the playbook and searches (optional layer,
  per runbook).

## Out of scope (YAGNI)

- Editing content in-app, AI answers, global search/Spotlight integration,
  public access, PDF download/embed.
