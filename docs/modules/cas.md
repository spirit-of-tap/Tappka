# Čas (time tracking)

Studující v Tiimiakatemia tráví týden mixem tří činností: **Training** (Training Sessions, dialogy, workshopy), **Reading** (knihy, eseje) a **Practise** (projekty, zákazníci, provoz týmové společnosti). Metodika počítá zhruba se **40 hodinami týdně**.

Modul **Čas** (`/cas`) umožňuje tento čas jednoduše evidovat: spustit časomíru nebo zapsat čas ručně, zařadit záznam do jednoho ze tří směrů, pojmenovat ho a označit vlastním tagem. Tým vidí, kolik času a čemu věnují jeho členové:ky.

Design a rozhodnutí: [`docs/plans/2026-09-24-timetracking-design.md`](https://github.com/spirit-of-tap/Tappka/blob/production/docs/plans/2026-09-24-timetracking-design.md).

---

## 1. Co modul umí

- **Časomíra** — jedním klikem spustit a zastavit. Běžící časomíra je vidět v sidebaru (desktop) i uprostřed spodní lišty (mobil) a přežije zavření aplikace, protože je to jen záznam bez konce.
- **Ruční záznam a editace** — začátek i konec mají datum a čas, záznam smí přesáhnout půlnoc. Hodí se, když zapomeneš časomíru vypnout.
- **Směr** — `training | reading | practise`, povinný.
- **Název** — volitelný, např. „Prodávání párků před ČZU".
- **Vlastní tag** — volitelný, jeden na záznam, např. `practise + fellaship`. Podle tagu jde filtrovat a sečíst, kolik času projekt zabral.
- **Týdenní progress** — součet všech tří směrů proti cíli 40 h (metrika `time-weekly`), přehled per směr jen informativně.
- **Týmový přehled** (`/cas/tym`) — tabulka členů:ek týmu za týden: Training / Reading / Practise / celkem a postup k 40 h.

Modul neřeší finance, sazby ani fakturaci.

---

## 2. Pravidla, která hlídá databáze

1. **Jeden běžící timer na osobu.** Spuštění nové časomíry nejdřív zastaví běžící.
2. **Záznamy jedné osoby se nepřekrývají.** Vynuceno exclusion constraintem (`btree_gist`), aplikace překlad chyby zobrazí u pole konce.
3. **Konec je vždy po začátku.** Žádná minimální délka záznamu není.
4. Zastavení časomíry vždy uloží záznam.

---

## 3. Automatické doplnění z Training Session

Když manažer:ka týmu zapíše docházku na Training Session a člen:ka je označen:a jako **přítomný:á**, vznikne mu automaticky záznam `training` s názvem „Training Session" na celé okno TS podle rozvrhu týmu (`recurring_schedules`, typ `training_session`).

- Pokud má člověk v okně TS vlastní záznam, platí ten a nic se nezakládá.
- Automatický záznam lze upravit i smazat jako každý jiný. Upravený záznam už docházka nepřepíše.
- Když se docházka změní na nepřítomný, automatický (neupravený) záznam zmizí.
- Bez rozvrhu TS na daný den se nic nezakládá.

Trigger: `public.sync_training_session_time_entry()` na tabulce `team_activity_attendees`. Až docházka dostane hodiny účasti 1–4 (modul TS, issue #60), trigger je použije místo celého okna.

---

## 4. Databázový model

Definováno v [`db/schema/time-tracking.ts`](https://github.com/spirit-of-tap/Tappka/blob/production/db/schema/time-tracking.ts):

```sql
create type time_direction as enum ('training', 'reading', 'practise');
create type time_entry_source as enum ('timer', 'manual', 'attendance');

create table time_tags (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade not null,
  name text not null,                     -- 1–40 znaků, unikátní per osoba (bez ohledu na velikost písmen)
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  created_by_profile_id uuid references profiles(id) not null,
  updated_by_profile_id uuid references profiles(id) not null
);

create table time_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade not null,
  direction time_direction not null,
  tag_id uuid references time_tags(id) on delete set null,
  title text,                             -- max 120 znaků
  started_at timestamptz not null,
  ended_at timestamptz,                   -- null = běžící časomíra
  duration_ms bigint,                     -- materializováno: ended_at - started_at
  source time_entry_source default 'manual' not null,
  attendance_id uuid references team_activity_attendees(id) on delete cascade, -- jen automatické záznamy
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  created_by_profile_id uuid references profiles(id) not null,
  updated_by_profile_id uuid references profiles(id) not null,
  constraint time_entries_end_after_start check (ended_at is null or ended_at > started_at),
  constraint time_entries_no_overlap exclude using gist (
    profile_id with =, tstzrange(started_at, coalesce(ended_at, 'infinity'), '[)') with &&
  )
);
-- max jeden běžící timer: unique (profile_id) where ended_at is null
```

Záznamy se mažou natvrdo (žádné `removed_at`), protože na smazaný časový záznam nic neodkazuje a soft delete by komplikoval unikátní indexy.

### Oprávnění (RLS)

| Akce | Kdo |
| :--- | :--- |
| Vytvořit, upravit, smazat záznam nebo tag | Jen vlastník:ice |
| Číst záznamy a tagy | Vlastník:ice, členové:ky stejného týmu, kouči:ky a admini (všechny) |
| Vložit záznam se `source = attendance` | Jen trigger docházky |

---

## 5. Cesty v aplikaci a API

- `/cas` — moje záznamy v týdnu, progress k 40 h, souhrn per směr, filtr podle směru a tagu, ruční zápis a editace.
- `/cas/tym` — týmový přehled za týden; kouči:ky a admini volí tým.
- Časomíra: widget v sidebaru (desktop), tlačítko Play uprostřed spodní lišty (mobil), Spotlight „Čas".

Route Handlers (`src/app/api/`):

| Metoda a cesta | Účel |
| :--- | :--- |
| `GET /api/time-entries?from&to&direction&tagId&profileIds` | Záznamy v rozsahu (RLS omezí viditelnost) |
| `POST /api/time-entries` | Ruční záznam |
| `PATCH` / `DELETE /api/time-entries/[id]` | Úprava, smazání vlastního záznamu |
| `GET /api/time-entries/timer` | Běžící časomíra nebo `null` |
| `POST /api/time-entries/timer` `{ action: "start" \| "stop" }` | Spuštění (zastaví běžící) a zastavení |
| `GET` / `POST /api/time-tags`, `PATCH` / `DELETE /api/time-tags/[id]` | Vlastní tagy |

Přístup je řízen beta kohortou **B** (`timeTracking` v `src/lib/feature-access.ts`), admin má přístup vždy.
