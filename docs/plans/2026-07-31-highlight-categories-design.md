# Kurátorské kategorie výběru knih — Design

## Overview

Nahrazuje pevný enum kategorií výběru (`ja`/`my`/`oni`/`system`) a propojovací tabulku `book_highlights` dynamickými kategoriemi, které si kouč vytváří sám. Kniha je ve výběru, právě když má nastavený FK `highlight_category_id` na `books` — okamžitě tak víš, že je zvýrazněná i do které kategorie patří.

## User Story

Jako kouč chci:
- Vytvářet, editovat a mazat kategorie výběru (jméno + popis)
- Zařadit knihu do kategorie (čímž se dostane do výběru)
- Změnit kategorii knihy, nebo ji z výběru odebrat
- Vidět kategorii knihy přímo u knihy

Jako student chci vidět označení výběru a název kategorie u knihy.

## Scope

- **Žádný limit počtu zvýrazněných knih** (zrušeno „50 vybraných")
- **Žádný popis u jednotlivé knihy** — popis žije na kategorii
- **Start prázdný** — žádné seed kategorie
- Kategorie spravují kouč/admin, čtou všichni přihlášení

## Data Model

### Tabulka: `highlight_categories`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | defaultRandom |
| name | text | not null |
| description | text | nullable |
| created_at | timestamptz | default now |
| updated_at | timestamptz | default now |
| created_by_profile_id | uuid FK → profiles | not null |
| updated_by_profile_id | uuid FK → profiles | not null |

RLS: select → `authenticated`; insert/update/delete → `is_coach_or_admin()`.

### Tabulka: `books` (změna)

| Column | Type | Notes |
|--------|------|-------|
| highlight_category_id | uuid FK → highlight_categories | nullable, `ON DELETE SET NULL`; NOT NULL ⟺ kniha je ve výběru |

### Odstranit

- `book_highlights` (propojovací tabulka z předchozí migrace)
- Enum `highlight_category`

### View: `books_with_essay_count`

Přidat sloupec `highlight_category_id` (sdílený `BOOK_PROFILES_SELECT` join `highlight_category:highlight_categories(*)` musí fungovat i pro popular-sort view).

## Data Layer

- `src/lib/books/types.ts`: `HighlightCategory` = `Tables<'highlight_categories'>`; smazat enum; `BookWithProfiles.highlight` → `highlight_category`
- `src/lib/books/queries.ts`:
  - `BOOK_PROFILES_SELECT` → `highlight_category:highlight_categories(*)`
  - `getHighlightedBooks` → `.not('highlight_category_id', 'is', null)` + inline category
  - Nová `getHighlightCategories()`
- Smaže se `getBookHighlight` (není potřeba samostatný dotaz)

## API

- `PATCH /api/books/[id]` akce `highlight` → `{ highlight_category_id: string | null }` (kouč/admin)
- `GET/POST /api/highlight-categories` — seznam / vytvoření
- `PATCH/DELETE /api/highlight-categories/[id]` — editace / smazání

## Coach Dashboard

- **Ke zpracování**: akce „Přidat do výběru" → dropdown kategorií (+ inline vytvoření nové)
- **50 vybraných** (přejmenovat na **Výběr**): knihy seskupené podle kategorie; změna kategorie, odebrání z výběru (vyčištění FK), smazání knihy
- **Správce kategorií**: vytvořit/editovat/smazat kategorii (jméno + popis) nad seznamem výběru

## Book Detail

Odznak výběru zobrazuje název kategorie místo labelu enumu.

## Migration

Nová migrace (follow-up k `20260731121037`):
- Drop `book_highlights` + enum `highlight_category`
- Create `highlight_categories` + RLS policies
- Add `books.highlight_category_id` FK
- Update view + hand-fix drop/recreate pořadí view/RPC (stejný pattern jako předchozí migrace)

Před aplikací zkontrolovat dropsy (view, enum, tabulka).

## Testing

- Unit: mapování `highlight_category` v `mapBookRow`
- Integration: RLS na `highlight_categories` (kouč/admin write, authenticated read)
- E2E: kouč vytvoří kategorii, zařadí knihu, vidí ji u knihy
