# Zákaznické schůzky

Jedním z klíčových měřítek úspěchu studenta v Tiimiakatemia je kontakt s reálným trhem. Učení neprobíhá v simulacích, ale při přímých jednáních s reálnými zákazníky, firmami a partnery.

Modul **Zákaznické schůzky** (`/schuzky`) slouží k evidenci obchodních jednání, sledování cílů schůzek, jejich následnému vyhodnocení (post-mortem) a sdílení poznatků s týmem.

---

## 1. Zákaznická schůzka v metodice Tiimiakatemia

Každý student:ka má stanovený semestrální cíl v počtu uskutečněných schůzek (např. 20 schůzek za semestr).
- **Příprava před schůzkou:** Jasná definice cíle (`objective`) — co chceme od klienta zjistit, jakou nabídku představit, jakou dohodu uzavřít.
- **Debriefing po schůzce (`postMortem`):** Zhodnocení reality oproti očekávání — jak jednání dopadlo, jaké byly námitky klienta, jaká je další domluva.
- **Sdílení s týmem (`teamShare`):** Předání klíčových byznysových kontaktů a příležitostí do společného pipeline týmové společnosti.

---

## 2. Databázový model

Definováno v [`db/schema/customer-meetings.ts`](https://github.com/spirit-of-tap/Tappka/blob/production/db/schema/customer-meetings.ts):

```sql
create table customer_meetings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade not null,
  meeting_at timestamptz not null,
  company text not null,               -- Název firmy / klienta
  contact_person text not null,        -- Jméno kontaktní osoby
  position text not null,              -- Pozice (např. 'Marketing Director')
  objective text not null,             -- Cíl schůzky
  post_mortem text,                    -- Výsledek a zhodnocení jednání
  team_share text,                     -- Co z toho plyne pro zbytek týmu
  removed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  created_by_profile_id uuid references profiles(id) not null,
  updated_by_profile_id uuid references profiles(id) not null
);
```

### Zabezpečení dat:
Studující spravují své vlastní záznamy ze schůzek přes RLS (`profile_id = current_profile_id()`).

---

## 3. Cesty v aplikaci

- `/schuzky` — Přehled všech absolvovaných zákaznických schůzek, statistika splnění semestrálního cíle a vyhledávání podle firem.
- `/schuzky/nova` — Formulář pro zadání nové schůzky nebo záznamu z jednání.
