# Concerns: Navigation architecture for portfolio modules

## Context

Tento dokument zachycuje problémy, které se objevily při revizi závěrů z `2026-07-01-navigation-architecture.md`. Cílem není navrhnout řešení, ale pojmenovat konkrétní bolesti, které je potřeba adresovat.

---

## 1. Skupení Klienti / Rozvoj / Tým nedává smysl

Navržené dělení do sekcí **Klienti** (Zák. schůzky), **Rozvoj** (Koučování, Nástroje, Praxe) a **Tým** (Týmový deník, Reflexe, Training Session, Zpětná vazba, Projekty) je umělé. Uživatel (student) se v něm neorientuje přirozeně — není to dělení, které by znal z Excelu nebo z vlastní mentální mapy svých činností. 

Problém není v konkrétních názvech, ale v principu: jakákoliv hierarchická abstrakce nad 23 položkami bude nutně subjektivní a pro nového uživatele matoucí.

---

## 2. Mobile-first: sidebar bude na telefonu nepoužitelný

23 položek. Většina přístupů bude z mobilu. Sidebar, který na desktopu funguje jako přehledné menu, je na telefonu:
- Zanořený za hamburgerem — několik kliků, než se někam dostaneš
- Scrollování dlouhým seznamem — položky na konci jsou de facto neviditelné
- Nested collapsible sekce = nekonečné klikání

Čím víc položek přibývá (a přibude jich ~20), tím horší UX na mobilu.

---

## 3. Složitá orientace při zanořování

I na desktopu: když se položky schovají do collapsible skupin, uživatel neví, "kam se podívat". Pokud máš 5 skupin po 3-5 položkách, musíš každou skupinu otevřít, abys našel, co hledáš. To je v pořádku, když víš, co hledáš. Ale když nevíš (což je přesně případ nového studenta, který "má něco vyplnit"), je to noční můra.

---

## 4. Uživatelé jsou zvyklí na Excel

Studenti Tiimiakatemie znají svůj Excel. Vědí, že list č. 3 = Zákaznické schůzky, list č. 5 = Crossfertilizace, atd. Excel měl lineární, plochou strukturu — prostě seznam sheetů. Jakékoliv přeskupení do "app kontextů" vytváří třecí plochu: "Kde je teď to, co jsem dřív našel v Excelu?"

To není argument pro "udělejme appku jako Excel". Je to argument pro to, že orientace podle domény (Klienti / Rozvoj / Tým) není pro tyhle uživatele přirozenější než původní číslování sheetů.

---

## 5. Některé věci se inherentně slučují (change management)

V rámci change managementu dojde k přirozenému slučování:
- Training Session → attendance log + crossfertilizace trigger
- Zák. schůzky + Individuální koučování + Training Session → všechny sdílejí čas a kontext schůzky
- Skill Profile, Learning Contract, Eseje → všechny se promítají do celkového hodnocení
- Projekty → generují účetnictví

Tyto vztahy nejsou vidět v žádném plochém ani hierarchickém menu. Uživatel je objeví až v momentě, kdy s danou funkcí pracuje.

---

## 6. NEJVĚTŠÍ PROBLÉM: Chybí validace "co mám splnit" (readiness)

Excel měl jednu obrovskou výhodu: **prázdný sheet = nesplněno**. Student otevřel Excel, viděl listy, viděl, který je vyplněný a který ne. Měl přehled na jedné obrazovce.

V appce se data rozpadnou do 23 různých stránek, každá s vlastním formulářem, workflow, oprávněními. Student:
- Neví, co všechno má vyplnit
- Neví, kde to najde
- Neví, jestli už to vyplnil (nebo jestli to jen nenašel)
- Nemá zpětnou vazbu "máš hotovo ✅" nebo "chybí ti ❌"

To je fatální pro úspěšnost adoptování appky. Studenti potřebují odpověď na jedinou otázku: **"Splnil jsem všechno, co mám pro tento semestr?"**

---

## 7. Z toho plyne: readiness není "nice to have", je to základní navigační prvek

V původním plánu byla "Připravenost" (readiness checklist) navržena jako widget na Dashboardu. To je podcenění. Pokud readiness není ústředním prvkem celé navigace, pak appka selže v tom, v čem Excel uspěl — dát studentovi jistotu, že má vše hotovo.

Readiness není doplněk sidebaru. Readiness je **to hlavní**, z čeho se uživatel orientuje. Sidebar je jen zkratka pro rychlý přístup k často používaným akcím.

---

## Důsledky pro redesign

- **Sidebar není vhodný jako primární rozcestník** pro 23 položek, zvlášť na mobilu.
- **Navigace musí být plochá nebo velmi mělká** — ideálně jedno klepnutí na cokoliv, max dvě.
- **Readiness / stav plnění musí být vidět na první pohled** — ne schovaný za widgetem.
- **Původní Excel struktura je referenční bod** — nemusíme ji kopírovat, ale ignorovat ji bude bolet.
- **Hierarchické členění (Klienti / Rozvoj / Tým) řeší problém organizátora, ne uživatele.**
