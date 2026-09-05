# Koučování a 1v1 sezení

V Tiimiakatemia nepřednášejí učitelé tradiční látku. Místo toho tým i jednotlivce provázejí certifikovaní kouči formou partnerského dialogu a kladení formativních otázek.

Modul **Koučování** (`/koucovani`) umožňuje studujícím zaznamenávat, sledovat a vyhodnocovat individuální koučovací sezení (1v1) s interními týmovými kouči i externími mentory z praxe.

---

## 1. Význam koučování v metodice

Během každého semestru má každý student:ka povinnost absolvovat stanovený počet individuálních koučování.
- **Cíl sezení:** Pomoci studentovi ujasnit si osobní vizi, řešit výzvy v týmové komunikaci, definovat vzdělávací cíle (Learning Contract) a reflektovat podnikatelské zkušenosti.
- **Důvěrnost:** Záznamy z 1v1 koučování jsou soukromé. RLS politiky zajišťují, že nikdo z ostatních spolužáků v týmu do těchto osobních zápisů nevidí.

---

## 2. Záznam ze sezení

Formulář pro zápis nového sezení eviduje:
1. **Datum a čas sezení (`session_at`):** Kdy sezení proběhlo.
2. **Kouč:ka sezení:**
   - **Interní kouč:ka (`coach_profile_id`):** Výběr ze seznamu certifikovaných koučů Tiimiakatemia.
   - **Externí kouč:ka / mentor:ka (`external_coach_name`):** Textové pole pro odborníky z komerční praxe.
   - *Poznámka:* Databázové omezení `coach_xor` vyžaduje zadání právě jednoho z těchto dvou údajů.
3. **Klíčové poznatky (`key_takeaways`):** Shrnutí nejdůležitějších uvědomění, myšlenkových posunů a odpovědí na koučovací otázky.
4. **Akční kroky (`action_steps`):** Konkrétní závazky a úkoly, které student:ka slíbí realizovat do příštího setkání.

---

## 3. Databázový model

Definováno v [`db/schema/individual-coaching-sessions.ts`](https://github.com/spirit-of-tap/Tappka/blob/production/db/schema/individual-coaching-sessions.ts):

```sql
create table individual_coaching_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade not null,
  session_at timestamptz,
  coach_profile_id uuid references profiles(id) on delete set null,
  external_coach_name text,
  key_takeaways text,
  action_steps text,
  removed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  created_by_profile_id uuid references profiles(id) not null,
  updated_by_profile_id uuid references profiles(id) not null,
  -- Zajišťuje, že je zadán buď interní profil kouče, nebo jméno externisty:
  constraint individual_coaching_sessions_coach_xor 
    check ((coach_profile_id is not null) <> (external_coach_name is not null))
);
```

### Oprávnění (RLS):
Pouze přihlášený student (`profile_id = current_profile_id()`) může prohlížet, vkládat, upravovat a mazat své koučovací záznamy.

---

## 4. Cesty v aplikaci

- `/koucovani` — Přehled všech absolvovaných sezení přihlášeného studenta se stavem splnění semestrální kvóty.
- `/koucovani/nove` — Dialog pro vložení nového záznamu sezení.
