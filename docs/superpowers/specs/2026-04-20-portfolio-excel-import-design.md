# Portfolio Excel Import — Design Spec

**Date:** 2026-04-20  
**Branch:** esejbanka  
**Status:** Approved

---

## Overview

A new `/portfolio` page where users upload their `.xlsx` portfolio file. The app parses it client-side, detects which sheets it knows how to render, lets the user select sheets, and displays a pretty read-only table. No data is written to the database. State is session-only (refresh = gone).

---

## Architecture

### New files

```
app/(main)/portfolio/page.tsx
components/portfolio/portfolio-uploader.tsx
components/portfolio/sheet-selector.tsx
components/portfolio/sheets/eseje-table.tsx
lib/portfolio/registry.ts
lib/portfolio/parsers/eseje.ts
```

### Data flow

1. User drops or picks a `.xlsx` file on the upload zone
2. SheetJS (`xlsx` package) reads and parses the file entirely in the browser — no API call
3. The app reads all sheet names from the workbook
4. It checks each name against the **sheet registry** (`lib/portfolio/registry.ts`)
   - Known sheets → selectable
   - Unknown sheets → listed but grayed out ("Nepodporováno")
5. User selects one or more sheets to render
6. Each selected sheet renders its own typed table component below the selector
7. Page refresh clears everything

---

## Sheet Registry

`lib/portfolio/registry.ts` exports a map of `sheetName → { parser, renderer }`.

```ts
export const SHEET_REGISTRY: Record<string, SheetDefinition> = {
  Eseje: {
    label: 'Eseje',
    parser: parseEsejeSheet,
    component: EsejeTable,
  },
};
```

Adding future sheet types = adding one entry here + a parser + a renderer.

---

## Eseje Parser

`lib/portfolio/parsers/eseje.ts`

Reads rows from the "Eseje" sheet. Expected columns (by position or header name):
- Column A: row number (skip)
- Column B: Název knihy/Zdroje
- Column C: Autor
- Column D: Odkaz na esej (hyperlink — extract URL + display text)
- Column E: Kategorie
- Column F: Zdroj
- Column G: Počet bodů (number)

Rows where `Název knihy` is empty are skipped. Returns typed array:

```ts
interface EsejeRow {
  index: number;
  bookTitle: string;
  author: string;
  essayUrl: string | null;
  category: string;
  source: string;
  points: 1 | 2 | 3 | null;
}
```

---

## Eseje Table Component

`components/portfolio/sheets/eseje-table.tsx`

### Summary bar (above table)
- Total books (non-empty rows)
- Total points (sum of Počet bodů)
- Most common category

### Table columns
| # | Název knihy | Autor | Esej | Kategorie | Zdroj | Body |
|---|-------------|-------|------|-----------|-------|------|

### Visual details
- **Sticky header** on scroll
- **Alternating row shading** for readability
- **Points** rendered as filled/empty dots: ●●○ (2 of 3) or colored badge (1=green, 2=blue, 3=purple)
- **Essay link** rendered as a small button with external link icon, opens in new tab; shown as dash if no URL
- **Category** rendered as a subtle pill/badge
- Empty rows (no book title) from the Excel are filtered out

---

## Upload Zone

`components/portfolio/portfolio-uploader.tsx`

- Drag-and-drop zone + file picker button
- Accepts `.xlsx` only
- On file select: parse with SheetJS, run registry detection, transition to sheet-selector state
- Error state if file is not valid Excel or has no recognized sheets

---

## Sheet Selector

`components/portfolio/sheet-selector.tsx`

- Lists all sheets found in the workbook
- Known sheets: checkboxes (enabled, checked by default)
- Unknown sheets: listed but disabled with "Nepodporováno" label
- "Zobrazit" button triggers rendering

---

## Sidebar

Add "Portfolio" to the "Čtení" section in `components/app-sidebar.tsx`, using a `BriefcaseBusiness` or `FolderOpen` icon from lucide-react, pointing to `/portfolio`.

---

## Dependencies

- `xlsx` (SheetJS) — client-side Excel parsing. Must be added to `package.json`.

### SheetJS hyperlink extraction note

Hyperlinks in `.xlsx` files are not stored in cell values — they live in `ws['D3'].l?.Target`. The Eseje parser must iterate cells directly (not use `sheet_to_json`) to extract both the display text and the URL from column D.

---

## What is NOT in scope

- Writing any data to the database
- Persisting the uploaded file or parsed data between sessions
- Editing table data
- Exporting data back to Excel
