# Kontext - Rezervace místností

**Datum zahájení:** 2026-01-29  
**Status:** Plánování  
**Spolupráce:** Onda + Claude

---

## O čem je tento dokument

Tento soubor slouží jako centrální místo pro:
- Poznámky a nápady k rezervačnímu systému
- Rozhodnutí která jsme udělali a proč
- Kontext pro pokračování práce
- Odkazy na relevantní soubory a zdroje

---

## Analýza existujícího kódu

### Architektura aplikace

```
tappka/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Landing + Login
│   ├── layout.tsx         # Root layout (fonty, theme)
│   ├── globals.css        # TAP branding, barvy
│   ├── auth/              # Auth stránky
│   │   ├── sign-up/
│   │   ├── forgot-password/
│   │   └── update-password/
│   ├── verify/            # Ověření školního emailu
│   ├── dashboard/         # Chráněná sekce
│   │   ├── layout.tsx     # Sidebar + header
│   │   └── page.tsx       # Dashboard home
│   └── api/verify/        # API routes pro verifikaci
├── components/            # React komponenty
│   ├── ui/               # shadcn/ui komponenty
│   ├── app-sidebar.tsx   # Hlavní navigace
│   ├── login-form.tsx
│   ├── sign-up-form.tsx
│   ├── verify-form.tsx
│   └── ...
├── lib/
│   ├── supabase/         # Supabase klienti
│   │   ├── client.ts     # Browser client
│   │   └── server.ts     # Server client
│   └── utils.ts          # Utility funkce (cn)
└── supabase/
    ├── config.toml       # Lokální Supabase konfig
    └── migrations/       # SQL migrace
```

### Klíčové vzory v kódu

#### 1. Server vs Client komponenty
- **Server by default** - stránky jsou RSC
- **"use client"** jen kde je potřeba (formuláře, interaktivita)
- Příklad: `page.tsx` je server, `login-form.tsx` je client

#### 2. Supabase integrace
```tsx
// Server component
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();

// Client component  
const supabase = createClient();
await supabase.auth.signInWithPassword({ email, password });
```

#### 3. Ochrana routes
```tsx
// V page.tsx nebo layout.tsx
if (!user) redirect("/");
if (!profile?.is_verified) redirect("/verify");
```

#### 4. Formuláře
- useState pro state
- Async submit handler
- Error handling s českými hláškami
- Loading stavy (isLoading)

#### 5. Fetch na API routes
```tsx
const response = await fetch("/api/verify/send-code", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ school_email }),
});
const data = await response.json();
```

### Existující databázové tabulky

| Tabulka                 | Účel                                              |
| ----------------------- | ------------------------------------------------- |
| `profiles`              | Rozšíření auth.users (jméno, role, tým, verified) |
| `teams`                 | Týmové firmy (Viento, Tuuli, Aero)                |
| `pre_registered_emails` | Seznam povolených školních emailů                 |
| `verification_codes`    | Dočasné kódy pro ověření                          |

### Existující role

```sql
CREATE TYPE user_role AS ENUM ('student', 'team_leader', 'coach', 'admin');
```

### Sidebar navigace (app-sidebar.tsx)

Už existuje placeholder pro Rezervace:
```tsx
{
  title: "Rezervace",
  url: "reservations",
  icon: CalendarDays,
}
```

---

## Otázky k diskusi

### 1. Co se bude rezervovat?
- [ ] Místnosti v TAP prostorách?
- [ ] Jaké typy místností? (zasedačky, kanceláře, společné prostory?)
- [ ] Jsou nějaká specifická pravidla pro rezervace?

### 2. Kdo může rezervovat?
- [ ] Všichni ověření uživatelé?
- [ ] Jen určité role?
- [ ] Potřebuje se něco schvalovat?

### 3. Jak dlouhé mohou být rezervace?
- [ ] Minimální/maximální délka?
- [ ] Celý den vs. časové sloty?
- [ ] Opakující se rezervace?

### 4. Co když jsou konflikty?
- [ ] First-come-first-served?
- [ ] Priority podle rolí?
- [ ] Možnost zrušení?

---

## Rozhodnutí

*(Budeme doplňovat během diskuse)*

| Datum | Rozhodnutí | Důvod |
| ----- | ---------- | ----- |
|       |            |       |

---

## Poznámky ze schůzek

### 2026-01-29 - Zahájení

- Vytvořena složka pro kontext
- Provedena analýza existujícího kódu
- Vytvořen brand manuál (`brand_manual_ondy.md`)

---

## Relevantní soubory

### Dokumentace
- `docs/Rezervace/brand_manual_ondy.md` - Branding guide
- `docs/plans/2026-01-25-tappka-auth-design.md` - Jak funguje auth systém

### Kód pro inspiraci
- `app/verify/page.tsx` - Příklad chráněné stránky
- `components/verify-form.tsx` - Příklad multi-step formuláře
- `app/api/verify/` - Příklad API routes
- `supabase/migrations/20260125000000_auth_system.sql` - Příklad migrace

### Kam přidat nový kód
- `appreservations/` - Nová routa pro rezervace
- `components/` - Nové komponenty
- `supabase/migrations/` - Nové databázové tabulky

---

## Další kroky

1. ~~Probrat základní požadavky~~ HOTOVO
2. ~~Navrhnout databázové schéma~~ HOTOVO
3. ~~Vytvořit plán implementace~~ HOTOVO
4. ~~Fáze 1: Databáze~~ HOTOVO (migrace vytvořena)
5. ~~Fáze 2: Základní UI~~ HOTOVO (seznam místností, detail, formulář, API)
6. ~~Fáze 3: Coach dashboard + TS~~ HOTOVO
7. ~~Fáze 2 doplnění~~ HOTOVO (týdenní kalendář, editace, filtrování)
8. ~~Fáze 4 doplnění~~ HOTOVO (cowork účastníci, zamčená místnost)
9. ~~Fáze 4: UI pro uzavření issues~~ HOTOVO
10. ~~Fáze 3: Vizuální označení Days of Joy~~ HOTOVO
11. ~~Fáze 2: API availability~~ HOTOVO
12. ~~Fáze 5: NFC/QR routing~~ HOTOVO
13. Fáze 6: Analytika (prozatím odloženo)

## Vytvořené soubory

### Migrace
- `supabase/migrations/20260129000000_reservation_system.sql` - Kompletní databázové schéma

### Stránky (Fáze 2)
- `appreservations/page.tsx` - Hlavní stránka se seznamem místností
- `appreservations/[code]/page.tsx` - Detail místnosti s kalendářem a formulářem

### API Routes (Fáze 2)
- `app/api/reservations/route.ts` - GET (seznam), POST (vytvoření)
- `app/api/reservations/[id]/route.ts` - GET, PATCH, DELETE jednotlivé rezervace
- `app/api/reservations/join/route.ts` - POST (připojit), DELETE (opustit) cowork
- `app/api/room-issues/route.ts` - GET, POST pro hlášení problémů

### Komponenty (Fáze 2)
- `components/reservations/room-card.tsx` - Karta místnosti se stavem
- `components/reservations/room-list.tsx` - Grid místností
- `components/reservations/my-reservations.tsx` - Moje rezervace
- `components/reservations/reservation-form.tsx` - Formulář pro rezervaci
- `components/reservations/time-picker.tsx` - Výběr času (15min sloty)
- `components/reservations/day-schedule.tsx` - Denní rozvrh
- `components/reservations/alternative-rooms.tsx` - Alternativní místnosti
- `components/reservations/issue-report-button.tsx` - Hlášení problémů

### Utility (Fáze 2)
- `lib/reservations/types.ts` - TypeScript typy a konstanty
- `lib/reservations/utils.ts` - Pomocné funkce (včetně `getReservationColorClasses`)
- `lib/reservations/index.ts` - Re-exporty

### Komponenty (Fáze 2 doplnění)
- `components/reservations/week-schedule.tsx` - Týdenní pohled kalendáře
- `components/reservations/calendar-view.tsx` - Den/Týden toggle + navigace
- `components/reservations/room-schedule-view.tsx` - Client wrapper pro server page
- `components/reservations/edit-reservation-dialog.tsx` - Dialog pro editaci rezervace
- `components/reservations/room-filter.tsx` - Filtrování podle data/času
- `components/reservations/rooms-with-filter.tsx` - Wrapper seznam + filtr

### Komponenty (Fáze 4 doplnění)
- `components/reservations/reservation-detail-dialog.tsx` - Detail rezervace + cowork účastníci
- `components/reservations/issues-manager.tsx` - Správa nahlášených problémů
- `app/api/reservations/[id]/participants/route.ts` - API pro načtení účastníků coworku
- `app/api/room-issues/[id]/route.ts` - PATCH/DELETE pro uzavření/smazání problémů

### API Routes (další)
- `app/api/reservations/availability/route.ts` - Kontrola volných časových slotů
- `app/api/schedule-breaks/active/route.ts` - Aktivní výjimky v daném rozsahu

### Stránky (Fáze 5)
- `app/rezervace/[code]/page.tsx` - Veřejná stránka pro NFC/QR
- `app/r/[code]/route.ts` - Redirect pro krátké URL
