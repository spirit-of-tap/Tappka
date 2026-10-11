# Čas (time tracking)

Studující v Tiimiakatemia tráví týden mixem činností: **Training** (Training Sessions, dialogy, workshopy), **Reading** (knihy, eseje), **Practise** (zákazníci, provoz týmové společnosti) a **Projekt** (vlastní projekty). Metodika počítá zhruba se **40 hodinami týdně**.

Modul **Čas** (`/cas`) umožňuje tento čas jednoduše evidovat: spustit časomíru nebo zapsat čas ručně, zařadit záznam do jednoho ze čtyř směrů, pojmenovat ho a označit vlastním tagem. Tým vidí, kolik času a čemu věnují jeho členové:ky.

Design a rozhodnutí: [`docs/plans/2026-09-24-timetracking-design.md`](https://github.com/spirit-of-tap/Tappka/blob/production/docs/plans/2026-09-24-timetracking-design.md).

---

## 1. Co modul umí

- **Časomíra** — jedním klikem spustit a zastavit. Běžící časomíra je vidět v sidebaru (desktop) i uprostřed spodní lišty (mobil) a přežije zavření aplikace, protože je to jen záznam bez konce.
- **Ruční záznam a editace** — začátek i konec mají datum a čas, záznam smí přesáhnout půlnoc. Hodí se, když zapomeneš časomíru vypnout.
- **Směr** — `training | reading | practise | project`, povinný. Barvy: Training světle modrá, Reading žlutá, Practise TAP červená, Projekt fialová (tokeny `--time-*` v `globals.css`).
- **Název** — volitelný, např. „Prodávání párků před ČZU".
- **Tag** — jeden na záznam, každý tag patří právě k jednomu směru a směr se mu později nemění (jen název). Při změně směru záznamu se tag odebere. Podle tagu jde filtrovat a sečíst, kolik času projekt zabral.
  - **Training a Reading** mají pevné tagy pro všechny: `TS`, `Příprava na TS` / `Čtení`, `Esej`. Nejdou přidat, přejmenovat ani schovat a tag je u těchto směrů **povinný** (starší záznamy bez tagu jdou dál upravovat, dokud se nemění směr ani tag).
  - **Practise a Projekt** mají **týmové tagy**: založit je může kdokoli z týmu přímo ve výběru tagu, přejmenovat (v `/settings/cas`) nebo smazat autor:ka, kouč:ka nebo admin. Nový název je nejdřív jen **koncept**: stačí ho napsat a kliknout mimo, jde ho znovu otevřít a opravit. Tag se v týmu založí (nebo se použije existující se stejným názvem) až při spuštění časomíry nebo uložení záznamu, takže překlepy se k týmu nedostanou. Název je unikátní v rámci týmu a směru. Tag je u nich volitelný.
  - **Kdo co vidí ve výběru:** každý si v **Nastavení → Tagy v Čase** (`/settings/cas`) zapne týmové tagy, které chce mít v nabídce. Nový tag se ostatním **nezobrazí** automaticky; ve výběru tagu se objeví krátká hláška „3 nové tagy" s odkazem do nastavení a tlačítkem **Ignorovat**. Autor:ka má svůj nový tag zapnutý hned. Když člověk napíše název schovaného týmového tagu, výběr nabídne „Zobrazit tag týmu" místo založení duplicity.
- **Výběr období** — ve stylu Clockify: rychlé volby (Dnes, Včera, Tento / Minulý týden, Poslední 2 týdny, Tento / Minulý měsíc, Tento / Minulý rok), kalendář na dva měsíce (první klik = začátek, druhý = konec) a šipky ‹ ›, které posouvají o délku období (celé měsíce a roky po měsících). Období je v URL jako `?from=YYYY-MM-DD&to=YYYY-MM-DD` (pražské dny včetně); výchozí je aktuální týden bez parametrů.
- **Progress** — součet všech čtyř směrů proti cíli 40 h týdně přepočtenému na délku období (40 h × dny / 7, např. měsíc ≈ 171 h; metrika `time-weekly`), přehled per směr jen informativně.
- **Kalendář** (`/cas/kalendar`) — osobní týdenní kalendář záznamů (na mobilu jeden den), 0–24 h, otevře se na 7:00. Tažením v prázdném místě vznikne nový záznam (otevře se formulář s předvyplněným časem), blok jde přetáhnout na jiný čas i den a za spodní okraj natáhnout, klik otevře úpravu i se smazáním. Krok 15 minut; překryv odmítne databáze a blok se vrátí. Běžící časomíra je čárkovaný blok (klik ji zastaví). Na dotykových zařízeních zatím jen klepnutí (nový záznam / úprava), bez tažení.
- **Reporting** (`/cas/reporting`) — sloupcové grafy za vybrané období: na ose X členové:ky týmu, na ose Y hodiny za zvolené směry nebo tagy (víc položek = skládaný sloupec). Grafů může být víc, každý má vlastní název a exportuje se do **PNG** (do prezentace, s nadpisem a legendou) nebo **CSV**. Tlačítko „Všechny záznamy (CSV)" stáhne všechny záznamy týmu za období (např. pro AI). Uložení sad grafů zatím není.
- **Týmový přehled** (`/cas/tym`) — tabulka členů:ek týmu za vybrané období: Training / Reading / Practise / Projekt / celkem a postup k přepočtenému cíli.

Modul neřeší finance, sazby ani fakturaci.

---

## 2. Pravidla, která hlídá databáze

1. **Jeden běžící timer na osobu.** Spuštění nové časomíry nejdřív zastaví běžící.
2. **Záznamy jedné osoby se nepřekrývají.** Vynuceno exclusion constraintem (`btree_gist`), aplikace překlad chyby zobrazí u pole konce.
3. **Konec je vždy po začátku.** Žádná minimální délka záznamu není.
4. Zastavení časomíry vždy uloží záznam.

---

## 3. Automatické doplnění z Training Session

Když manažer:ka týmu zapíše docházku na Training Session a člen:ka je označen:a jako **přítomný:á**, vznikne mu automaticky záznam `training` s tagem `TS` a názvem „Training Session" na celé okno TS podle rozvrhu týmu (`recurring_schedules`, typ `training_session`).

- Pokud má člověk v okně TS vlastní záznam, platí ten a nic se nezakládá.
- Automatický záznam lze upravit i smazat jako každý jiný. Upravený záznam už docházka nepřepíše.
- Když se docházka změní na nepřítomný, automatický (neupravený) záznam zmizí.
- Bez rozvrhu TS na daný den se nic nezakládá.

Trigger: `public.sync_training_session_time_entry()` na tabulce `team_activity_attendees`. Až docházka dostane hodiny účasti 1–4 (modul TS, issue #60), trigger je použije místo celého okna.

---

## 4. Databázový model

Definováno v [`db/schema/time-tracking.ts`](https://github.com/spirit-of-tap/Tappka/blob/production/db/schema/time-tracking.ts):

```sql
create type time_direction as enum ('training', 'reading', 'practise', 'project');
create type time_entry_source as enum ('timer', 'manual', 'attendance');

create table time_tags (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade, -- null = pevný systémový tag
  system_key text unique,                 -- training_session, training_session_prep, reading, essay
  direction time_direction not null,      -- tag patří k jednomu směru, unique (id, direction)
  name text not null,                     -- 1–40 znaků, unikátní per tým a směr (bez ohledu na velikost písmen)
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  created_by_profile_id uuid references profiles(id) on delete set null,
  updated_by_profile_id uuid references profiles(id) on delete set null,
  -- systémové tagy jen pro training / reading, týmové jen pro practise / project
  constraint time_tags_scope_check check (...)
);

-- týmové tagy, které má člověk zapnuté ve výběru
create table time_tag_selections (
  profile_id uuid references profiles(id) on delete cascade,
  tag_id uuid references time_tags(id) on delete cascade,
  created_at timestamptz default now() not null,
  primary key (profile_id, tag_id)
);

-- osobní nastavení modulu; tags_reviewed_at = od kdy hlásit „nové tagy"
create table time_tracking_preferences (
  profile_id uuid primary key references profiles(id) on delete cascade,
  tags_reviewed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table time_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade not null,
  direction time_direction not null,
  tag_id uuid references time_tags(id) on delete set null,
  -- + foreign key (tag_id, direction) references time_tags(id, direction): tag musí být ze stejného směru
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
| Vytvořit, upravit, smazat záznam | Jen vlastník:ice |
| Číst záznamy | Vlastník:ice, členové:ky stejného týmu, kouči:ky a admini (všechny) |
| Vložit záznam se `source = attendance` | Jen trigger docházky |
| Číst tagy | Systémové všichni, týmové členové:ky týmu, kouči:ky a admini |
| Založit týmový tag | Člen:ka týmu (jen pro svůj tým) |
| Přejmenovat, smazat týmový tag | Autor:ka, kouči:ky a admini; systémové tagy nikdo |
| Zapnout tag ve výběru, nastavení modulu | Jen pro sebe, jen tagy vlastního týmu |

---

## 5. Cesty v aplikaci a API

- `/cas` — moje záznamy ve vybraném období, progress k cíli, souhrn per směr, filtr podle směru a tagu, ruční zápis a editace.
- `/cas/tym` — týmový přehled za vybrané období (přepnutí záložek Moje / Tým období zachová); kouči:ky a admini volí tým.
- `/settings/cas` — Tagy v Čase: přepínače týmových tagů pro Practise a Projekt, nové tagy označené „Nový", přehled pevných tagů. Odkaz v profilu, v menu uživatele a ve Spotlightu.
- Časomíra: widget v sidebaru (desktop), tlačítko Play uprostřed spodní lišty (mobil), Spotlight „Čas".

Route Handlers (`src/app/api/`):

| Metoda a cesta | Účel |
| :--- | :--- |
| `GET /api/time-entries?from&to&direction&tagId&profileIds` | Záznamy v rozsahu (RLS omezí viditelnost) |
| `POST /api/time-entries` | Ruční záznam (`tagId` nebo koncept `newTagName`) |
| `PATCH` / `DELETE /api/time-entries/[id]` | Úprava, smazání vlastního záznamu |
| `GET /api/time-entries/timer` | Běžící časomíra nebo `null` |
| `POST /api/time-entries/timer` `{ action: "start" \| "stop" }` | Spuštění (zastaví běžící) a zastavení |
| `GET /api/time-tags` | Systémové a týmové tagy, zapnuté tagy a počet nových |
| `POST /api/time-tags` `{ name, direction }` | Nový týmový tag (Practise / Projekt), autor:ka ho má rovnou zapnutý |
| `PATCH` / `DELETE /api/time-tags/[id]` | Přejmenování, smazání týmového tagu |
| `PUT /api/time-tags/[id]/selection` `{ selected }` | Zapnout / schovat týmový tag ve výběru |
| `POST /api/time-tags/review` | „Ignorovat" nové tagy (otevření nastavení dělá totéž) |

Modul je **mimo betu** a mají ho všichni přihlášení (`timeTracking` v `RELEASED_FEATURES`, `src/lib/feature-access.ts`).
