# Týmová reflexe — Design

## Overview

Měsíční reflexe týmové spolupráce. Tým se ohlíží za uplynulým měsícem, hodnotí co fungovalo a nefungovalo, a plánuje akční kroky. Slouží zároveň jako příprava na Houston Calling.

## User Story

Jako člen týmu chci mít sdílený dokument pro každý měsíc, kde všichni v týmu můžeme:
- Založit reflexi za aktuální měsíc (první kdo přijde)
- Vyplnit společná pole — co se povedlo, co ne, co uděláme jinak, akční kroky
- Kdykoliv upravovat
- Vidět historii minulých měsíců

## Scope (Fáze 1)

- **Pouze měsíční reflexe** — semestrální (leden/květen) odloženo
- **Pouze formulář + historie** — žádné heatmapy, žádné grafy
- **Žádné notifikace** — tým si hlídá sám
- **Žádné sdílení s koučem** — kouč vidí přes týmový přehled

## Data Model

### Tabulka: `team_reflections`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | defaultRandom |
| team_id | uuid FK → teams | not null |
| month | date | první den v měsíci (např. 2026-07-01), not null |
| what_went_well | text | nullable |
| what_didnt_go_well | text | nullable |
| what_we_do_differently | text | nullable |
| planned_action_steps | text | nullable |
| responsible_person | text | nullable |
| removed_at | timestamptz | soft-delete |
| created_at | timestamptz | default now |
| updated_at | timestamptz | default now |
| created_by_profile_id | uuid FK → profiles | not null |
| updated_by_profile_id | uuid FK → profiles | not null |

**Constraint:** UNIQUE(team_id, month) — jen jedna reflexe na měsíc

### RLS

- All authenticated members of the team can SELECT
- All authenticated members of the team can INSERT (with check: user is in team)
- All authenticated members of the team can UPDATE (with check: user is in team)
- All authenticated members of the team can DELETE (soft) (with check: user is in team)

## Route

- `/tymova-reflexe` — hlavní stránka. Beta-gated (jako koucovani).
- Redirect pokud uživatel není v týmu.

## Component Tree

```
app/(main)/tymova-reflexe/page.tsx    (Server)
├── InfoCard
└── TeamReflectionList                 ("use client")
    ├── TeamReflectionForm             ("use client") — create/edit dialog
    └── TeamReflectionCard             ("use client") — display + inline edit
```

## Data Flow (Server → Client)

1. Page fetches: profile → team_id, all team_reflections for team (ordered by month desc)
2. Passes serialized data as props to TeamReflectionList
3. Client manages state via useState (initialized from server data)
4. CRUD mutations via supabase-js browser client (insert/update/delete + .select())

## Architecture

### Files to create

```
db/schema/team-reflections.ts           — Drizzle table definition
src/lib/tymy/types.ts                  — Team reflection types (nebo nový lib/tymova-reflexe/)
src/lib/tymy/queries.ts                — Team reflection queries
src/components/tymova-reflexe/         — Feature components
  info-card.tsx
  team-reflection-list.tsx
  team-reflection-form.tsx
  team-reflection-card.tsx
src/app/(main)/tymova-reflexe/page.tsx  — Route
```

### Existing files to modify

```
src/components/app-sidebar.tsx          — přidat položku do navigace
```

## UI/UX

- Layout kopíruje `koucovani` — container max-w-5xl, stejné paddingy
- Seznam seskupený podle měsíců (jako koucovani)
- Každá karta zobrazuje všech 5 polí
- Tlačítko "Nová reflexe" — otevře dialog s formulářem
- Pokud už pro daný měsíc existuje reflexe, tlačítko vede na editaci
- Karta má tlačítka Upravit / Smazat

## Fields Mapping (Issue → DB)

| Issue field | DB column | Form label |
|---|---|---|
| Měsíc | month | Měsíc reflexe |
| Co se povedlo | what_went_well | Co se povedlo |
| Co se nepovedlo | what_didnt_go_well | Co se nepovedlo |
| Co uděláme jinak | what_we_do_differently | Co uděláme jinak |
| Plánované akční kroky | planned_action_steps | Plánované akční kroky |
| Zodpovědná osoba | responsible_person | Zodpovědná osoba za AK |

## Testing

- Unit tests for types/helpers
- Component tests for form validation
- Integration tests for RLS policies
