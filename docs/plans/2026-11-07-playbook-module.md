# Playbook Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an internal, login-gated "Playbook" module to Tappka containing the full TAP Playbook 26/27 content, browsable by chapter with client-side full-text search.

**Architecture:** Static typed content (`src/lib/playbook/content/*.ts`, block model: heading/paragraph/list/table/note) rendered by Server Components under `src/app/(main)/playbook/` (existing layout redirect gates auth). Client-side search via MiniSearch over section-level chunks, diacritics-insensitive, results link to `#section` anchors highlighted with CSS `:target`.

**Tech Stack:** Next.js 16.3.1 App Router, React 19, TypeScript strict, Tailwind v4 + shadcn/ui (new-york) tokens, MiniSearch, vitest + @testing-library/react.

**Conventions (AGENTS.md/DESIGN.md):** semantic tokens only, `PageHeader`/`PageShell`, Czech copy gender-neutral (`:` pairs, participles), kebab-case files, co-located `*.test.ts(x)`, `params` is a Promise in Next 16 (`await params`).

**Worktree:** `/Users/kulo/development/timii/Tappka/.worktrees/playbook` (branch `feat/playbook`), `node_modules` symlinked, `.env.local` copied.

---

## Content conversion background

`TAP_Playbook_26_27.pdf` = 53 pages, Czech. Extraction signal: body text 11.0pt, headings 13.9/13.0pt, footer "Interní" 10.1pt (skip), TOC on pages 2–6 (skip). Bordered callout boxes extract as tables (false positives). The glossary (pages 50–53) is a two-column term/definition layout — reconstruct pairs from line positions. Real data tables: metrics chapter (~pages 22–24).

Conversion pipeline (during Task 3): `pdfplumber` dump (venv at `/private/var/folders/9g/chptyjgx2bvb0ln_979sbxs40000gp/T/opencode/pdfenv`) → first-pass TS generator → manual curation per chapter file.

Chapter slugs/titles (document TOC):
`obecne-informace` Obecné informace · `komunikacni-struktura` Komunikační struktura · `fungovani-principy` Fungování a principy TAP · `trp-lc` TRP + LC · `uchazeci-studenti` Uchazeči & studenti · `metriky` Metriky · `tap-spirit` TAP Spirit Houses · `koucove-mentori` Koučové & mentoři · `harmonogram` Harmonogram a kalendář · `slovnik` Slovník TAP

---

### Task 1: Add MiniSearch dependency

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

**Step 1:** Add dependency
Run: `pnpm add minisearch`
Expected: `minisearch` in dependencies, lockfile updated.

**Step 2:** Commit
```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(playbook): add minisearch"
```

---

### Task 2: Content model + chapter registry

**Files:**
- Create: `src/lib/playbook/types.ts`
- Create: `src/lib/playbook/content/index.ts`
- Create: `src/lib/playbook/registry.test.ts`

**Step 1: Write the failing test** (`src/lib/playbook/registry.test.ts`)

```ts
import { describe, expect, it } from "vitest";

import { PLAYBOOK_CHAPTERS, getChapterBySlug } from "./content";

describe("PLAYBOOK_CHAPTERS", () => {
  it("has unique slugs", () => {
    const slugs = PLAYBOOK_CHAPTERS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has at least the ten TOC chapters", () => {
    expect(PLAYBOOK_CHAPTERS.length).toBeGreaterThanOrEqual(10);
  });

  it("every chapter has a title and non-empty sections", () => {
    for (const chapter of PLAYBOOK_CHAPTERS) {
      expect(chapter.title.length).toBeGreaterThan(0);
      expect(chapter.sections.length).toBeGreaterThan(0);
    }
  });

  it("resolves chapters by slug and returns null for unknown slugs", () => {
    expect(getChapterBySlug(PLAYBOOK_CHAPTERS[0].slug)).toBe(PLAYBOOK_CHAPTERS[0]);
    expect(getChapterBySlug("neexistuje")).toBeNull();
  });
});
```

**Step 2: Run test, verify fail**
Run: `pnpm vitest run --project unit src/lib/playbook/registry.test.ts`
Expected: FAIL (module not found).

**Step 3: Implement types** (`src/lib/playbook/types.ts`)

```ts
export interface PlaybookParagraphBlock {
  kind: "paragraph";
  text: string;
}

export interface PlaybookListBlock {
  kind: "list";
  ordered: boolean;
  items: string[];
}

export interface PlaybookTableBlock {
  kind: "table";
  headers: string[];
  rows: string[][];
}

export interface PlaybookNoteBlock {
  kind: "note";
  text: string;
}

export interface PlaybookHeadingBlock {
  kind: "heading";
  level: 2 | 3;
  text: string;
}

export type PlaybookBlock =
  | PlaybookHeadingBlock
  | PlaybookParagraphBlock
  | PlaybookListBlock
  | PlaybookTableBlock
  | PlaybookNoteBlock;

export interface PlaybookSection {
  /** URL-safe id used for anchors (#metriky-training-session) and search deep-links. */
  slug: string;
  title: string;
  blocks: PlaybookBlock[];
}

export interface PlaybookChapter {
  slug: string;
  title: string;
  /** One-sentence lead shown on the chapter page under the header. */
  lead?: string;
  sections: PlaybookSection[];
}
```

**Step 4: Implement registry** (`src/lib/playbook/content/index.ts`)

```ts
import { OBECNE_INFORMACE } from "./obecne-informace";
// ... one import per chapter file

import type { PlaybookChapter } from "../types";

export const PLAYBOOK_CHAPTERS: PlaybookChapter[] = [
  OBECNE_INFORMACE,
  // ... all ten, in TOC order
];

export function getChapterBySlug(slug: string): PlaybookChapter | null {
  return PLAYBOOK_CHAPTERS.find((c) => c.slug === slug) ?? null;
}
```

**Step 5: Stub one chapter file** (`src/lib/playbook/content/obecne-informace.ts`) with a minimal valid chapter (title + one section, one paragraph) so the test passes; remaining chapters land in Task 3.

**Step 6: Run test, verify pass**
Run: `pnpm vitest run --project unit src/lib/playbook/registry.test.ts`
Expected: PASS.

**Step 7: Commit**
```bash
git add src/lib/playbook
git commit -m "feat(playbook): content model and chapter registry"
```

---

### Task 3: Convert PDF content into chapter files

**Files:**
- Create: `src/lib/playbook/content/obecne-informace.ts` (replace stub)
- Create: `src/lib/playbook/content/komunikacni-struktura.ts`
- Create: `src/lib/playbook/content/fungovani-principy.ts`
- Create: `src/lib/playbook/content/trp-lc.ts`
- Create: `src/lib/playbook/content/uchazeci-studenti.ts`
- Create: `src/lib/playbook/content/metriky.ts`
- Create: `src/lib/playbook/content/tap-spirit.ts`
- Create: `src/lib/playbook/content/koucove-mentori.ts`
- Create: `src/lib/playbook/content/harmonogram.ts`
- Create: `src/lib/playbook/content/slovnik.ts`

**Steps per chapter (no TDD — curation work, validated by Task 2's test + typecheck):**

1. Extract: dump page lines with font sizes + positions via pdfplumber for the chapter's page range.
2. Generate first-pass TS (headings 13.9→h2, 13.0→h3, body→paragraphs; skip "Interní" headers/page numbers).
3. Curate: fix hyphenated line breaks, merge wrapped lines, convert real bullets to `list`, data tables to `table`, bordered callouts to `note`, reconstruct glossary pairs for `slovnik.ts`.
4. Verify per chapter: `pnpm vitest run --project unit src/lib/playbook/registry.test.ts` + `pnpm typecheck`.

**Commit after every 2 chapters:**
```bash
git add src/lib/playbook/content
git commit -m "feat(playbook): content – <chapter names>"
```

**Fidelity rules:** keep original Czech wording (content is a document reproduction — DESIGN.md exception for quotes/names); only remove layout artifacts. Preserve typography: „…" quotes, → arrows, × symbols.

---

### Task 4: Search core

**Files:**
- Create: `src/lib/playbook/search.ts`
- Test: `src/lib/playbook/search.test.ts`

**Step 1: Write failing tests** — cover:
- `normalizePlaybookText("Přijímací řízení")` → `"prijimaci rizeni"` (diacritics folded, lowercased)
- `buildPlaybookIndex(PLAYBOOK_CHAPTERS)` returns a MiniSearch instance with one doc per section (`chapter/sectionSlug` ids)
- `searchPlaybook(index, "houston")` finds the Metriky → Houston calling section; results contain `chapterSlug`, `sectionSlug`, `title`, and a `snippet` that includes the matched text
- empty query returns `[]`

**Step 2: Run, verify fail.**
Run: `pnpm vitest run --project unit src/lib/playbook/search.test.ts`

**Step 3: Implement** (`src/lib/playbook/search.ts`)

```ts
import MiniSearch from "minisearch";

import { PLAYBOOK_CHAPTERS, getChapterBySlug } from "./content";
import type { PlaybookBlock, PlaybookChapter } from "./types";

export interface PlaybookSearchResult {
  chapterSlug: string;
  chapterTitle: string;
  sectionSlug: string;
  sectionTitle: string;
  /** Text around the first match, ready to render with <mark> segments. */
  snippet: string;
}

const MINISEARCH_OPTIONS = {
  idField: "id",
  fields: ["title", "chapterTitle", "text"],
  storeFields: ["chapterSlug", "chapterTitle", "sectionSlug", "sectionTitle", "text"],
} as const;

const SEARCH_OPTIONS = { prefix: true, fuzzy: 0.2, boost: { title: 2, chapterTitle: 1.2 } };

export function normalizePlaybookText(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function sectionText(blocks: PlaybookBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.kind) {
        case "paragraph": case "note": return b.text;
        case "heading": return b.text;
        case "list": return b.items.join(" ");
        case "table": return [b.headers.join(" "), ...b.rows.map((r) => r.join(" "))].join(" ");
      }
    })
    .join("\n");
}

export function buildPlaybookIndex(chapters: PlaybookChapter[]): MiniSearch {
  const index = new MiniSearch(MINISEARCH_OPTIONS);
  index.addAll(chapters.flatMap((chapter) =>
    chapter.sections.map((section) => ({
      id: `${chapter.slug}/${section.slug}`,
      chapterSlug: chapter.slug,
      chapterTitle: chapter.title,
      sectionSlug: section.slug,
      sectionTitle: section.title,
      title: section.title,
      text: sectionText(section.blocks),
    })),
  ));
  return index;
}

const SNIPPET_RADIUS = 120;

export function searchPlaybook(index: MiniSearch, query: string): PlaybookSearchResult[] {
  const normalized = normalizePlaybookText(query.trim());
  if (normalized.length < 2) return [];
  const results = index.search(normalized, SEARCH_OPTIONS);
  return results.slice(0, 20).map((r) => {
    const text = r.text as string;
    const chapterSlug = r.chapterSlug as string;
    const chapterTitle = r.chapterTitle as string;
    const sectionSlug = r.sectionSlug as string;
    const sectionTitle = r.sectionTitle as string;
    const textLower = normalizePlaybookText(text);
    const terms = normalized.split(/\s+/).filter((t) => t.length >= 2);
    let hit = -1;
    for (const term of terms) {
      const idx = textLower.indexOf(term);
      if (idx !== -1 && (hit === -1 || idx < hit)) hit = idx;
    }
    const start = hit === -1 ? 0 : Math.max(0, hit - SNIPPET_RADIUS);
    const end = hit === -1 ? Math.min(text.length, SNIPPET_RADIUS * 2) : Math.min(text.length, hit + SNIPPET_RADIUS);
    const snippet = `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
    return { chapterSlug, chapterTitle, sectionSlug, sectionTitle, snippet };
  });
}

export function getChapterBySlugPublic(slug: string) {
  return getChapterBySlug(slug);
}

export { PLAYBOOK_CHAPTERS };
```

**Step 4: Run, verify pass.** Also run `pnpm test` (unit+component) to confirm nothing else broke.

**Step 5: Commit**
```bash
git add src/lib/playbook/search.ts src/lib/playbook/search.test.ts
git commit -m "feat(playbook): client search core with diacritics folding"
```

---

### Task 5: Block renderer + chapter page

**Files:**
- Create: `src/components/playbook/playbook-renderer.tsx`
- Create: `src/app/(main)/playbook/[chapter]/page.tsx`
- Test: `src/components/playbook/playbook-renderer.test.tsx`

**Step 1: Failing component tests** — render a chapter with one block of each kind; assert: headings get ids, list renders `<ul>/<ol>` with items, table renders headers + rows, note renders with a distinct accessible role/class, paragraphs render text.

**Step 2: Run, verify fail.**

**Step 3: Implement renderer** — Server Component mapping blocks to `<h2/h3 id={slug}>`, `<p>`, `<ul>/<ol>`, table with `divide-y` styling, note as bordered callout using tokens (`bg-accent/40` or tinted per DESIGN.md). Each section wrapped in `<section id={section.slug}>` with `scroll-mt-*`.

**Step 4: Implement chapter page** `src/app/(main)/playbook/[chapter]/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/session";
import { getChapterBySlug } from "@/lib/playbook/content";
import { PlaybookRenderer } from "@/components/playbook/playbook-renderer";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";

export function generateStaticParams() {
  return PLAYBOOK_CHAPTERS.map((c) => ({ chapter: c.slug }));
}

export default async function PlaybookChapterPage({ params }: { params: Promise<{ chapter: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/auth/login");
  const { chapter: slug } = await params;
  const chapter = getChapterBySlug(slug);
  if (!chapter) notFound();
  return (
    <PageShell className="max-w-3xl">
      <PageHeader title={chapter.title} description={chapter.lead} back={{ href: "/playbook", label: "Playbook" }} />
      <PlaybookRenderer sections={chapter.sections} />
    </PageShell>
  );
}
```

**Step 5: Run tests, verify pass; `pnpm typecheck`.**

**Step 6: Commit**
```bash
git add src/components/playbook src/app/"(main)"/playbook
git commit -m "feat(playbook): block renderer and chapter pages"
```

---

### Task 6: Sidebar, search UI, playbook home

**Files:**
- Create: `src/components/playbook/playbook-sidebar.tsx` (client)
- Create: `src/components/playbook/playbook-search.tsx` (client)
- Create: `src/app/(main)/playbook/layout.tsx`
- Create: `src/app/(main)/playbook/page.tsx`
- Test: `src/components/playbook/playbook-search.test.tsx`

**Step 1: Failing tests** — search component: typing "houston" shows a result row "Houston calling (HC)" under chapter title "Metriky"; clicking calls `router.push("/playbook/metriky#houston-calling-hc")` (mock next/navigation); empty state shows for gibberish query.

**Step 2: Run, verify fail.**

**Step 3: Implement search component** — builds index once (module-level lazy), input with `role="searchbox"`, results grouped by chapter, snippet with `<mark>` highlights, click → `router.push`. Use `Input` primitive, `Empty*` for the no-results state.

**Step 4: Implement sidebar** — chapter list from `PLAYBOOK_CHAPTERS` with `usePathname()` active state; search box on top. On mobile: collapses to a `Collapsible` trigger ("Kapitoly").

**Step 5: Implement layout + home page** — layout: two-column (`aside` w-64 + content, stacking on mobile); home page: `PageHeader` "Playbook" + module intro + search + chapter grid/cards linking to chapters.

**Step 6: Run tests, typecheck, verify pass.**

**Step 7: Commit**
```bash
git add src/components/playbook src/app/"(main)"/playbook
git commit -m "feat(playbook): sidebar, search UI and module home"
```

---

### Task 7: Navigation registration

**Files:**
- Modify: `src/lib/navigation.ts` (add NAV_MODULES entry `{ title: "Playbook", url: "/playbook", icon: BookMarked, description: "..." }` + `"/playbook"` in MODULE_HUB_ORDER)
- Modify: `src/lib/navigation.test.ts` (extend existing expectations)

**Step 1:** Update `navigation.test.ts` expectations for the new module (failing first).
**Step 2:** Run `pnpm vitest run --project unit src/lib/navigation.test.ts` — fail.
**Step 3:** Add the entry + hub order; run — pass.
**Step 4:** Commit:
```bash
git add src/lib/navigation.ts src/lib/navigation.test.ts
git commit -m "feat(playbook): register module in navigation"
```

---

### Task 8: Verification & polish

**Steps:**
1. `pnpm test` — all unit + component green.
2. `pnpm typecheck` — clean.
3. `pnpm lint` — clean.
4. Manual smoke: `pnpm dev`, sign in, visit `/playbook`, open a chapter, search "houston", click result → jumps + `:target` highlight. Verify light + dark themes (no hardcoded colors).
5. Czech copy check: all UI strings gender-neutral (`:` pairs); metadata description ≤ 90 chars, no trailing period.
6. Commit any fixes; push `feat/playbook`.
7. Offer merge/PR via finishing-a-development-branch flow.

---

## Out of scope
Editing content in-app, AI answers, global search/Spotlight integration, public access, PDF download/embed, DB changes.
