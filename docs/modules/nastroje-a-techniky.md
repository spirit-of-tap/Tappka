# Nástroje a Techniky

Během studia a vedení týmové firmy si studující osvojují desítky manažerských, facilitačních, inovačních a marketingových metod.

Modul **Nástroje a Techniky** (`/nastroje-techniky`) slouží k evidenci ověřených praktických nástrojů, které student:ka skutečně použil:a při řešení týmových výzev nebo klientských projektů.

---

## 1. Kategorie metodik (`tool_type`)

Aplikace rozlišuje tři základní úrovně nástrojů:
1. **Teoretické modely (`model`):**
   - Strategické a analytické rámce převzaté z odborné literatury.
   - Příklady: *Porterových 5 sil*, *Kotterův 8krokový model změny*, *Ansoffova matice*, *Model Tuckmanových fází týmu*.
2. **Techniky (`technique`):**
   - Postupy pro vedení dialogu, brainstorming a facilitaci workshopů.
   - Příklady: *Šest klobouků myšlení (Edward de Bono)*, *Disneyho metoda*, *Crazy 8s*, *5 Whys (Pět proč)*, *Retrospektiva Mad/Sad/Glad*.
3. **Praktické nástroje (`tool`):**
   - Rámce pro přímou aplikaci v byznysu a projektovém řízení.
   - Příklady: *Lean Canvas*, *Business Model Canvas*, *Value Proposition Canvas*, *Customer Journey Map*, *Ganttův diagram*.

---

## 2. Důraz na reflexi a praktické ověření

V Tiimiakatemia nestačí nástroj pouze teoreticky znát z knihy. Hodnotící kritérium spočívá v jeho **reálné aplikaci v praxi**:
- **Název nástroje (`name`):** Co bylo použito.
- **Reflexe použití (`reflection`):** Na jakém konkrétním projektu byl nástroj nasazen, co přinesl týmu za vhled, jaká byla úskalí a co by příště udělal:a jinak.

---

## 3. Databázový model

Definováno v [`db/schema/tools-techniques.ts`](https://github.com/spirit-of-tap/Tappka/blob/production/db/schema/tools-techniques.ts):

```sql
create type tool_type as enum ('model', 'technique', 'tool');

create table tools_techniques (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade not null,
  tool_type tool_type not null,
  name text not null,
  reflection text not null,
  removed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  created_by_profile_id uuid references profiles(id) not null,
  updated_by_profile_id uuid references profiles(id) not null
);
```

### Oprávnění (RLS):
Každý student:ka spravuje své vlastní portfolio vyzkoušených nástrojů (`profile_id = current_profile_id()`).

---

## 4. Cesty v aplikaci

- `/nastroje-techniky` — Osobní toolbox, filtrování podle typu (`model`, `technique`, `tool`) a vyhledávání.
- `/nastroje-techniky/novy` — Formulář pro zaevidování nově vyzkoušeného nástroje s reflexí.
