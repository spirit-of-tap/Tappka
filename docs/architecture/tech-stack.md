# Technologický stack

Projekt **Tappka** je postaven na moderním fullstack ekosystému s důrazem na typovou bezpečnost, rychlost odezvy, dlouhodobou udržitelnost a vysoký standard přístupnosti (a11y).

Níže je detailní rozbor technologií a knihoven použitých v aplikaci.

---

## 1. Souhrnná tabulka technologií

| Oblast | Technologie | Verze | Účel v aplikaci |
| :--- | :--- | :--- | :--- |
| **Framework** | [Next.js](https://nextjs.org/) | `16.3.x` | Aplikační jádro, App Router, React Server Components (RSC), Server Actions |
| **UI Knihovna** | [React](https://react.dev/) | `19.x` | Komponentový strom, moderní hooky (`useActionState`, `useOptimistic`, `cache`) |
| **Typování** | [TypeScript](https://www.typescriptlang.org/) | `5.x` | Striktní režim (`strict: true`), žádné `any`, typované dotazy z DB |
| **Stylování** | [Tailwind CSS](https://tailwindcss.com/) | `v4` | Utility-first CSS, dynamická škála, nativní CSS proměnné, tokeny z `globals.css` |
| **UI Primitiva** | [Radix UI](https://www.radix-ui.com/) | Latest | Přístupné headless komponenty (dialogy, dropdowny, akordeony, tooltips) |
| **Editor** | [Tiptap](https://tiptap.dev/) | `3.22.x` | Bohatý textový editor (WYSIWYG) pro psaní a recenzování esejů |
| **Ikony** | [Lucide React](https://lucide.dev/) | `0.511.x` | Konzistentní vektorové ikony napříč rozhraním |
| **Notifikace** | [Sonner](https://sonner.emilkowal.ski/) | Latest | Toast notifikace s podporou dark modu a akčních tlačítek |
| **Databáze** | [PostgreSQL](https://www.postgresql.org/) | `16` | Relační databáze hostovaná přes Supabase, plná podpora Row Level Security |
| **ORM / Migrace** | [Drizzle ORM](https://orm.drizzle.team/) | Latest | Deklarativní definice schématu v TypeScriptu a generování deterministických SQL migrací |
| **Backend API** | [Supabase Client](https://supabase.com/docs) | `2.91.x` | Runtime databázové dotazy přes `@supabase/supabase-js` respektující RLS |
| **Autentizace** | Supabase Auth | Native | Přihlašování přes Google Workspace SSO (školní i pracovní účty) |
| **Úložiště** | Supabase Storage | Native | Ukládání obálek knih, týmových dokumentů a příloh |
| **Realtime** | Supabase Realtime | Native | WebSocket broadcast pro okamžitou synchronizaci stavu místností a rezervací |
| **Testování** | [Vitest](https://vitest.dev/) | `3.x` | Rychlý běh unit a komponentních testů |
| **Integrace** | [Testcontainers](https://testcontainers.com/) | Latest | Izolovaný Docker kontejner s PostgreSQL 16 pro integrační testy datové vrstvy |
| **E2E Testy** | [Playwright](https://playwright.dev/) | Latest | End-to-end simulace uživatelských průchodů v reálných prohlížečích |
| **Dokumentace** | [VitePress](https://vitepress.dev/) | `2.0-alpha` | Rychlá generovaná interní wiki a portálová dokumentace (`pnpm wiki`) |
| **Telemetrie** | PostHog / Axiom / OTel | Latest | Produktová analytika, centrální strukturované logování a OpenTelemetry |

---

## 2. Architektonické vrstvy

### 2.1 Aplikační vrstva (Next.js 16 + React 19)
- **App Router:** Strukturovaný routing pod složkou `src/app/`. Hlavní aplikace běží pod layoutem `(main)`, který poskytuje jednotnou navigaci, sidebar, command paletu (Spotlight) a uživatelský kontext.
- **Data Fetching:** Data se načítají převážně na serveru v Server Components. Dotazy jsou optimalizovány přes `React.cache()` (například profil přihlášeného uživatele načtený v layoutu se znovu nenačítá v podstránkách stejného požadavku).
- **Mutace dat:** Prováděny přes Next.js Server Actions nebo specializované Route Handlery (`src/app/api/*`). Všechny mutace validují oprávnění volajícího a zapisují do databáze přes `supabase-js`.

### 2.2 Databázová a bezpečnostní vrstva (PostgreSQL 16 + RLS)
- Databáze běží lokálně v Dockeru přes Supabase CLI (`pnpm dev` / `pnpm supabase:start`).
- **Drizzle jako zdroj pravdy schématu:** Veškeré tabulky, sloupce, indexy, cizí klíče a RLS politiky jsou modelovány v souborech `db/schema/*.ts`.
- **Drizzle Kit:** Slouží k detekci rozdílů a generování čistých SQL migrací do `supabase/migrations/` (`pnpm db:migrate`). Drizzle klient se **nikdy nepoužívá za běhu aplikace**, protože by obcházel bezpečnostní pravidla RLS.
- **Striktní Row Level Security:** Každá tabulka má aktivní RLS. Uživatelé vidí pouze data svého týmu, veřejné katalogy (knihy, místnosti) nebo data, k nimž mají schválený přístup.

### 2.3 UI & Design systém (Tailwind CSS v4 + Radix UI)
- Žádné hardcodované hexadecimální barvy v komponentách. Veškeré barvy používají sémantické tokeny definované v `src/app/globals.css` (např. `bg-background`, `text-foreground`, `bg-muted`, `border-border`, `text-primary`, `bg-accent`).
- **Přístupnost (a11y):** Všechny interaktivní prvky jsou postavené na základech Radix UI, které garantují správné ARIA atributy, navigaci klávesnicí a správu fokusu.
- **Spotlight (Command Palette):** Globální vyhledávací panel (`Cmd+K` / `Ctrl+K`) implementovaný přes `cmdk` v [`src/lib/spotlight.ts`](https://github.com/spirit-of-tap/Tappka/blob/production/src/lib/spotlight.ts), umožňující bleskové prohledávání knih, místností, modulů i studentů.

---

## 3. Vývojové nástroje a verze

Projekt vynucuje striktní verze prostředí prostřednictvím nástroje **[mise](https://mise.jdx.dev/)** (`.mise.toml`):

```toml
[tools]
node = "24.13.0"
pnpm = "10.28.0"
```

- **Balíčkovací manažer:** Používá se výhradně **pnpm** (minimálně verze 10.28.0) pro efektivní správu závislostí a rychlou instalaci.
- **Linter & Formatter:** ESLint 9 v flat konfiguraci (`eslint.config.mjs`) s pravidly pro Next.js a TypeScript.
- **TypeScript:** Verze 5+ s konfigurací `strict: true`, bez možnosti vypnout kontrolu typů pro produkční build.
