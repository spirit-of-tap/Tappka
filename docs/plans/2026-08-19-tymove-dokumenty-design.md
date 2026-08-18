# Týmové dokumenty — Design

> Feature #51 (Team Contract a Leading Thoughts) a #52 (Finanční směrnice) se řeší jako jeden
> sdílený modul: **Týmové dokumenty**. Otázka právního/e-podpisu je odložena — první verze pracuje
> pouze s nahráváním hotových PDF souborů (typicky ručně podepsaných) a verzováním.

**Datum:** 2026-08-19
**Status:** validováno brainstormingem

---

## 1. Proč to děláme

Týmy si drží týmovou smlouvu („Team Contract") a finanční směrnice („Financial Policies") jako
dokumenty. Dnes jsou „pouze v tymove.xlsx". Chceme je mít v aplikaci, verzované, s historií, a
volně dostupné členům týmu. Navíc chceme uživatelům dát svobodu nahrát i další týmové dokumenty
(např. interní pravidla, zápisy).

## 2. Rozhodnutí z brainstormingu

| Rozhodnutí | Volba |
| --- | --- |
| Formát obsahu | **PDF upload** (soubor je zdroj pravdy). Bez inline editoru, bez e-podpisu — viz Odložené. |
| Verzování | Každé nahrání = **nový immutable version**; historie zůstává, každou verzi lze stáhnout/otevřít. |
| Typy dokumentů | `team_contract` (1/tým), `financial_policy` (1/tým), `other` (neomezeně, uživatelský název). |
| Práva | **Všichni aktivní členové týmu** mohou nahrát novou verzi, vytvořit `other` dokument, přejmenovat a archivovat `other` dokumenty. |
| Metadata verze | Dobrovolné: `change_note`, `effective_from`. Zbytek (schválil, schváleno dne, účinnost) zůstává v PDF. |
| Aktivní verze | Žádná explicitní „aktuální verze" — aktuální = **nejvyšší `version_no`**. |
| Featured dokumenty | Nejde přejmenovat ani archivovat — jen přibývají verze. |
| Úložiště | Privátní bucket `documents`, přístup přes presign upload + signed URL (vzor personality-tests). |
| Umístění v UI | Nová sekce `/tymove-dokumenty`, beta-only (stejně jako Týmový deník). |
| Migrace | Dle AGENTS.md — uživatel spouští `pnpm db:migrate`, kontroluje migrace na drops. |

## 3. Data model (Drizzle, `db/schema/`)

### `team_documents`

| Sloupec | Typ | Poznámka |
| --- | --- | --- |
| `id` | uuid PK | defaultRandom |
| `team_id` | uuid FK → teams (cascade) | |
| `doc_type` | enum `team_document_type` (`team_contract`,`financial_policy`,`other`) | |
| `title` | text null | Povinné pro `other` (check), null pro featured |
| `removed_at` | timestamp null | Soft-delete (jen `other`) |
| `created_at` / `updated_at` | timestamp | + trigger |
| `created_by_profile_id` / `updated_by_profile_id` | uuid FK → profiles (restrict) | |

**Omezení:**
- `check` — `doc_type <> 'other' OR (title IS NOT NULL AND length(trim(title)) > 0)`
- **partial unique** na `(team_id, doc_type)` kde `doc_type IN ('team_contract','financial_policy') AND removed_at IS NULL` → max 1 featured dokument daného typu na tým.

### `team_document_versions`

| Sloupec | Typ | Poznámka |
| --- | --- | --- |
| `id` | uuid PK | defaultRandom |
| `document_id` | uuid FK → team_documents (cascade) | |
| `version_no` | int | Rostoucí per dokument (1,2,3…) — počítá server |
| `file_path` | text | Klíč v bucketu `documents` |
| `file_name` | text | Původní název souboru |
| `file_size` | int | |
| `effective_from` | date null | Dobrovolné |
| `change_note` | text null | Dobrovolné |
| `created_at` | timestamp | |
| `created_by_profile_id` | uuid FK → profiles (restrict) | |

**Omezení:** `unique (document_id, version_no)`.

**Imutabilita:** žádné update/delete policy → verze nelze měnit ani mazat.

### RLS

- `team_documents` — select/insert/update/delete: člen týmu
  (`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)`),
  vzor `team_reflections`.
- `team_document_versions` — select/insert: člen týmu (přes `document_id` → `team_documents`).
  Žádné update/delete policy.

## 4. Storage

- Nový kontext `team-document` → bucket `documents` (privátní).
- Klíč: `team-document/{documentId}/{ts}-{uuid}.pdf` (vzor `generateFileKey`).
- **Jen PDF** (`application/pdf`, max `MAX_DOCUMENT_SIZE` 20MB) — nová `validateTeamDocumentUpload`.
- Autorizace v `presign-upload` route: entityId = `document_id`, ověřit, že dokument patří do týmu uživatele.

## 5. API routes (vzor personality-tests)

| Route | Metoda | Účel |
| --- | --- | --- |
| `/api/storage/presign-upload` | POST | Rozšířit o kontext `team-document` |
| `/api/team-documents` | POST | Vytvořit dokument (`doc_type`, `title` pro `other`) |
| `/api/team-documents/[id]` | PATCH | Přejmenovat `other` dokument |
| `/api/team-documents/[id]` | DELETE | Archivovat (`removed_at`) jen `other` |
| `/api/team-documents/[id]/versions` | POST | Nahrát novou verzi (`key`, `fileName`, `fileSize`, `changeNote?`, `effectiveFrom?`); `version_no = max+1` |
| `/api/team-documents/versions/[versionId]/open` | GET | Redirect na signed URL |

Ověřování oprávnění: člen týmu + dokument patří do uživatelova týmu. `version_no` počítá server
(`max(version_no)+1` per dokument) v rámci insertu; unikátní index chrání před kolizemi.

## 6. UI (`/tymove-dokumenty`)

- Serverová page: auth/beta/team gate (vzor `tymovy-denik/page.tsx`), dotazy na dokumenty + poslední verzi.
- **Client komponenta** `TeamDocuments`:
  - Dva zvýrazněné karty: „Týmová smlouva" a „Finanční směrnice" (typu featured).
  - Sekce „Další dokumenty" s tlačítkem „Přidat dokument".
  - Každý dokument: název, informace o poslední verzi (verze, název souboru, velikost, datum, kdo nahrál),
    tlačítka „Nahrát novou verzi", „Otevřít", u `other` i „Přejmenovat" a „Archivovat".
  - Verze → modal/dialog „Historie verzí" se seznamem + odkazem „Otevřít" (signed URL) pro každou verzi.
- Dialogy: `UploadVersionDialog` (soubor, change note, effective from), `CreateDocumentDialog` (title + první verze), `RenameDialog`, archivační `AlertDialog`.
- Použití sdílených primitiv: `Button`, responzivní `AlertDialog`, `Empty*`, `PageHeader`/`PageShell`, sonner `toast`.

### České copy (gender-neutral, dle DESIGN.md)

- „Týmová smlouva", „Finanční směrnice", „Další dokumenty", „Přidat dokument", „Nahrát novou verzi",
  „Počet verzí", „Verze {n}", „Účinnost od", „Poznámka ke změně", „Nahráno {datum}",
  „Nahrál:a" → používat neutrální tvary („poslední verzi nahrál člen týmu" / přímá vazba jméno).
  Vše ověřit dle `inclusive-czech-writing` skillu.

## 7. Testování

- **Integrační RLS** `tests/integration/team-documents.int.test.ts`:
  člen týmu select/insert; cizí tým 0 řádků/403; soft-delete jen `other`; featured unikátnost;
  verze: insert člena týmu, žádný update/delete; cascade via team delete.
- **Komponenta** `team-documents.test.tsx`: prázdný stav, výpis dokumentů, upload dialog (validace PDF),
  rename/archive, chybové stavy.
- **Unit** (pokud vznikne formátovací helper).
- `pnpm test`, `pnpm typecheck`, `pnpm lint`.

## 8. Odložené / YAGNI

- **Právní e-podpis / Signi / BankID** — samostatná budoucí práce na stejném verzovacím modelu
  (frozen version → PDF → podpis). Záměrně NENÍ součástí.
- Externí PDF export/preview, tagy, hledání, notifikace členů.
- Datumy „schválil/schváleno dne" jako pole — zůstávají v PDF.
- Strukturovaná „Leading Thoughts" data (issue #51 mluví i o nich) — první verze řeší jen dokument jako celek.

## 9. Zdroje / reference

- Issue #51: <https://github.com/spirit-of-tap/Tappka/issues/51>
- Issue #52: <https://github.com/spirit-of-tap/Tappka/issues/52>
- Vzor implementace: `docs/plans/2026-08-18-osobnostni-testy-plan.md`, `src/lib/personality-tests/*`,
  `src/components/personality-tests/*`, `src/app/api/personality-tests/*`, `db/schema/personality-tests.ts`,
  `tests/integration/team-activities.int.test.ts`.
