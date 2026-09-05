# Příručka: Řešení driftu migrační historie (verze 20260419)

**Stav:** Vyřešeno lokálně k 2026-07-08. Chybný formát verze `20260419` byl **pouze lokální problém** — **v produkci se tato chyba nikdy nevyskytla**, takže produkční databáze žádnou opravu verze `20260419` nevyžaduje.

---

## 1. Příznak chyby

Příkaz `supabase migration up` nebo `supabase db push` selže s chybovou hláškou:

```
Remote migration versions not found in local migrations directory.
Make sure your local git repo is up-to-date. If the error persists, try repairing the migration history table:
supabase migration repair --status reverted 20260419
```

Tato chyba **zablokuje aplikaci všech nových migrací** přes Supabase CLI — nejen té, kterou se právě snažíš přidat.

---

## 2. Hlavní příčina

Každá migrace má mít v názvu **14místné časové razítko** (`YYYYMMDDHHMMSS`, např. `20260612193007`) **s výjimkou jediné**:

| Stav | Verze v DB | Název souboru |
| :--- | :--- | :--- |
| **Chybný formát** | `20260419` (8 číslic) | `20260419_essays_title_trgm_idx.sql` |
| **Správný formát** | `20260419000000` (14 číslic) | `20260419000000_essays_title_trgm_idx.sql` |

Supabase CLI rozpoznává výhradně 14místné verze. Když v tabulce `supabase_migrations.schema_migrations` narazí na osmimístnou verzi `20260419`, nedokáže ji spárovat s žádným souborem, vyhodnotí ji jako „vzdálenou migraci chybějící na disku“ a odmítne pokračovat.

Jde o formu **out-of-band driftu**: záznam byl do tabulky zapsán nestandardně (např. ručním spuštěním nebo nástrojem mimo CLI).

---

## 3. Postup opravy (Forward-only, bez resetu databáze)

Normalizace verze na 14 číslic probíhá synchronně na třech místech:

1. **Přejmenování souboru migrace** v repozitáři na 14místný tvar.
2. **Aktualizace záznamu v lokální tabulce** `schema_migrations` (port 54322).
3. **Případná oprava v produkční tabulce** (pokud by se tam chybná verze objevila).

Samotný obsah souboru se nemění, schéma zůstává netknuté — jde čistě o evidenci migrací.

### Lokální oprava:

```bash
# 1. Přejmenování souboru v Gitu
git mv supabase/migrations/20260419_essays_title_trgm_idx.sql \
       supabase/migrations/20260419000000_essays_title_trgm_idx.sql

# 2. Oprava lokální tabulky historie v Docker kontejneru
docker exec supabase_db_Tappka psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "update supabase_migrations.schema_migrations set version='20260419000000' where version='20260419';"

# 3. Ověření, že je CLI odblokované
pnpm supabase migration up
```

### Kdyby se verze s 8 číslicemi objevila na vzdáleném projektu:

```bash
supabase link --project-ref <PROJECT_ID>
supabase migration repair --status reverted 20260419
supabase migration repair --status applied 20260419000000
supabase migration list   # Sloupce local a remote musí lícovat
```

---

## 4. Prevence budoucího driftu

1. **Vždy vytvářej migrace přes CLI nebo Drizzle:**
   - Standardní migrace schématu: `pnpm db:migrate` (volá `drizzle-kit generate`).
   - Vlastní SQL: `pnpm db:generate:custom`.
   - Obě cesty automaticky generují správné 14místné razítko.
2. **Nikdy ručně needituj tabulku `supabase_migrations.schema_migrations`**, s výjimkou zdokumentovaných oprav.
3. **Nikdy nepoužívej externí MCP nástroje typu `apply_migration`**, které zapisují historii mimo Supabase CLI.
4. Pokud příkaz `supabase migration list` někdy ukáže verzi, která nemá přesně 14 znaků, oprav ji před nasazením výše uvedeným postupem.

---

## 5. Drizzle deník a správa RLS politik

1. **`pnpm db:generate:custom` neaktualizuje automaticky `supabase/migrations/meta/`:**
   Po vytvoření vlastní prázdné migrace a vepsání SQL spusť jednou `pnpm db:generate` (ohlásí *"No schema changes"*), aby se synchronizoval soubor `_journal.json`. Změny v `db/meta/` commitni společně s migrací.

2. **Těla RLS politik patří do Drizzle schématu:**
   U každého `pgPolicy(...)` udržuj plné výrazy `using` a `withCheck`. Jen tak dokáže `db:generate` správně seřadit `DROP POLICY` před `DROP COLUMN`, pokud politika na daném sloupci závisí.
