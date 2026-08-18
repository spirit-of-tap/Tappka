# Osobnostní testy — Design

> Issue #59 (popis issue je většinou nepřesný — skutečný rozsah níže).
> Konzultováno s Ondřejem (brainstorming 18. 8. 2026).

## Co se staví (validovaný rozsah)

Studenti (téčka) si v průběhu studia dělají osobnostní testy (Gallup, MBTI, DISC,
Big Five, Enneagram, Belbin…), typicky na začátku studia a pak při opakování
sledují svůj vývoj. Aplikace umožní:

1. **Nahrát soubor** s výsledky testu (PDF nebo obrázek) + vybrat **typ testu**
   a zadat **datum vyplnění**.
2. Zobrazit **timeline** vlastních testů — **vertikální časová osa**
   (svislá linka s tečkami, řazeno sestupně podle data vyplnění — nejnovější
   nahoře, vzor feedů a týmového deníku).
3. Zobrazit testy **na profilu osoby v komunitě** — profil dostane taby
   `Přehled / Eseje / Osobnostní testy` a soubory si může otevřít každý ověřený
   uživatel. Zkratka v **sidebaru** (beta-gate, „Hlavní" sekce) vede na vlastní
   profil s `?tab=osobnostni-testy`.
4. **Upravit a smazat** vlastní záznamy (soft-delete + smazání souboru).

**Mimo rozsah** (vědomě, proti textu issue): pole `Výsledek`, `Reflexe`,
`Aplikace v praxi`, porovnání s týmem, tipy na spolupráci, odkazy na externí
testy. Výsledek je prostě ten nahraný soubor.

**Info karta** (text od Ondřeje, zobrazí se v tabu Osobnostní testy):

> Osobnostní test slouží k hodnocení a pochopení charakterových rysů, chování
> a preferencí téček. Pomáhá identifikovat silné a slabé stránky, motivace,
> a způsob interakce s okolím.
>
> Osobnostní test si každé téčko dělá v 1. semestru. Následně ho zkonzultuje
> s některým z koučů. Slouží jako podklad pro Learning contract.

## Rozhodnutí

| Otázka | Rozhodnutí |
|---|---|
| Viditelnost | Všichni ověření uživatelé (jako eseje) |
| Datum v timeline | Datum **vyplnění testu** (uživatelem zadané); datum nahrání jen technicky (created_at) |
| Typy testů | Enum `personality_test_type` (gallup, mbti, disc, big_five, enneagram, belbin, other) + vlastní text, když `other` |
| Formáty | PDF + PNG/JPEG/WebP, max **20 MB** |
| Struktura profilu | Taby: `Přehled / Eseje / Osobnostní testy` (vzor týmové stránky) |
| Operace | Přidat, upravit (i výměna souboru), smazat (soft-delete + smazání objektu) |
| Otevření souboru | Serverová route → redirect na podepsanou URL (1 h), nové okno |

## Data a úložiště

Tabulka `personality_tests` (Drizzle, `db/schema/personality-tests.ts`):
`id`, `profile_id` (FK→profiles, cascade), `test_type` (enum), `test_type_other`
(text, check: povinné při `other`), `tested_on` (date), `file_path` (text),
`file_name` (text), `file_size` (int), `removed_at` (soft-delete),
`created_at`/`updated_at`, audit FK `created_by`/`updated_by_profile_id`.
Index `(profile_id, tested_on)`.

RLS (helper `current_profile_id()`):
- select: ověřený uživatel (stejná podmínka jako
  `profiles`: `users.verified_work_email IS NOT NULL`). **Bez `removed_at IS NULL`**
  — Postgres aplikuje SELECT policy jako kontrolu na NOVÉM řádku při UPDATE,
  takže `removed_at IS NULL` v select policy by rozbil soft-delete
  (`update ... set removed_at = now()` by skončil RLS chybou, 403). Soft-deleted
  řádky filtrují dotazy aplikace (`queries.ts` provádí `.is("removed_at", null)`).
- insert/update/delete: jen vlastník (`profile_id = current_profile_id()`)

Úložiště: existující private bucket **`documents`** (migrace
`20260709120000_add_avatars_documents_buckets.sql` ho připravila přesně pro
tento účel). Klíč `personality-test/{profileId}/{timestamp}-{uuid}.{ext}`.
Writes: presigned URL (service role, vzor avatarů). Reads: `getSignedStorageUrl`
(1 h). Žádné storage RLS — veškerý přístup je serverem zprostředkovaný.

`updated_at` trigger — custom migrace (vzor `team_activities`).

## API

- `POST /api/storage/presign-upload` — **rozšířit** o kontext
  `personality-test` (vlastní profil + validace PDF/obrázek, 20 MB)
- `POST /api/personality-tests` — vytvoření záznamu (validace, RLS insert)
- `PATCH /api/personality-tests/[id]` — úprava typ/datum; při `newKey` i výměna
  souboru (starý objekt se smaže)
- `DELETE /api/personality-tests/[id]` — soft-delete + smazání objektu
- `GET /api/personality-tests/[id]/open` — podepsaná URL → 307 redirect

## UI

- Profilová stránka `/komunita/profil/[id]` přejde na taby (shadcn `Tabs`,
  server component obaluje sekce — vzor `/komunita/tymy/[id]`); podpora
  `?tab=` z URL. Počty v tabech přes `TabsTriggerCount`.
- Tab „Osobnostní testy": `InfoCard` + (vlastní profil) tlačítko „Nahrát test"
  + **vertikální timeline**: svislá linka (`bg-border`, 1 px) vedoucí mezi
  záznamy, každý záznam má na lince **tečku** (`size-3`, `bg-primary`,
  `ring-4 ring-background`, aby linka pod tečkou „neprocházela") a kartu
  s obsahem: typ testu, datum vyplnění, název souboru, velikost, akce
  (Otevřít / Upravit / Smazat). Linka je nakreslena po segmentech mezi
  tečkami (spojnice `top-5 bottom-[-32px]` u každého záznamu kromě
  posledního), takže nezasahuje nad první ani pod poslední tečku.
  `aria-hidden` na dekoračních prvcích, sémantické `ol`/`li`.
- Form dialog: Select typu („Jiný test" → podmíněné textové pole), datum
  (input type=date, default dnes), soubor (accept + hláška o limitech).
- Smazání přes `ResponsiveAlertDialog`; prázdné stavy přes `Empty` (vlastní vs.
  cizí profil), sonner toasty, loading stavy.

## UX analýza (zákony UX aplikované na návrh)

- **Hick's / Choice Overload**: 7 typů v jednom Selectu (v mezích Miller's 5–9);
  „Jiný test" se odhalí až při výběru (progressive disclosure).
- **Postel's Law**: datum default = dnes; shovívavá validace s českými hláškami.
- **Jakob's Law / konzistence**: všechny vzory už v aplikaci existují (InfoCard,
  taby s počty, AlertDialog, Empty, toasty). Timeline vizuálně navazuje na
  zavedenou estetiku (karty, semantic tokens), jen layout je časová osa.
- **Recognition over recall**: na kartě se ukazuje čitelný štítek typu
  („MBTI") a název souboru — nikdy raw klíč úložiště.
- **Fitts's Law**: akce na kartě = tlačítka s ikonou + textem na desktopu,
  `sr-only` label na mobilu (vzor karty týmového deníku).
- **Doherty Threshold**: loading na submit tlačítku, success/error toast,
  seznam se aktualizuje z odpovědi API (žádná optimistická UI u nahrávání).
- **Serial Position / Goal-gradient**: řazení sestupně (novější nahoře,
  vzor deníku); počet v tabu dává přehled o pokroku; tečka na ose dělá
  z každého záznamu vizuální „milník".
- **Von Restorff**: jediné primární CTA „Nahrát test".
- **A11y timeline**: dekorace (linka, tečky) `aria-hidden`, sémantické
  `ol`/`li`, obsah vždy v textové formě karty.
- **Stavy**: prázdný stav rozlišený pro vlastní/cizí profil; chybové stavy
  formuláře inline; `focus-ring`, obě témata.

## Testování

- **Unit**: `format.ts` (datum, velikost souboru) + štítky typů.
- **Integrace** (`tests/integration/personality-tests.int.test.ts`): RLS —
  vlastník insert + ověřený select, neověřený nevidí, cizí insert/update/delete
  zamítnut, soft-delete, check `other` bez textu, cascade při smazání profilu.
- **E2E** (`tests/e2e/osobnostni-testy.spec.ts`): upload (MBTI) → karta v
  timeline; edit; delete → prázdný stav; druhý uživatel vidí test a otevře
  soubor (popup → `/storage/v1/object/sign/`).

## Sekvence implementace

1. Schema + migrace + typy (uživatel spustí `pnpm db:migrate`)
2. Storage plumbing (kontext, validace, presign)
3. Lib (types, queries, format + unit testy)
4. API routes
5. InfoCard
6. Form dialog
7. List/timeline
8. Profilové taby
9. Integrační test RLS
10. E2E
11. Finální verifikace (`pnpm test`, typecheck, lint, db:doctor)
