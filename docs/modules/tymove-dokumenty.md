# Týmové dokumenty a Finance

Každá studentská společnost v Tiimiakatemia funguje jako reálná firma s právní subjektivitou (typicky s.r.o. nebo z.s.). 

Modul **Týmové dokumenty** slouží jako centrální archív klíčových zakládajících dohod, interních směrnic a finančních výkazů, které jsou vyžadovány jak metodikou Tiimiakatemia, tak platnou českou legislativou.

---

## 1. Klíčové typy dokumentů

### 1.1 Týmová smlouva (Team Contract)
Základní společenská dohoda týmu uzavíraná po založení společnosti. Definuje:
- Společné hodnoty a kulturu týmu.
- Pravidla docházky, komunikace a řešení konfliktů.
- Pravidla pro vystoupení člena:ky nebo vyloučení z týmové společnosti.
- Sankční mechanismy a vnitřní závazky.

### 1.2 Vedoucí myšlenky (Leading Thoughts)
- Strategická vize a mise týmové společnosti na 3 roky studia.
- Dlouhodobé milníky a zaměření (kterým oborům se chce tým věnovat).

### 1.3 Finanční směrnice (Financial Policy)
Závazná pravidla pro hospodaření se společnými penězi:
- Podmínky pro vyplácení zisku a odměn za projekty.
- Schvalovací limity pro nákupy a investice (kdo a do jaké částky může autorizovat platby).
- Tvorba společného rezervního fondu na cesty a vzdělávání.

### 1.4 Účetní a daňové výkazy (Reporting)
Tým průběžně nahrává a eviduje své oficiální účetní závěrky:
- **Rozvaha (Aktiva a Pasiva):** Stav majetku společnosti, pohledávek, závazků a vlastního kapitálu.
- **Výkaz zisku a ztráty (VZZ):** Přehled výnosů a nákladů z jednotlivých studentských projektů.
- **Výroční zpráva:** Kompletní zhodnocení podnikatelského roku předkládané koučům a vedení univerzity.

---

## 2. Databázový model

Schéma je definováno v [`db/schema/team-documents.ts`](https://github.com/spirit-of-tap/Tappka/blob/production/db/schema/team-documents.ts):

```sql
create type team_document_type as enum (
  'team_contract',
  'financial_policy',
  'other'
);

create table team_documents (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade not null,
  doc_type team_document_type not null,
  title text,
  removed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  created_by_profile_id uuid references profiles(id) not null,
  updated_by_profile_id uuid references profiles(id) not null
);

-- Unikátní index: v týmu může existovat pouze jedna aktivní Týmová smlouva a Finanční směrnice
create unique index team_documents_featured_team_type_idx
  on team_documents (team_id, doc_type)
  where (doc_type in ('team_contract', 'financial_policy') and removed_at is null);
```

### Omezení a pravidla integrity:
- Kontrola `team_documents_title_matches_type`: Dokumenty typu `team_contract` a `financial_policy` mají fixní systémový název (hodnota `title` je NULL). U typu `other` je textový název povinný.

---

## 3. Cesty v aplikaci

- `/tymove-dokumenty` — Přehled všech nahraných a aktivních směrnic týmu přihlášeného uživatele.
- `/tymove-dokumenty/nahrat` — Formulář pro nahrání nové revize Týmové smlouvy nebo Finanční směrnice s historií změn.
