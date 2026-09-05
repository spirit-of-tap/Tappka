# Komunita a Profily

Komunita Tiimiakatemia Prague je tvořena několika desítkami studujících rozdělených do týmových společností napříč ročníky (kohortami), které doplňují týmoví kouči a mentoři z podnikatelské praxe.

Modul **Komunita** (`/komunita`) slouží jako živý adresář kampusu, usnadňuje cross-fertilizaci (výměnu zkušeností mezi ročníky) a poskytuje detailní pohled na profily jednotlivců i celých týmů.

---

## 1. Hlavní sekce modulu

### 1.1 Adresář lidí a vyhledávání (`/komunita`)
- **Filtrování podle rolí:** Studující, Kouči, Mentoři, Administrátoři.
- **Týmové štítky (Team Pills):** Rychlý proklik na společnost, v níž daná osoba působí.
- **Rychlé vyhledávání:** Okamžitá filtrace podle jména, e-mailu nebo dovedností.

### 1.2 Detail profilu člena:ky (`/profil/[id]` nebo `/komunita/profil/[id]`)
- **Základní údaje:** Jméno, role, tým, pracovní e-mail, telefon, datum narození.
- **Čtenářský profil a eseje:** Počet získaných bodů za četbu, seznam publikovaných esejů s možností okamžitého čtení.
- **Absolvované osobnostní testy:** Přehled diagnostikovaných silných stránek (pokud jsou sdíleny).
- **Projekty a kompetence:** Oblasti, v nichž se daný člověk profiluje a kde může pomoci ostatním.

### 1.3 Detail týmové společnosti (`/komunita/tymy/[id]`)
- **Soupiska týmu:** Seznam všech společníků a společnic týmové firmy.
- **Týmový kouč:ka:** Přiřazený provázející kouč.
- **Projekty týmu:** Přehled běžících i dokončených byznysových zakázek.
- **Statistika četby týmu:** Celkový počet přečtených knih a součet bodů týmu.

---

## 2. Databázový model

Základem jsou tabulky `profiles` a `teams` v [`db/schema/profiles.ts`](https://github.com/spirit-of-tap/Tappka/blob/production/db/schema/profiles.ts) a [`db/schema/teams.ts`](https://github.com/spirit-of-tap/Tappka/blob/production/db/schema/teams.ts):

```sql
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,          -- např. 'Elysium', 'Vanguard'
  cohort text not null,               -- např. '2024/2027'
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) unique,
  team_id uuid references teams(id) on delete set null,
  name text,
  picture text,
  work_email text not null,
  role profile_role default 'student' not null,
  phone_number text,
  personal_email text,
  date_of_birth date,
  beta_cohort beta_cohort default 'A' not null,
  beta_access_granted_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
```

### Ochrana osobních údajů:
- Osobní e-mail a telefon jsou přístupné pouze ověřeným členům komunity Tiimiakatemia.
- Odstranění přístupu probíhá soft-delete mechanismem přes sloupec `access_removed_at`.

---

## 3. Cesty v aplikaci

- `/komunita` — Hlavní rozcestník lidí a týmů s vyhledávací lištou.
- `/komunita/tymy/[id]` — Stránka konkrétního týmu a jeho členů.
- `/komunita/profil/[id]` — Veřejný studentský profil v rámci komunity.
- `/profil` — Můj vlastní profil s možností editace kontaktních údajů.
