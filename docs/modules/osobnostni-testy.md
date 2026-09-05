# Osobnostní testy a diagnostika

Úspěch týmového podnikání v Tiimiakatemia závisí na tom, nakolik jednotlivci znají své silné stránky, komunikační preference a přirozené role v týmu.

Modul **Osobnostní testy** (`/osobnostni-testy`) slouží k evidenci psychometrických diagnostik a jejich sdílení v rámci týmu.

---

## 1. Podporované diagnostické nástroje

Aplikace eviduje výsledky mezinárodně uznávaných diagnostik definovaných enumem `personality_test_type`:

| Typ testu | Kód v DB | Zaměření diagnostiky |
| :--- | :--- | :--- |
| **Gallup CliftonStrengths** | `gallup` | 34 talentových témat a silné stránky jednotlivce |
| **Belbinovy týmové role** | `belbin` | 9 týmových rolí (Inovátor, Koordinátor, Tahoun, Realizátor, ...) |
| **MBTI** | `mbti` | Myers-Briggs Type Indicator (16 osobnostních typů) |
| **DISC** | `disc` | Dominance, Vliv, Stálost, Pečlivost (chování v týmu) |
| **Big Five (OCEAN)** | `big_five` | Otevřenost, Svědomitost, Extraverze, Přívětivost, Neuroticismus |
| **Enneagram** | `enneagram` | 9 základních osobnostních typů a motivací |
| **Vlastní / Jiný test** | `other` | Jiná odborná diagnostika (s povinným popisem `test_type_other`) |

---

## 2. Využití v týmu

1. **Skládání projektových týmů:** Tým vidí, zda na projektu nechybí klíčové role (např. pouze Inovátoři bez Dotahovačů a Realizátorů).
2. **Koučovací dialog:** Kouč:ka se opírá o talenty studenta při definování jeho osobní vize a překonávání překážek.
3. **Přílohy výsledků:** Studující nahrávají oficiální PDF reporty z testů do zabezpečeného úložiště Supabase Storage.

---

## 3. Databázový model

Definováno v [`db/schema/personality-tests.ts`](https://github.com/spirit-of-tap/Tappka/blob/production/db/schema/personality-tests.ts):

```sql
create table personality_tests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade not null,
  test_type personality_test_type not null,
  test_type_other text,
  tested_on date not null,
  file_path text not null,             -- Cesta k souboru v Supabase Storage
  file_name text not null,
  file_size integer not null,
  removed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  created_by_profile_id uuid references profiles(id) not null,
  updated_by_profile_id uuid references profiles(id) not null,
  constraint personality_tests_other_type_required 
    check (test_type <> 'other' or (test_type_other is not null and length(trim(test_type_other)) > 0))
);
```

### Oprávnění (RLS):
- **Vkládání a úprava:** Pouze vlastník profilu (`profile_id = current_profile_id()`).
- **Čtení:** Všichni ověření uživatelé s potvrzeným pracovním e-mailem v rámci komunity TAP, což podporuje transparentnost a vzájemné pochopení stylů práce.

---

## 4. Cesty v aplikaci

- `/osobnostni-testy` — Přehled mých absolvovaných testů s možností stažení nahraných PDF zpráv.
- `/osobnostni-testy/nahrat` — Formulář pro nahrání nového certifikátu a výsledku testu.
