# Standardy kódu a párového programování (AGENTS.md)

Tento dokument shrnuje zásadní technická a stylistická pravidla platná pro všechny vývojáře:vývojářky i AI asistenty (agenty) pracující v repozitáři Tappka.

---

## 1. Styl kódu v TypeScriptu

- **Striktní režim:** `strict: true` bez výjimek. Použití typu `any` je přísně zakázáno (místo něj použij `unknown` nebo přesné generické typy).
- **Rozhraní vs. Typy:**
  - Vždy preferuj `interface` před `type` pro definici objektových struktur a props komponent.
  - Výjimka: Odvozené databázové typy (`Tables<'...'>`, `Database['public']['Enums']['...']`), které musí zůstat jako `type`.
- **Nullish coalescing:** Důsledně preferuj operátor `??` před `||`, aby se předešlo nechtěnému přepsání prázdných řetězců nebo nul.
- **Konstanty:** Žádné magické hodnoty v kódu. Všechny konstanty extrahuj do pojmenovaných proměnných nebo objektů s `as const`.

---

## 2. Jmenné konvence a struktura souborů

| Entita | Konvence | Příklad |
| :--- | :--- | :--- |
| **Komponenty a Typy** | `PascalCase` | `ReservationCard`, `CreateReservationInput` |
| **Funkce a proměnné** | `camelCase` | `calculateBookPoints`, `availableRooms` |
| **Konstanty** | `UPPER_SNAKE_CASE` | `OPERATING_HOURS`, `TIME_SLOT_MINUTES` |
| **Názvy souborů** | `kebab-case` | `pluralize-cz.ts`, `room-filter.tsx` |

### Seskupování importů:
Importy musí být striktně řazeny do tří bloků oddělených jedním prázdným řádkem:
```typescript
// 1. Externí balíčky
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// 2. Interní moduly (alias @/)
import { PageHeader } from '@/components/ui/page-header';
import { pluralizeCz } from '@/lib/utils/pluralize-cz';

// 3. Styly a statické assety
import './local-styles.css';
```

---

## 3. React a Next.js konvence

- **Server Components jako standard:** Všechny komponenty jsou ve výchozím stavu Server Components. 
- Direktiva `"use client"` se přidává **výhradně na začátek souborů**, které:
  - Využívají klientské React hooky (`useState`, `useEffect`, `useCallback`).
  - Přistupují k API prohlížeče (kamera pro skenování čárových kódů, `window`, `localStorage`).
  - Obsahují interaktivní formuláře nebo third-party klientské inicializace.
- **Formuláře a stav:** Preferuj Next.js Server Actions a `useActionState` pro čistou správu mutací.

---

## 4. Práce s databází a dotazování

- **Žádné runtime Drizzle:** Kód aplikace se dotazuje do databáze výhradně pomocí `@supabase/supabase-js`. Runtime klient Drizzle je zakázán, protože obchází bezpečnostní pravidla RLS.
- **Odvozené typy:** Nikdy ručně nepřepisuj typy tabulek. Vždy použij:
  ```typescript
  import type { Tables } from '@/lib/supabase/tables';
  export type Book = Tables<'books'>;
  ```
- **Změny schématu:** Postupuj podle [Příručky pro databázové migrace](/runbooks/database-migrations). Schéma uprav v `db/schema/` a spusť `pnpm db:migrate`.

---

## 5. Testovací disciplína

> **Nová funkce = nový test.**

- Čistá byznysová logika v `src/lib/` musí mít co-located unit test `*.test.ts`.
- Vizuální komponenty musí mít komponentní test `*.test.tsx`.
- Databázové triggery a RLS pravidla musí být otestovány v integračních testech proti Testcontainers (`pnpm test:integration`).
- Před každým commitem musí projít `pnpm test` a `pnpm typecheck`.

---

## 6. Jazyk a komunikace v UI

- V celém uživatelském rozhraní se používá **tykání**.
- Dodržuj **genderově neutrální češtinu** s dvojtečkami (`autor:ka`, `čtenář:ka`). Závorky a lomítka jsou zakázány.
- Popisky a tlačítka jsou stručné, přímé a srozumitelné.
