# Zadání - Rezervační systém

**Datum vytvoření:** 2026-01-29  
**Status:** Kompletní zadání

---

## Místnosti

| Kód  | Název                  | Pravidla                          |
| ---- | ---------------------- | --------------------------------- |
| D126 | D126                   | Běžná místnost, může mít TS       |
| D132 | D132                   | Běžná místnost, může mít TS       |
| D226 | D226                   | Běžná místnost, může mít TS       |
| D127 | Tichá místnost         | Vždy dostupná, bez TS             |
| D129 | Reprezentační místnost | Vždy dostupná, bez TS             |
| D107 | D107                   | Pouze středa, 1. středa = HC 9-12 |

---

## Training Sessions (TS)

- Trvání: 4 hodiny
- Frekvence: Týdně, stejný čas, stejný tým, stejná místnost
- Nastavuje: Coach (jednou za půlrok)
- Místnosti s TS: D126, D132, D226
- Když probíhá TS, místnost není dostupná pro běžné rezervace

---

## Houston Calling (HC)

- Kdy: První středa v měsíci
- Čas: 9:00 - 12:00
- Kde: D107
- Kdo: Celá Tiimiakatemia (povinné)
- Vytváření: Automaticky systémem

---

## Obecná pravidla

1. Provozní hodiny: **7:00 - 22:00**
2. Rezervace dopředu: **max 2 týdny**
3. Max délka rezervace: **bez omezení**
4. Časové sloty: **po 15 minutách**
5. Jeden uživatel = jedna rezervace v daný čas
6. Jedna místnost = jedna rezervace v daný čas
7. Povinné údaje: důvod rezervace, počet osob
8. Rezervace lze upravit a zrušit

---

## Funkce systému

### Základní
- Vytvoření, editace, zrušení rezervace
- Kalendářový pohled (denní/týdenní)
- Responzivní design (mobil/PC)
- Filtrování podle času a místnosti

### Speciální
- **Coworking "Join"**: Toggle pro otevřenou rezervaci, ostatní se mohou připojit
- **Hlášení závad**: Report nepořádku, technických problémů
- **Zamčená místnost**: Hlášení + zobrazení všem uživatelům
- **Alternativní místnosti**: Nabídka volných místností v požadovaný čas
- **Analytika**: Statistiky vytíženosti, počet rezervací na uživatele

### Coach dashboard
- Nastavení rozvrhu TS pro místnosti
- Výběr: místnost, tým, den, čas
- Platnost: semestr
- **Days of Joy**: Speciální týden bez TS (1x za semestr) - místnosti volné
- **Volno/Prázdniny**: Období bez TS (svátky, vánoce, etc.) - místnosti volné

---

## URL struktura

- NFC: `https://tiimi.cz/rezervace/[kod]` (např. `/rezervace/d126`)
- QR short: `https://tiimi.cz/r/[kod]` → redirect na hlavní

---

## Obrazovky

### 1. Hlavní stránka (`reservations`)
- Seznam místností s dostupností ("volná od X")
- Barevné kódování stavu
- Sekce "Moje rezervace"
- Filtrování

### 2. Detail místnosti (`reservations/[kod]`)
- Kalendář s rezervacemi
- Formulář pro rezervaci (čas, důvod, počet osob, cowork toggle)
- Zobrazení TS
- Report button
- Alternativní místnosti

### 3. Coach nastavení (`reservations/settings`)
- Pouze pro role coach/admin
- Nastavení opakovaných TS
