# Timetracking (Čas) — Design

> Jednoduchý osobní a týmový time tracking ve třech směrech metodiky Tiimiakatemia:
> **Training / Reading / Practise**. Bez financí, bez úkolů, bez klientů. Předlohou je jádro
> modulu z FellaUp (`docs/timetracking-module-map.md` v repu Fellaship_Software), osekané a
> přepsané na konvence Tappky.

**Datum:** 2026-09-24
**Status:** validováno s product ownerem (Ondra), čeká na implementaci
**Rollout:** beta kohorta B (feature key `timeTracking`), admin vždy

---

## 1. Proč to děláme

Studující mají trávit ~40 h týdně mixem tréninku (TS, dialogy), čtení (knihy, eseje) a praxe
(projekty, zákazníci). Dnes se to nikde neeviduje. Tým ani kouč:ka nevidí, kolik kdo čemu věnuje,
a studující nemají zpětnou vazbu, jestli se do 40 h vejdou.

Modul má tři úlohy:

1. **Osobní evidence** — spustit/zastavit časomíru nebo zapsat čas ručně, zařadit do T/R/P,
   volitelně pojmenovat a označit vlastním tagem (např. `practise + fellaship`).
2. **Týmový přehled** — každý člen týmu vidí, kolik času a na čem tráví ostatní členové.
3. **Progress** — 40 h týdně celkem (jedna metrika), přehled per směr jen informativně.

## 2. Rozsah

### V první verzi (jádro)

- Živý timer start/stop, jeden běžící timer na osobu (vynuceno v DB).
- Ruční záznam a zpětná editace (začátek i konec mají datum a čas, záznam smí přesáhnout půlnoc).
- Směr `training | reading | practise` (pevný enum), volitelný název, volitelný vlastní tag
  (max. jeden na záznam).
- Vlastní tagy per uživatel (vytvořit, přejmenovat, smazat).
- Práva: zápis pouze vlastní záznamy; čtení vlastní + spolutýmoví; kouč:ka a admin čtou vše.
- Stránka `/cas`: týdenní přehled vlastních záznamů, progress k 40 h, souhrn per směr.
- Stránka `/cas/tym`: tabulka členů týmu za týden (T/R/P/celkem, progress).
- Desktop widget v sidebaru, mobilní tlačítko Play uprostřed spodní lišty.
- Automatické doplnění `training` záznamu z docházky na Training Session (viz kap. 6).
- Metrika `time-weekly` (40 h / týden) v `src/lib/metrics/config.ts`.

### Mimo první verzi (nadstavba, samostatné plány)

- Týmový graf (Ondra dodá představu), dashboard widget „Čas", portfolio.
- Hodiny 1–4 v docházce TS (patří k modulu TS, issue #60); trigger je na to připravený.
- Notifikace, export, více tagů na záznam.

Explicitně **nikdy**: finance, sazby, billable, REST API pro externí automatizace.

## 3. Datový model

Zdroj pravdy: `db/schema/time-tracking.ts` (Drizzle). Konvence Tappky: `created_by_profile_id`,
`updated_by_profile_id`, RLS přes `current_profile_id()`.

```sql
create type time_direction as enum ('training', 'reading', 'practise');
create type time_entry_source as enum ('timer', 'manual', 'attendance');

create table time_tags (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references profiles(id) on delete cascade,
  name                  text not null check (char_length(btrim(name)) between 1 and 40),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by_profile_id uuid not null references profiles(id) on delete restrict,
  updated_by_profile_id uuid not null references profiles(id) on delete restrict
);
create unique index time_tags_profile_name_key on time_tags (profile_id, lower(btrim(name)));

create table time_entries (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references profiles(id) on delete cascade,
  direction             time_direction not null,
  tag_id                uuid references time_tags(id) on delete set null,
  title                 text check (title is null or char_length(title) <= 120),
  started_at            timestamptz not null,
  ended_at              timestamptz,                       -- null = běžící timer
  duration_ms           bigint,                            -- null = běžící; jinak ended - started
  source                time_entry_source not null default 'manual',
  attendance_id         uuid unique references team_activity_attendees(id) on delete cascade,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by_profile_id uuid not null references profiles(id) on delete restrict,
  updated_by_profile_id uuid not null references profiles(id) on delete restrict,
  constraint time_entries_end_after_start check (ended_at is null or ended_at > started_at),
  constraint time_entries_duration_matches check (
    (ended_at is null and duration_ms is null)
    or (ended_at is not null and duration_ms = (extract(epoch from ended_at - started_at) * 1000)::bigint)
  )
);

create index time_entries_profile_started_idx on time_entries (profile_id, started_at desc);
create index time_entries_tag_idx on time_entries (tag_id) where tag_id is not null;

-- max jeden běžící timer na osobu
create unique index time_entries_one_running_key on time_entries (profile_id) where ended_at is null;

-- žádné překryvy záznamů jedné osoby (nahrazuje O(n) kontrolu v aplikaci z FellaUp)
create extension if not exists btree_gist;
alter table time_entries add constraint time_entries_no_overlap
  exclude using gist (
    profile_id with =,
    tstzrange(started_at, coalesce(ended_at, 'infinity'::timestamptz), '[)') with &&
  );
```

Principy převzaté z FellaUp a zachované 1:1:

- **Běžící timer = řádek s `ended_at is null`.** Přežije reload i zavření tabu.
- **`duration_ms` je materializované**, agregace jen sčítají.
- **Start nového timeru nejdřív zastaví běžící.** Stop vždy uloží; žádná minimální délka záznamu (rozhodnutí PO 2026-09-24, oproti FellaUp).

Rozhodnutí odlišná od FellaUp:

- **Hard delete** místo `removed_at`. Částečné unikátní indexy a exclusion constraint by se se
  soft-deletovanými řádky komplikovaly a smazaný časový záznam nemá, na co by se odkazovalo.
- **Overlap a „jeden běžící" hlídá DB**, ne aplikace. API překládá chyby `23P01` (exclusion)
  a `23505` (unique) na srozumitelnou hlášku.
- **`source` + `attendance_id`** kvůli automatickému doplňování z docházky (kap. 6).

### RLS

```sql
-- time_entries
select: profile_id = current_profile_id()
        or profile_id in (select id from profiles where team_id = (select team_id from profiles where id = current_profile_id()) and team_id is not null and access_removed_at is null)
        or is_coach_or_admin()
insert: profile_id = current_profile_id() and source <> 'attendance'
update: using profile_id = current_profile_id()  with check profile_id = current_profile_id()
delete: profile_id = current_profile_id()

-- time_tags: stejné čtení jako entries (spolutýmoví vidí názvy tagů), zápis jen vlastní
```

Záznamy se `source = 'attendance'` vkládá výhradně trigger (SECURITY DEFINER). Uživatel je smí
upravit i smazat jako své (po editaci zůstává `source = 'attendance'`, `attendance_id` zůstává,
takže trigger už znovu nic nezaloží).

## 4. Vrstvy aplikace

Žádné Server Actions (Tappka je nepoužívá). Mutace jdou přes Route Handlers, čtení přes
`supabase-js` v RSC a v `src/lib/time-tracking/queries.ts`.

| Vrstva | Soubor | Obsah |
|---|---|---|
| Konstanty | `src/lib/time-tracking/constants.ts` | `TIME_DIRECTIONS` s labely a barvami (semantic tokeny), `LONG_TIMER_WARN_MS = 6 h`, `LONG_TIMER_ALERT_MS = 12 h`, `WEEKLY_TARGET_HOURS = 40`, `TITLE_PLACEHOLDER = "Prodávání párků před ČZU"` |
| Typy | `src/lib/time-tracking/types.ts` | `TimeEntry = Tables<'time_entries'>`, `TimeTag = Tables<'time_tags'>`, `TimeDirection = Database['public']['Enums']['time_direction']`, `TimeEntryWithTag` |
| Čistá logika | `src/lib/time-tracking/duration.ts` | `formatDurationHms`, `formatDurationShort` (`1 h 30 min`), `parseDurationInput` (`"1h 30m"`, `"90"`), `computeDurationMs` |
| Čistá logika | `src/lib/time-tracking/week.ts` | `getWeekRange(now)` (po–ne, `date-fns` + `cs`), `groupEntriesByDay`, `splitEntryAcrossDays` (jen pro zobrazení přes půlnoc), `summarize(entries)` → `{ total, byDirection, byTag }` |
| Čistá logika | `src/lib/time-tracking/validation.ts` | zod schémata pro POST/PATCH (start < end, direction v enumu, title ≤ 120, tag uuid) |
| Dotazy | `src/lib/time-tracking/queries.ts` | `getActiveTimer`, `listEntries({ profileIds, from, to, direction, tagId })`, `listTeamMemberEntries(teamId, week)`, `listTags(profileId)` |
| API | `src/app/api/time-entries/route.ts` | `GET` (filtry), `POST` (ruční záznam) |
| API | `src/app/api/time-entries/[id]/route.ts` | `PATCH`, `DELETE` |
| API | `src/app/api/time-entries/timer/route.ts` | `GET` aktivní, `POST { action: "start", direction, tagId?, title? }`, `POST { action: "stop" }` |
| API | `src/app/api/time-tags/route.ts`, `[id]/route.ts` | CRUD tagů |
| Stav | `src/components/time-tracking/timer-provider.tsx` | React context `{ active, elapsedMs, start, stop, refresh }`; hydratuje se ze serveru v `(main)/layout.tsx`; tik 1 s počítá `Date.now() - started_at`; po každé mutaci `refresh()` z API (zdroj pravdy je DB) |

Chyby z DB se v API mapují: `23P01` → „Záznam se překrývá s jiným záznamem", `23505` na
`time_entries_one_running_key` → „Už ti běží časomíra", `23505` na `time_tags_profile_name_key` →
„Tag s tímto názvem už máš".

## 5. UI

Vše přes `PageShell`/`PageHeader`, semantic tokeny, `tabular-nums` pro časy, inkluzivní čeština,
light i dark.

### Spuštění timeru (společný `StartTimerSheet`)

Jeden formulář, dva vstupní body. Obsah:

1. Segmented control **Training / Reading / Practise** (povinné, bez výchozí hodnoty).
2. Combobox **Tag** (volitelný): vlastní tagy + „Vytvořit tag „…"" přímo z vyhledávání.
3. Input **Co konkrétně** (volitelný) s placeholderem `Prodávání párků před ČZU`.
4. Tlačítko **Spustit**. `Cmd/Ctrl + Enter` odešle.

Mobil: `vaul` Drawer zespodu. Desktop: shadcn `Dialog`.

### Mobil — spodní lišta

`MobileBottomNav` dostane pátou položku uprostřed: **Domů · Moduly · ▶ · Komunita · Profil**.
Tlačítko není `Link`, ale ovládá timer:

- Bez timeru: kruhové primary tlačítko s ikonou Play, label „Start". Tap → `StartTimerSheet`.
- S timerem: ikona Stop, pod ní běžící čas `HH:MM:SS`; tap → potvrzovací sheet „Zastavit časomíru?"
  se souhrnem (směr, tag, uplynulý čas) a tlačítky Zastavit / Pokračovat.
- Skryté, když uživatel nemá přístup k feature (`canAccessFeature`), lišta je pak čtyřpoložková.

### Desktop — sidebar

`TimerWidget` v horní části `AppSidebar` pod logem (sidebar je jediný trvalý chrom, header
Tappka nemá). Zobrazuje stav stejně jako mobil, plus odkaz na `/cas`. V zúženém (icon) režimu
sidebaru jen ikona Play/Stop s tooltipem.

### Dlouho běžící timer

Převzato z FellaUp bez DB notifikace: při 6 h `sonner` toast „Časomíra běží 6 hodin, pořád
pracuješ?", při 12 h `AlertDialog` s možností zastavit. Potvrzení se ukládá do `sessionStorage`,
aby se dialog neopakoval.

### `/cas` — moje záznamy

- `PageHeader` „Čas" s počtem záznamů v týdnu (`pluralizeCz`), tlačítko **Zapsat ručně**
  (desktop v hlavičce, mobil FAB nad lištou — vzor `/koucovani`).
- Navigace týdnů ‹ Tento týden ›, `MetricProgress` pro `time-weekly` (celkem / 40 h).
- Řádek tří čísel per směr (Training · Reading · Practise), ne metrika, jen přehled.
- Filtr: směr (chipy), tag (select). Filtry v URL query (`?direction=&tag=`) bez `nuqs`, přes
  `useSearchParams`.
- Seznam seskupený **den → záznamy**, nejnovější nahoře. Řádek: barevná tečka směru, název
  (nebo label směru), chip tagu, `od–do`, délka, ⋮ menu (Upravit, Smazat s `AlertDialog`).
  Záznam přes půlnoc se zobrazí v dni začátku s poznámkou „→ následující den".
- Běžící timer je v seznamu vždy jako první řádek s živým časem.
- Dialog **Upravit / Zapsat ručně** (`react-hook-form` + zod): směr, tag, název, začátek
  (datum + čas), konec (datum + čas), náhled délky. Chyba překryvu z API se zobrazí u pole konec.

### `/cas/tym` — tým

- Pro studující: vlastní tým. Pro kouče:ky a adminy: `Select` týmu (výchozí první tým, kouč:ka
  své týmy nahoře).
- Stejná navigace týdnů. Tabulka: člen:ka (avatar + jméno), Training, Reading, Practise, Celkem,
  progress bar k 40 h. Řádek rozbalí denní záznamy člena (jen čtení).
- Spodní souhrn týmu: celkem hodin, průměr na osobu. Místo pro graf (nadstavba).

### Navigace a registrace

- `navigation.ts`: `{ title: "Čas", url: "/cas", icon: Timer, feature: "timeTracking", description: "Časomíra a přehled času ve směrech Training / Reading / Practise." }`, do `MODULE_HUB_ORDER` za `/tymovy-denik`.
- `feature-access.ts`: `timeTracking: ["B"]`.
- `metrics/config.ts`: `"time-weekly": { label: "Čas týdně", period: "week", target: 40, unit: "hours" }`
  — rozšíření `MetricPeriod` o `"week"` a `unit` o `"hours"`, `periods.ts` dostane `getCurrentWeekRange`.
- Spotlight: položka „Spustit časomíru" / „Zastavit časomíru" (otevře sheet, resp. stop).

## 6. Automatické doplnění z docházky na Training Session

**Pravidlo (dohodnutý kompromis):**

1. Má-li člověk v okně TS vlastní záznam, platí záznam. Nic se nezakládá.
2. Je-li v docházce označen jako přítomný a v okně TS nemá žádný záznam, vznikne automaticky
   záznam `training`, název „Training Session", `source = 'attendance'`, na celé okno TS.
3. Bez jakéhokoli dotazu v UI.

**Zdroj okna TS:** `recurring_schedules` týmu se `schedule_type = 'training_session'`, platné
v den aktivity (`valid_from <= occurred_at <= coalesce(valid_until, occurred_at)`), shoda
`day_of_week`. Okno = `occurred_at + start_time` až `occurred_at + end_time` v `Europe/Prague`.

**Zdroj docházky:** `team_activity_attendees` se `status = 'present'` pro
`team_activities.activity_type = 'training_session'`. (Dnes je `activity_type` volný text a
modul se zatím nepoužívá; hodnota `'training_session'` se zafixuje v modulu TS, issue #60.)

**Mechanismus:** trigger `AFTER INSERT OR UPDATE OF status ON team_activity_attendees`
volající `public.sync_training_session_time_entry()` (`SECURITY DEFINER`, `set search_path = ''`):

- `present` a neexistuje entry s tímto `attendance_id` a neexistuje překrývající entry profilu
  → `insert` (při kolizi s exclusion constraintem se tiše nic nevloží, pravidlo 1).
- změna z `present` na cokoli jiného → `delete` entry s tímto `attendance_id` (jen automatické;
  ručně přepsaný záznam se pozná podle `updated_by_profile_id <> created_by_profile_id`, ten
  zůstane).
- chybí rozvrh pro daný den → nic (bez fallbacku, aby nevznikaly vymyšlené hodiny). Týmová
  stránka ukáže upozornění „Tým nemá rozvrh TS", pokud existuje docházka bez rozvrhu.

**Připravenost na hodiny 1–4:** až docházka dostane sloupec `hours`, trigger použije
`start_time + hours` místo `end_time`. Zapsáno jako TODO přímo ve funkci.

Trigger je custom migrace (`pnpm db:generate:custom`), pokrytá integračními testy.

## 7. Bezpečnost a výkon

- RLS zapnuto na obou tabulkách, čtyři politiky per tabulka, `(select ...)` subdotazy.
- Objem: stovky až tisíce záznamů na osobu za rok, desítky tisíc za školu ročně. Index
  `(profile_id, started_at desc)` pokrývá všechny dotazy stránky; týmový přehled = jeden dotaz
  s `in (profile_ids)` a rozsahem týdne, agregace v aplikaci. Tagy jsou triviální (jeden
  nullable FK), žádný dopad.
- Timer API omezeno na vlastní profil; `profile_id` se nikdy nebere z těla requestu.

## 8. Testování

| Vrstva | Co |
|---|---|
| Unit | `duration.ts`, `week.ts` (přes půlnoc, hranice týdne, prázdné dny), `validation.ts`, `summarize` |
| Integration | RLS matice (vlastník / spolutýmový / cizí tým / kouč / admin) pro select i update; exclusion constraint; jeden běžící timer; trigger docházky (present → entry, změna → delete, existující překryv → nic, chybějící rozvrh → nic) |
| Component | `StartTimerSheet` (povinný směr, placeholder), `TimeEntryRow`, `MobileBottomNav` s Play (skryté bez přístupu), `TimerWidget` tik |
| E2E | start → stop → řádek v `/cas`; ruční záznam přes půlnoc; editace s překryvem ukáže chybu; spolutýmový vidí v `/cas/tym`, nemůže upravit |

## 9. Otevřené body (nadstavba)

- Podoba týmového grafu (Ondra dodá).
- Dashboard widget „Čas" (DASHBOARD_WIDGETS) a portfolio.
- Hodiny účasti 1–4 v docházce a fixace `activity_type = 'training_session'` (modul TS, #60).
