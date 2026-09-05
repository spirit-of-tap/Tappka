# Jak psát dokumentaci (Příručka k pnpm wiki)

Tento dokument detailně popisuje fungování interního dokumentačního portálu Tappky (`pnpm wiki`), konvence pro tvorbu nových stránek, správu navigace a ověřování integrity odkazů.

---

## 1. Jak funguje `pnpm wiki` pod kapotou

Dokumentační portál je postaven na moderním statickém generátoru **[VitePress](https://vitepress.dev/)**. 

V [`package.json`](https://github.com/spirit-of-tap/Tappka/blob/production/package.json) jsou definovány dva klíčové skripty:
```json
"wiki": "node scripts/generate-docs-html-shims.mjs && vitepress dev docs --open",
"wiki:doctor": "node scripts/check-docs-links.mjs"
```

### Postup spuštění:
1. **Generování HTML shims ([`scripts/generate-docs-html-shims.mjs`](https://github.com/spirit-of-tap/Tappka/blob/production/scripts/generate-docs-html-shims.mjs)):**
   - Skript prohledá složku `docs/public/` a pro samostatné HTML soubory vytvoří celoobrazovkový wrapper přes komponentu `HtmlShim`.
   - Portfolio podklady ukládej do `docs/public/wiki-static/`. Skript je propojí s veřejnými čistými URL, přidá sdílené téma a doplní příponu `.html` do jejich vnitřních odkazů.
   - Oddělení zdrojových HTML souborů od veřejných tras zabraňuje kolizi s HTML stránkami generovanými VitePressem.
2. **Vývojový server VitePress:**
   - Nastartuje lokální server (výchozí port `5173`) s kořenem ve složce `docs/` a automaticky otevře výchozí prohlížeč.
   - Změny v souborech `.md` se okamžitě projevují v reálném čase díky Hot Module Replacement (HMR).

---

## 2. Struktura složky `docs/` a kam co patří

Každý nový dokument zařaď do odpovídající podsekce:

| Typ dokumentace | Umístění | Příklad |
| :--- | :--- | :--- |
| **Architektura & Systém** | `docs/architecture/` | `docs/architecture/tech-stack.md` |
| **Aplikační moduly** | `docs/modules/` | `docs/modules/reservations.md` |
| **Vývojářské postupy (Runbooks)** | `docs/runbooks/` | `docs/runbooks/database-migrations.md` |
| **Architektonické návrhy (Design)** | `docs/plans/` | `docs/plans/2026-08-21-zakaznicke-schuzky-redesign-design.md` |
| **Implementační plány** | `docs/plans/` | `docs/plans/2026-08-21-zakaznicke-schuzky-redesign.md` |
| **Statické portfolio HTML** | `docs/public/wiki-static/` | `docs/public/wiki-static/portfolio-sheets.html` |
| **Ostatní statické soubory** | `docs/public/` | `docs/public/screenshots/reading-dashboard.png` |

---

## 3. Šablona a formátování stránek

Každý technický dokument by měl dodržovat standardní strukturu:

```markdown
# Název modulu nebo příručky

Stručný úvod shrnující cíl dokumentu, význam pro uživatele a kontext.

---

## 1. Klíčové koncepty a architektura
Vysvětlení podstaty fungování, diagramy, datové toky.

## 2. Databázový model a entity
SQL tabulky, RLS pravidla, indexy a vazby.

## 3. Uživatelská rozhraní a komponenty
Popis stránek, formulářů a stavů.

## 4. Běžné postupy a řešení potíží
Příkazy, postupy a varování před chybami.
```

### Podporované prvky VitePressu:

- **Mermaid diagramy:**
  ````markdown
  ```mermaid
  graph TD
    A[Klient] --> B[Server]
  ```
  ````
- **Informační bloky (Callouts):**
  ```markdown
  > [!NOTE]
  > Doplňující kontext nebo vysvětlení.

  > [!WARNING]
  > Pozor na destruktivní akce nebo možné komplikace.
  ```
- **Zápis Vue šablon a složených závorek:**
  Protože VitePress kompiluje Markdown do Vue komponent, je nutné v běžném textu (mimo kódové bloky) ošetřit dvojité složené závorky nebo JSX tagy zpětným lomítkem: `{\{ hodnota }}` nebo `\<PageHeader />`, aby kompilátor nehlásil chybu syntaxe.

---

## 4. Přidání stránky do navigace a postranní lišty

Směrování ve VitePressu mapuje cestu přímo z názvu souboru (např. `docs/modules/reservations.md` se stane `/modules/reservations`).

Aby byla stránka viditelná pro uživatele:
1. Otevři konfiguraci [`docs/.vitepress/config.ts`](https://github.com/spirit-of-tap/Tappka/blob/production/docs/.vitepress/config.ts).
2. Přidej odkaz do příslušné skupiny v `themeConfig.sidebar`:
   ```typescript
   { text: 'Nový modul', link: '/modules/novy-modul' }
   ```
3. Odkazy vždy zapisuj **jako čisté cesty bez přípony `.md`** a začínající lomítkem `/`.

---

## 5. Kontrola funkčnosti a integrity

Před odevzdáním změn proveď dvě kontroly:

### 1. Produkční build dokumentace
```bash
pnpm exec vitepress build docs
```
Ověří, že všechny Markdown soubory jsou syntakticky v pořádku a že neobsahují nevalidní Vue výrazy.

### 2. Lékař odkazů (`wiki:doctor`)
```bash
# V jednom terminálu spusť dokumentační server:
pnpm wiki

# Ve druhém terminálu spusť kontrolu:
pnpm wiki:doctor
```
Skript [`scripts/check-docs-links.mjs`](https://github.com/spirit-of-tap/Tappka/blob/production/scripts/check-docs-links.mjs) automaticky projde všechny interní odkazy a odhalí případné nefunkční 404 trasy nebo neexistující soubory.
