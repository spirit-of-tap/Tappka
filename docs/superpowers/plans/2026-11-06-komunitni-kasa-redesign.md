# Komunitní kasa redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the card-heavy Komunitní kasa page and its `stanovy` subpage with a calm, informative overview, a visual směrnice explainer, a documents area, and a brand page where members download the kasa mark and generate stickers/posters.

**Architecture:** Pure logic lives in `src/lib/komunitni-kasa/` (transaction annotations and summaries, směrnice content, brand SVG templates) and is unit-tested. Routes under `src/app/(main)/komunitni-kasa/` are Server Components that gate access through one shared helper; interactivity (bank data fetch, search, copy, downloads, poster form) sits in small client components under `src/components/komunitni-kasa/`. Bank data keeps coming from `/api/komunitni-kasa`; no DB changes.

**Tech Stack:** Next.js App Router (read `node_modules/next/dist/docs/` before touching routing/redirect APIs — this Next version differs from training data), React, TypeScript strict, Tailwind + shadcn/ui, lucide-react, recharts, jszip, sonner, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-06-komunitni-kasa-redesign-design.md`

## Global Constraints

- No DB/schema changes; no expense-entry UI; no approval/vote/budget tracking UI.
- Every route (`/komunitni-kasa`, `/pohyby`, `/znacka`, `/dokumenty`, `/dokumenty/stanovy`, `/dokumenty/smernice`) keeps the `komunitniKasa` feature gate.
- Semantic color tokens only in UI (`src/app/globals.css`); kasa hex colors (`#A3202E`, `#2B1B1E`, `#FFFFFF`, muted `#6E5F61`) appear only inside generated SVG asset strings and the `KasaMark` SVG fill. If UI chrome needs a kasa accent, add a `--kasa` token with light/dark values in `globals.css`.
- Shared primitives only: `Button`, `PageShell`, `PageHeader`, `Badge`, `Empty*`, `Alert`, sonner `toast`. No raw `<button>`, no `window.confirm()`.
- Avoid bordered-card grids. Sections = heading + content + `border-t` divider. A surface (`bg-muted/40 rounded-xl`) only where it groups a real unit (asset tile, explainer kind).
- Czech, informal "ty", gender-neutral (`DESIGN.md` → "Czech copy", `inclusive-czech-writing` skill).
- Official brand sentences copied verbatim: „Financováno z komunitní kasy Spirit of TAP, z.s.“, „Z komunitní kasy“, „Akci podpořila komunitní kasa Spirit of TAP, z.s.“, „Role financovaná z komunitní kasy Spirit of TAP, z.s.“, „Funded by the Spirit of TAP community fund“.
- Směrnice is a draft: badge text „Návrh · zatím neschváleno“, driven by `SMERNICE_IS_DRAFT`.
- Contact: Julie Holá, profile id `4056f252-0b8e-4435-be86-b03af8b261c6`, link `/komunita/profil/4056f252-0b8e-4435-be86-b03af8b261c6`.
- No PDFs shipped for documents; zápis, výpis and sbírka listin link to justice.cz. Brand generators export SVG and PNG only (no PDF library) — this plan's call.
- Verify light and dark themes and 375 px width for every page.
- `pnpm test` and `pnpm tsc --noEmit` must pass before each commit.

## Review Focus

1. **Czech diacritics in downloaded PNGs** (ř, ž, ů in „komunitní“, poster fields) — fonts must be embedded and loaded before rasterising, or PNGs silently fall back to a system font. Test in Task 3 (`buildSvgDocument` embeds `@font-face` for each family used) and manual check in Task 8.
2. **User input in the role poster** (`<`, `&`, `"`, very long words, 10 lines of náplň) — must be escaped and wrapped to ≤ 6 lines, never break the SVG. Tests in Task 3.
3. **Bank API down or slow** — main page must still show the explainer, contact and links; only the money sections show the error + retry. Test in Task 5.
4. **Months/years with no movement** (current state: November 2026 has none) — show „Tento měsíc zatím bez pohybu“, never „0 Kč / 0 Kč“. Tests in Tasks 1 and 5.
5. **Unannotated new transactions** (a new card payment tomorrow) — fall back to bank text with the card number stripped, category `jine`, still counted in spending. Tests in Task 1.

---

## File Structure

```
src/lib/komunitni-kasa/
  transaction-notes.ts        (new) idTransaction → { description, category }, owner-maintained
  summary.ts                  (new) annotate, period summaries, recent expenses
  summary.test.ts             (new)
  smernice-data.ts            (new) draft flag, 6 articles, explainer content
  smernice-data.test.ts       (new)
  brand/constants.ts          (new) mark geometry, colors, official texts, contact
  brand/assets.ts             (new) SVG templates for all downloadable assets + sticker sheet + poster
  brand/assets.test.ts        (new)
  brand/export.ts             (new, client-only) font embedding, SVG→PNG, ZIP, download trigger
  access.ts                   (new) shared feature-gate helper for routes
  stats.ts                    (keep; computeMonthlyCashflow removed if unused after Task 9)
  stanovy-data.ts             (modify: drop unused pdfSoubor)

src/components/komunitni-kasa/
  kasa-mark.tsx               (new) inline six-segment mark
  kasa-overview.tsx           (new, client) fetch + Stav kasy + Kam jdou peníze (replaces komunitni-kasa-view.tsx)
  kasa-overview.test.tsx      (new; replaces komunitni-kasa-view.test.tsx)
  decision-explainer.tsx      (new, server) Jak se o penězích rozhoduje
  decision-explainer.test.tsx (new)
  kasa-contact.tsx            (new, server) Julie
  transactions-view.tsx       (new, client) full list with search + filter (moved from old view)
  document-list.tsx           (new, server)
  document-list.test.tsx      (new)
  smernice-view.tsx           (new, server)
  stanovy-view.tsx            (modify: drop tabs/overview card; articles + search only)
  brand/asset-gallery.tsx     (new, client)
  brand/role-poster-tool.tsx  (new, client)
  brand/sticker-sheet-tool.tsx(new, client)
  brand/usage-rules.tsx       (new, server)
  brand/official-texts.tsx    (new, client)
  brand/*.test.tsx            (new)
  balance-trend-chart.tsx, transactions-table.tsx (keep)
  cashflow-chart.tsx, komunitni-kasa-view.tsx(+test) (delete in Task 9)

src/app/(main)/komunitni-kasa/
  page.tsx                    (rewrite)
  pohyby/page.tsx             (new)
  znacka/page.tsx             (new)
  dokumenty/page.tsx          (new)
  dokumenty/stanovy/page.tsx  (new; from old stanovy/page.tsx)
  dokumenty/smernice/page.tsx (new)
  stanovy/page.tsx            (replace with permanent redirect to /komunitni-kasa/dokumenty)
```

---

### Task 1: Transaction annotations and summaries

**Files:**
- Create: `src/lib/komunitni-kasa/transaction-notes.ts`, `src/lib/komunitni-kasa/summary.ts`
- Test: `src/lib/komunitni-kasa/summary.test.ts`

**Interfaces:**
- Consumes: `RbTransaction` (`types.ts`), `isTransactionValid`, `transactionDate` (`stats.ts`).
- Produces:
  ```ts
  export const TRANSACTION_CATEGORY = { NAKUP: "nakup", SLUZBA: "sluzba", PROPLACENI: "proplaceni", VRACENI: "vraceni", PRIJEM: "prijem", JINE: "jine" } as const;
  export type TransactionCategory = (typeof TRANSACTION_CATEGORY)[keyof typeof TRANSACTION_CATEGORY];
  export const TRANSACTION_CATEGORY_LABELS: Record<TransactionCategory, string>; // "Nákup","Služba","Proplacení","Vrácení družstvu","Příjem","Ostatní"
  export interface TransactionNote { description: string; category: TransactionCategory }
  export const TRANSACTION_NOTES: Readonly<Record<number, TransactionNote>>;          // transaction-notes.ts
  export interface AnnotatedTransaction { tx: RbTransaction; date: Date; description: string; category: TransactionCategory; amount: number }
  export function stripCardNumber(text: string): string;
  export function annotateTransactions(txs: RbTransaction[], notes?: Readonly<Record<number, TransactionNote>>): AnnotatedTransaction[]; // valid only, newest first
  export interface PeriodSummary { income: number; spending: number; refunds: number; count: number }
  export function summarizePeriod(items: AnnotatedTransaction[], from: Date, to: Date): PeriodSummary;
  export function monthRange(now: Date): { from: Date; to: Date };
  export function yearRange(now: Date): { from: Date; to: Date };
  export function recentExpenses(items: AnnotatedTransaction[], limit: number): AnnotatedTransaction[];
  export const RECENT_EXPENSES_LIMIT = 6;
  ```

- [ ] **Step 1: Seed `TRANSACTION_NOTES`** with the 7 live outgoing transactions (fetched 2026-11-06 from the RB API):

  | idTransaction | amount | bank text | note |
  |---|---|---|---|
  | 9615689405 | −7 500 | Kompletní vyklízení a reorganizace skladu | „Vyklizení a reorganizace skladu“, `sluzba` |
  | 8496134238 | −4 582 | PAVIAAN CO. — Vrácení nevyčerpané části příspěvky | „Vrácení nevyčerpané části příspěvku (PAVIAAN)“, `vraceni` |
  | 8496132169 | −1 309 | Vrácení nevyčerpané části příspěvky | „Vrácení nevyčerpané části příspěvku“, `vraceni` |
  | 8287447039 | −169 | Proplacení účtenky zaměstanci | „Proplacení účtenky“, `proplaceni` |
  | 7784585443 | −7 500 | Úhrada faktury č. 20250013 | „Úhrada faktury č. 20250013“, `sluzba` |
  | 9696896027 | −30 | PK:…7726 KSDS; Praha 1 | **ask the owner** |
  | 8246692614 | −5 640 | PK:…9798 zasilkovna.cz | **ask the owner** |

  For the last two, ask the owner for a one-line purpose before committing; if no answer, leave them out (fallback applies). Add a file header comment: how to add a line (id from „Všechny pohyby“ or the RB page), categories, and that `vraceni` is excluded from spending.

- [ ] **Step 2: Write failing tests** in `summary.test.ts`:
  ```ts
  it("stripCardNumber removes PK card masks", () => {
    expect(stripCardNumber("PK:408361XXXXXX7726")).toBe("");
    expect(stripCardNumber("PK:408361XXXXXX9798 zasilkovna.cz; Praha 9, LIBE; CZE")).toBe("zasilkovna.cz; Praha 9, LIBE; CZE");
  });
  it("annotate uses the note when present", ...)          // description + category from notes, amount kept signed
  it("annotate falls back to bank text without card number, category jine for outgoing, prijem for incoming", ...)
  it("annotate falls back to 'Platba kartou' when bank text is only a card mask", ...)
  it("annotate drops invalid transactions and sorts newest first", ...)
  it("summarizePeriod excludes refunds from spending and reports them separately", () => {
    // income 18000, sluzba -7500, vraceni -4582 in range → { income: 18000, spending: 7500, refunds: 4582, count: 3 }
  });
  it("summarizePeriod counts unannotated outgoing as spending", ...)
  it("summarizePeriod with no items in range is all zeros, count 0", ...)
  it("monthRange/yearRange are inclusive of first instant, exclusive of next period", ...) // now = 2026-11-06 → 2026-11-01..2026-12-01, 2026-01-01..2027-01-01 (local time)
  it("recentExpenses returns only outgoing non-refund items, newest first, at most limit", ...)
  ```

- [ ] **Step 3: Run** `pnpm vitest run src/lib/komunitni-kasa/summary.test.ts` — expected FAIL (module not found).

- [ ] **Step 4: Implement** `summary.ts`. Description fallback order: note → `stripCardNumber(info)` → `stripCardNumber(accountName)` → „Platba kartou“ if a card mask was present, else „Bez popisu“. Spending = `|amount|` of outgoing items whose category ≠ `vraceni`.

- [ ] **Step 5: Run** the test file — expected PASS. Run `pnpm tsc --noEmit` — no errors.

- [ ] **Step 6: Commit** `feat(kasa): annotate transactions and summarise periods`.

---

### Task 2: Směrnice content

**Files:**
- Create: `src/lib/komunitni-kasa/smernice-data.ts`
- Test: `src/lib/komunitni-kasa/smernice-data.test.ts`

**Interfaces:**
- Consumes: `StanovyArticle` (`types.ts`) — reuse shape `{ number, title, paragraphs }`.
- Produces:
  ```ts
  export const SMERNICE_IS_DRAFT = true;
  export const SMERNICE_TITLE = "Směrnice o rozhodování o výdajích";
  export const SMERNICE_DRAFT_LABEL = "Návrh · zatím neschváleno";
  export const SMERNICE_ARTICLES: StanovyArticle[];                 // čl. 1–6
  export interface ExpenseKind { id: "provozni" | "strategicke"; title: string; whoDecides: string; summary: string; examples: string[]; rule: string }
  export const EXPENSE_KINDS: [ExpenseKind, ExpenseKind];
  export interface CycleStep { title: string; description: string; icon: "users" | "clipboard-list" | "vote" | "receipt" }
  export const DECISION_CYCLE: CycleStep[];                          // 4 steps
  export const OPERATIONAL_LIMIT_EXAMPLE: { members: number; contribution: number; percent: number }; // { 45, 190, 30 }
  ```

- [ ] **Step 1: Write failing tests:** six articles numbered 1–6 with titles „Základní zásady“, „Potřeby členů a plán výdajů“, „Provozní výdaje“, „Strategické výdaje“, „Transparentnost a označení“, „Závěrečná ustanovení“; `SMERNICE_IS_DRAFT === true`; `EXPENSE_KINDS` ids in order `provozni`, `strategicke`; `DECISION_CYCLE.length === 4`; limit example computes to 2 565 (`45 * 190 * 0.3`).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** Article paragraphs are transcribed verbatim from `~/development/timii/kom_kasa/dokumenty/smernice_o_vydajich_obsah.tex` (text also in `dokumenty/build/09b_smernice_o_vydajich_brand.pdf`); keep lettered sub-items a)–e) of čl. 4 odst. 1 inside one paragraph string joined with line breaks. Explainer copy (plain language, not legal):
  - provozní: whoDecides „Rozhoduje předseda spolku“; summary „Jednorázové nákupy pro chod spolku a podporu členů.“; examples „kancelářské potřeby“, „vybavení“, „drobné služby“, „společné akce“; rule „Za měsíc nejvýš 30 % příspěvků z minulého měsíce.“
  - strategické: whoDecides „Schvalují družstva hlasováním“; summary „Opakované platby, komunitní role, rozpočty housů a vše nad limit.“; examples „předplatné“, „komunitní role“, „rozpočet housu“, „výdaje z darů“; rule „Každé družstvo má jeden hlas, lhůta 7 dní. Kdo neodpoví, hlasuje proti. Rozhoduje většina všech družstev.“
  - cycle: „Družstva sdílí potřeby“ (TAP Spirit, zpravidla první středa v měsíci) → „Předseda připraví plán“ (na další měsíc) → „Družstva hlasují o strategických výdajích“ → „Výdaj je vidět v Tappce a označený“.
- [ ] **Step 4: Run** — PASS. **Step 5: Commit** `feat(kasa): add směrnice content and explainer data`.

---

### Task 3: Brand constants and SVG asset templates

**Files:**
- Create: `src/lib/komunitni-kasa/brand/constants.ts`, `src/lib/komunitni-kasa/brand/assets.ts`
- Test: `src/lib/komunitni-kasa/brand/assets.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // constants.ts
  export const KASA_COLORS = { RED: "#A3202E", INK: "#2B1B1E", MUTED: "#6E5F61", WHITE: "#FFFFFF", MUTED_ON_DARK: "#E3D6D6" } as const;
  export const KASA_COLOR_SPECS: { name: string; hex: string; rgb: string; cmyk: string }[]; // Červená 163 32 46 / 0 80 72 36, Tmavá 43 27 30 / 0 37 30 83, Bílá
  export const KASA_MARK_SEGMENTS_PATH: string;   // SEG6 copied verbatim from kom_kasa/oznaceni/src.html
  export const KASA_MARK_COIN = { cx: 50, cy: 50, r: 11 } as const;
  export const KASA_OFFICIAL_TEXTS: { id: "plna" | "kratka" | "akce" | "role" | "en"; label: string; text: string }[]; // exact sentences from Global Constraints
  export const KASA_CONTACT = { profileId: "4056f252-0b8e-4435-be86-b03af8b261c6", fallbackName: "Julie Holá" } as const;
  // assets.ts
  export type FontFamily = "Poppins" | "Roboto";
  export interface KasaAsset { id: KasaAssetId; name: string; hint: string; width: number; height: number; pngWidth: number; mm?: [number, number]; fonts: FontFamily[]; body: () => string }
  export type KasaAssetId = "logo" | "logo-bile" | "sestava" | "samolepka" | "tkany" | "odznak" | "odznak-tmavy" | "prispevek" | "banner";
  export const KASA_ASSETS: KasaAsset[];
  export interface RolePosterFields { role: string; kdo: string; druzstvo: string; obdobi: string; napln: string }
  export function rolePosterAsset(fields: RolePosterFields): KasaAsset;  // id "plakat", 840×1188, mm [210,297], pngWidth 2480
  export function stickerSheetAsset(): KasaAsset;                        // id "arch-samolepek", A4
  export const STICKER_SHEET = { columns: 3, rows: 10, stickerMm: [60, 25], gapMm: [5, 2] } as const;
  export function escapeSvgText(s: string): string;
  export function wrapLines(text: string, maxChars: number, maxLines: number): string[];
  export function buildSvgDocument(asset: KasaAsset, fontCss?: string): string;  // full <svg xmlns ... viewBox width/height (mm when set)> with optional <style> + body
  ```
  `KasaAssetId` + "plakat" + "arch-samolepek" are the file base names for downloads.

- [ ] **Step 1: Write failing tests:**
  ```ts
  it("mark path matches the manual", () => expect(KASA_MARK_SEGMENTS_PATH.startsWith("M30.56 8.31A46 46 0 0 1 69.44 8.31")).toBe(true));
  it("exposes the nine manual assets in order", () => expect(KASA_ASSETS.map(a => a.id)).toEqual(["logo","logo-bile","sestava","samolepka","tkany","odznak","odznak-tmavy","prispevek","banner"]));
  it("sticker is 60×25 mm and woven label 40×15 mm", ...)
  it("buildSvgDocument sets mm size when the asset has mm and px otherwise", ...)
  it("buildSvgDocument embeds font css only when given", ...)
  it("escapeSvgText escapes & < > \" '", () => expect(escapeSvgText(`<a & "b">`)).toBe("&lt;a &amp; &quot;b&quot;&gt;"));
  it("wrapLines wraps at word boundaries, keeps paragraphs, caps lines", () => {
    expect(wrapLines("a ".repeat(200), 48, 6)).toHaveLength(6);
    expect(wrapLines("první\ndruhý", 48, 6)).toEqual(["první", "druhý"]);
  });
  it("wrapLines hard-splits a single word longer than maxChars", () => expect(wrapLines("x".repeat(100), 48, 6).every(l => l.length <= 48)).toBe(true));
  it("role poster escapes user input", () => expect(rolePosterAsset({ role: "<script>", kdo: "A & B", druzstvo: "", obdobi: "", napln: "" }).body()).not.toContain("<script>"));
  it("sticker sheet places 30 stickers", () => expect(stickerSheetAsset().body().match(/data-sticker/g)).toHaveLength(30));
  it("every asset that renders text declares its fonts", ...) // body contains font-family="X" ⇒ fonts includes X
  ```
- [ ] **Step 2: Run** `pnpm vitest run src/lib/komunitni-kasa/brand` — FAIL.
- [ ] **Step 3: Implement.** Port `mark`, `markAt`, `lockup` and each `FILES[*].draw` from `~/development/timii/kom_kasa/oznaceni/src.html` (inline script) as typed functions with identical coordinates, sizes and copy; replace the manual's `naplnLines` with `wrapLines(text, 48, 6)` + `escapeSvgText`. Sticker sheet: A4 210×297 mm viewBox in mm, sticker grid centred, each sticker an `<svg data-sticker x y width=60 height=25 viewBox="0 0 600 250">` reusing the `samolepka` body.
- [ ] **Step 4: Run** — PASS. **Step 5: Commit** `feat(kasa): port brand mark and asset templates`.

---

### Task 4: Shared access gate, mark component, export helpers, route skeleton

**Files:**
- Create: `src/lib/komunitni-kasa/access.ts`, `src/components/komunitni-kasa/kasa-mark.tsx`, `src/lib/komunitni-kasa/brand/export.ts`
- Modify: `src/app/(main)/komunitni-kasa/stanovy/page.tsx` (→ redirect)
- Test: `src/components/komunitni-kasa/kasa-mark.test.tsx`

**Interfaces:**
- Consumes: `getSessionProfile`, `canAccessFeature`, `BetaCohort`, `FeatureComingSoon`; brand constants/assets from Task 3.
- Produces:
  ```ts
  export async function checkKasaAccess(): Promise<{ allowed: true } | { allowed: false; fallback: React.ReactNode }>; // redirects to /auth/login when no profile
  export function KasaMark(props: { className?: string; tone?: "brand" | "current"; title?: string }): JSX.Element; // brand = KASA_COLORS.RED fill; current = currentColor; decorative (aria-hidden) unless title given
  // export.ts ("use client" consumers only)
  export async function loadFontCss(families: FontFamily[]): Promise<string>;  // @font-face rules with base64 woff2 from src/app/fonts (poppins-600/700, roboto-400/500), cached
  export async function svgToPngBlob(svg: string, widthPx: number, heightPx: number): Promise<Blob>; // await document.fonts.ready after injecting font css
  export function downloadBlob(blob: Blob, filename: string): void;
  export async function downloadAsset(asset: KasaAsset, format: "svg" | "png"): Promise<void>;
  export async function downloadAllAssetsZip(assets: KasaAsset[]): Promise<void>;          // "komunitni-kasa-znacka.zip": svg/ + png/
  ```

- [ ] **Step 1:** Read `node_modules/next/dist/docs/` for `redirect`/`permanentRedirect` and for importing static font files as URLs in this Next version; choose how `loadFontCss` fetches `src/app/fonts/*.woff2` (copy the needed four files to `public/fonts/kasa/` with `OFL.txt` and Roboto licence if module URL imports are not supported). Verify the woff2 files include Latin-Extended glyphs (ř, ů, ž); if they are Latin-only subsets, copy full TTFs from `~/development/timii/kom_kasa/oznaceni/latex/fonts/` and `kom_kasa/dokumenty/fonts/` instead.
- [ ] **Step 2: Write failing test** `kasa-mark.test.tsx`: renders one `path` + one `circle`; `aria-hidden="true"` without title; `role="img"` and `<title>` with title; `tone="current"` uses `currentColor`.
- [ ] **Step 3: Run** — FAIL. **Step 4: Implement** `KasaMark`, `checkKasaAccess` (extract the gate copied in today's two pages), `export.ts`, and replace `stanovy/page.tsx` with `permanentRedirect("/komunitni-kasa/dokumenty")`.
- [ ] **Step 5: Run** `pnpm test` and `pnpm tsc --noEmit` — PASS. **Step 6: Commit** `feat(kasa): shared gate, mark component and asset export`.

---

### Task 5: Main page

**Files:**
- Create: `src/components/komunitni-kasa/kasa-overview.tsx`, `decision-explainer.tsx`, `kasa-contact.tsx`
- Rewrite: `src/app/(main)/komunitni-kasa/page.tsx`
- Test: `kasa-overview.test.tsx`, `decision-explainer.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`annotateTransactions`, `summarizePeriod`, `monthRange`, `yearRange`, `recentExpenses`, `RECENT_EXPENSES_LIMIT`, `TRANSACTION_CATEGORY_LABELS`), Task 2 (`EXPENSE_KINDS`, `DECISION_CYCLE`, `SMERNICE_IS_DRAFT`, `SMERNICE_DRAFT_LABEL`), Task 3 (`KASA_CONTACT`), Task 4 (`checkKasaAccess`, `KasaMark`), existing `BalanceTrendChart`, `computeBalanceTrend`, `formatCzk`, `getProfileById`, `getProfilePictureUrl`.
- Produces: `KasaOverview()` (client), `DecisionExplainer()` (server), `KasaContact()` (async server).

Page order (server `page.tsx`): header (`KasaMark` 36 px + h1 „Komunitní kasa“ + „Společné peníze všech družstev. Každý člen přispívá 190 Kč měsíčně.“) → `<KasaOverview/>` (sections „Stav kasy“, „Kam jdou peníze“) → `<DecisionExplainer/>` → `<KasaContact/>` → footer links „Značka a materiály“ (`/komunitni-kasa/znacka`), „Dokumenty spolku“ (`/komunitni-kasa/dokumenty`). Header and everything outside `KasaOverview` render even while bank data loads or fails.

Stav kasy: balance large + `tabular-nums`; line „Tento měsíc: +X příjmy · −Y výdaje“ or „Tento měsíc zatím bez pohybu“; quieter line „Letos: příjmy X · výdaje Y · vráceno družstvům Z“ (omit the refunds part when 0); account number with copy (`Button variant="ghost" size="sm"`), „Otevřít v bance“ link (existing `RB_TRANSPARENT_URL`); `BalanceTrendChart`. Kam jdou peníze: up to 6 rows (date `d. M. yyyy`, description, category label as small muted text, amount); empty → „Zatím tu nejsou žádné výdaje“; link „Zobrazit všechny pohyby“ → `/komunitni-kasa/pohyby`.

- [ ] **Step 1: Write failing tests** (`kasa-overview.test.tsx`, mock `fetch` like today's test; freeze time with `vi.setSystemTime(new Date("2026-11-06T12:00:00"))`):
  - shows balance `formatCzk(18000)`;
  - with no transactions in November shows „Tento měsíc zatím bez pohybu“ and no „0 Kč“ in that line;
  - lists an annotated expense description and its category label; does **not** list a `vraceni` transaction under Kam jdou peníze;
  - shows refunds in the „Letos“ line when present;
  - unannotated `PK:408361XXXXXX7726` card payment renders without the card number;
  - fetch rejects → alert „Data se nepodařilo načíst“ with „Načíst znovu“; clicking it refetches.
  (`decision-explainer.test.tsx`): renders `SMERNICE_DRAFT_LABEL` when draft; both kind titles; four cycle step titles; link „Celé znění směrnice“ → `/komunitni-kasa/dokumenty/smernice`; draft label absent when the flag is mocked false (`vi.mock` the data module).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** `KasaContact`: `getProfileById(supabase, KASA_CONTACT.profileId)`; render avatar (existing avatar component used by komunita, e.g. `ProfileAvatar`), name, „S dotazy ke kase se obrať na Julii.“, link to `/komunita/profil/<id>`; on null/error render `KASA_CONTACT.fallbackName` without avatar. Explainer: two kinds side by side on ≥ sm (stacked on mobile), each with a lucide icon (`Wallet` for provozní, `Vote` for strategické), the rule line and the limit example („Např. 45 členů × 190 Kč → limit 2 565 Kč“); cycle as a numbered horizontal row on ≥ md, vertical list on mobile, icons from `CycleStep.icon`.
- [ ] **Step 4: Run** `pnpm test` — PASS. Check `/komunitni-kasa` in the running app in light + dark and at 375 px.
- [ ] **Step 5: Commit** `feat(kasa): redesign main overview page`.

---

### Task 6: All transactions page

**Files:**
- Create: `src/components/komunitni-kasa/transactions-view.tsx`, `src/app/(main)/komunitni-kasa/pohyby/page.tsx`
- Test: `src/components/komunitni-kasa/transactions-view.test.tsx`

**Interfaces:**
- Consumes: `TransactionsTable`, `filterTransactions`, `TransactionFilter`, `checkKasaAccess`; annotations from Task 1 for display text.
- Produces: `TransactionsView()` (client; fetches `/api/komunitni-kasa`, search input + Select filter as today).

- [ ] **Step 1: Failing tests:** search narrows rows; „Jen výdaje“ hides incoming; card numbers not shown; error state with retry.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** (move search/filter/table code out of the old view; `PageHeader` title „Všechny pohyby“, back → `/komunitni-kasa`). If `TransactionsTable` renders raw `info`, pass annotated descriptions instead (extend its props with an optional `describe?: (tx: RbTransaction) => string`).
- [ ] **Step 4: Run** — PASS. **Step 5: Commit** `feat(kasa): move full transaction list to its own page`.

---

### Task 7: Documents area

**Files:**
- Create: `src/components/komunitni-kasa/document-list.tsx`, `smernice-view.tsx`, `src/app/(main)/komunitni-kasa/dokumenty/page.tsx`, `dokumenty/stanovy/page.tsx`, `dokumenty/smernice/page.tsx`
- Modify: `src/components/komunitni-kasa/stanovy-view.tsx` (keep search + expandable articles; remove overview card and tabs), `src/lib/komunitni-kasa/stanovy-data.ts` + `types.ts` (drop `pdfSoubor` if unused)
- Test: `document-list.test.tsx`, update `stanovy-view.test.tsx`

**Interfaces:**
- Consumes: `SPOLOK_REJSTRIK_INFO`, `PLATNE_STANOVY_2026`, `ZAPIS_CLENSKE_SCHUZE_2026`, Task 2 (`SMERNICE_ARTICLES`, `SMERNICE_TITLE`, `SMERNICE_IS_DRAFT`, `SMERNICE_DRAFT_LABEL`), `checkKasaAccess`.
- Produces: `DocumentList()`; `SmerniceView()`; `StanovyView()` (articles only).

Document rows (icon, name, one-line description, date/status, one action):
1. Stanovy — „Pravidla spolku: účel, členství, orgány a hospodaření.“ — „Platné od 3. 6. 2026“ — „Číst“ → `/komunitni-kasa/dokumenty/stanovy`
2. Směrnice o rozhodování o výdajích — „Kdo a jak rozhoduje o výdajích z kasy.“ — badge „Návrh“ — „Číst“ → `/komunitni-kasa/dokumenty/smernice`
3. Zápis z členské schůze 3. 6. 2026 — external „Otevřít v Sbírce listin“ → `SPOLOK_REJSTRIK_INFO.links.sbirkaListin`
4. Výpis ze spolkového rejstříku — external → `SPOLOK_REJSTRIK_INFO.links.rejstrik`
Identity line above: name · IČO formatted · sp. zn.

- [ ] **Step 1: Failing tests:** four rows with the names above; internal links point to the two routes; external links have `target="_blank"` and `rel="noopener noreferrer"`; „Návrh“ badge on the směrnice row only; `SmerniceView` renders six article headings and the draft label; `StanovyView` search still filters articles.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** Reading pages use `PageHeader` with back → `/komunitni-kasa/dokumenty`, a readable measure (`max-w-prose`), article headings `Čl. N · Title`.
- [ ] **Step 4: Run** — PASS; check `/komunitni-kasa/stanovy` redirects. **Step 5: Commit** `feat(kasa): replace stanovy subpage with documents area`.

---

### Task 8: Brand page

**Files:**
- Create: `src/components/komunitni-kasa/brand/asset-gallery.tsx`, `role-poster-tool.tsx`, `sticker-sheet-tool.tsx`, `usage-rules.tsx`, `official-texts.tsx`, `src/app/(main)/komunitni-kasa/znacka/page.tsx`
- Test: `asset-gallery.test.tsx`, `role-poster-tool.test.tsx`, `official-texts.test.tsx`

**Interfaces:**
- Consumes: Task 3 (`KASA_ASSETS`, `rolePosterAsset`, `stickerSheetAsset`, `buildSvgDocument`, `KASA_COLOR_SPECS`, `KASA_OFFICIAL_TEXTS`), Task 4 (`downloadAsset`, `downloadAllAssetsZip`, `KasaMark`, `checkKasaAccess`).

Page order: `PageHeader` „Značka a materiály“ (back → `/komunitni-kasa`) + one paragraph why we label (required by čl. 5 odst. 3 of the směrnice, which is a draft) → **Ke stažení**: „Stáhnout vše (ZIP)“ primary button, then a responsive grid of tiles (preview on neutral surface — dark surface for `logo-bile`/`odznak-tmavy`/`tkany`, name, hint, „SVG“ + „PNG“ buttons) → **Nástroje**: role poster (fields Role, Kdo ji zastává, Družstvo, Období, Náplň role — textarea; live preview; download SVG/PNG; fields start empty with short placeholders, the Náplň placeholder is the manual's sample text „Koordinuje společné akce a setkání TAP Spirit, pečuje o klubovnu a společné vybavení a sbírá potřeby družstev pro měsíční plán výdajů.“), sticker sheet (preview + SVG/PNG download, note „A4, 30 samolepek 60 × 25 mm, tiskni na matný vinyl s laminací“) → **Jak značku používat**: color swatches with copy HEX, type samples, clear space + min size („10 mm v tisku, 24 px na obrazovce“), four don'ts as small illustrated tiles (distorted, recolored, shadow, rotated mark with a cross icon), placement list (samolepka, tkaný štítek, slidy pravý dolní roh ~6 % výšky, sítě 1080 × 1080, dokument zápatí vlevo 45 mm, e-mail jen věta) → **Texty** with copy buttons → **Co značka znamená** (three lines) → footer note „Před tiskem konzultuj s Brand House; pro tiskárnu převeď písmo v SVG na křivky.“

- [ ] **Step 1: Failing tests:** gallery renders nine tiles with their names and two download buttons each; clicking „SVG“ calls `downloadAsset(asset, "svg")` (mock `export.ts`); ZIP button calls `downloadAllAssetsZip(KASA_ASSETS)`; poster preview updates when typing into „Role“ and escapes `<b>`; texts: five sentences verbatim and copy calls `navigator.clipboard.writeText` with the exact text + success toast.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** Previews render `buildSvgDocument(asset)` via `dangerouslySetInnerHTML` only for template output (user fields are escaped in Task 3) or as `<img src="data:image/svg+xml;...">` with alt text = asset name.
- [ ] **Step 4: Run** — PASS. Manually download every asset as PNG in the browser and confirm Poppins/Roboto with Czech diacritics (Review Focus 1); open the sticker-sheet SVG at 100 % and check sticker size 60 × 25 mm.
- [ ] **Step 5: Commit** `feat(kasa): add brand page with downloads and generators`.

---

### Task 9: Cleanup, navigation, full verification

**Files:**
- Delete: `src/components/komunitni-kasa/komunitni-kasa-view.tsx`, `komunitni-kasa-view.test.tsx`, `cashflow-chart.tsx` (and `computeMonthlyCashflow` + its tests in `stats.ts`/`stats.test.ts` if no longer referenced)
- Modify: `src/lib/navigation.ts:43` description → „Stav kasy, kam jdou peníze, pravidla a značka.“; `src/lib/navigation.test.ts` if it asserts the description; page `metadata` descriptions for each new route.

- [ ] **Step 1:** `grep -rn "komunitni-kasa-view\|CashflowChart\|computeMonthlyCashflow\|/komunitni-kasa/stanovy" src tests` — only the redirect page may reference `/stanovy`.
- [ ] **Step 2:** Delete/modify as listed. **Step 3:** `pnpm test`, `pnpm tsc --noEmit`, `pnpm lint` — all pass.
- [ ] **Step 4:** In the running app, visit all six routes in light and dark at 375 px and desktop; with network offline for the RB call confirm Review Focus 3.
- [ ] **Step 5: Commit** `chore(kasa): remove old view and update navigation`.
