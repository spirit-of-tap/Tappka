# Design systém a uživatelské rozhraní

Design systém aplikace Tappka vychází z pravidel definovaných v `DESIGN.md`. Zajišťuje vizuální soudržnost, vysokou přístupnost (a11y), bezproblémovou podporu světlého i tmavého režimu a respekt k inkluzivnímu vyjadřování.

---

## 1. Sémantické barvy a tokeny

Všechny barvy v komponentách jsou striktně navázány na sémantické CSS proměnné definované v `src/app/globals.css`. **V kódu komponent je zakázáno používat surové Tailwind barvy (např. `bg-blue-500`) nebo hexadecimální kódy.**

### Klíčové tokeny:

| Token | Třída v Tailwindu | Význam / Použití |
| :--- | :--- | :--- |
| `background` | `bg-background` | Výchozí pozadí stránky |
| `foreground` | `text-foreground` | Výchozí barva primárního textu |
| `card` | `bg-card` | Pozadí karet, panelů a kontejnerů |
| `card-foreground` | `text-card-foreground` | Text uvnitř karet |
| `muted` | `bg-muted` | Tlumená pozadí (vyhledávací pole, oddělovače) |
| `muted-foreground`| `text-muted-foreground` | Doplňkový, sekundární text a popisky |
| `primary` | `bg-primary` / `text-primary` | Hlavní akční prvek aplikace (tlačítka, aktivní záložky) |
| `primary-foreground` | `text-primary-foreground` | Text na primárním pozadí |
| `accent` | `bg-accent` | Jemné zvýraznění při hoveru nebo vybrání |
| `destructive` | `bg-destructive` / `text-destructive` | Destruktivní akce (smazání, zrušení rezervace) |
| `border` | `border-border` | Standardní jemné ohraničení karet a tabulek |
| `ring` | `ring-ring` | Vizuální zvýraznění fokusu pro klávesnici |

### Zvýraznění stavů a grafy (`chart-1` až `chart-5`)
Pro stavové štítky a grafické ukazatele se používají tónované plochy v kombinaci s odpovídajícím textem:
- Pro role uživatelů: Student (`chart-3`), Kouč:ka (`chart-2`), Mentor:ka (`chart-5`), Admin (`destructive`).
- Text na tónovaných površích vždy používá variantu `-strong` nebo dostatečný kontrastní poměr (minimálně WCAG AA 4.5:1).

---

## 2. Typografie a písma

Aplikace využívá dvě fontové rodiny:
- **Nadpisy (`font-heading`):** [Poppins](https://fonts.google.com/specimen/Poppins) — geometrický, moderní sans-serif pro hlavní titulky stránek (`h1`, `h2`).
- **Základní text (`font-sans`):** [Inter](https://fonts.google.com/specimen/Inter) — vysoce čitelný neutrální font optimalizovaný pro rozhraní a delší texty esejů.
- **Čísla a časové údaje:** Všude tam, kde se zobrazují časové sloty, počty kreditů nebo finanční částky, se aplikuje třída `tabular-nums` pro zarovnání číslic stejné šířky.

---

## 3. Sdílené komponenty a primitivy

Aplikace striktně zapovídá vytváření vlastních ad-hoc tlačítek nebo potvrzovacích oken. Vždy se využívají sdílené komponenty z `src/components/ui/`:

### 3.1 `PageShell` a `PageHeader`
Každá obrazovka v sekci `(main)` je obalena do jednotného layoutu:

```tsx
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { pluralizeCz } from "@/lib/utils/pluralize-cz";

export default function ReservationsPage() {
  return (
    <PageShell size="full">
      <PageHeader
        title="Rezervace místností"
        description="Přehled a správa týmových prostor v kampusu"
        count={{
          value: availableRoomsCount,
          label: pluralizeCz(availableRoomsCount, ["volná místnost", "volné místnosti", "volných místností"]),
        }}
        action={<CreateReservationButton />}
        back={{ href: "/moduly", label: "Moduly" }}
      />
      {/* Obsah stránky */}
    </PageShell>
  );
}
```

### 3.2 Prázdné stavy (`EmptyState`)
Místo prázdné bílé plochy se při absenci dat vždy zobrazuje strukturovaný prázdný stav:
- Srozumitelná ikona.
- Jednoznačný nadpis a vysvětlující podtitul.
- Přímá akční výzva (CTA tlačítko), např. *"Vytvořit první rezervaci"*, *"Vymazat filtry vyhledávání"*.

### 3.3 Dialogy a potvrzení
- **Žádné `window.confirm()`:** Destruktivní akce vždy otevírají responzivní `AlertDialog`.
- **Notifikace:** Zpětná vazba o úspěchu či chybě se zobrazuje přes `toast.success()` / `toast.error()` z knihovny `sonner`.

---

## 4. Standardy inkluzivní češtiny (Inclusive Czech)

Tappka je vnitřním prostředím pro rovnocenné studující a pedagogy. Jazyk rozhraní se řídí metodikou z [inkluzivne.com](https://inkluzivne.com) (doc. Jana Valdrová).

### Pravidla:
1. **Důsledné tykání:** Všude v aplikaci se uživatelům tyká (např. *"Tvoje rezervace"*, *"Odevzdej esej"*).
2. **Zákaz generického maskulina:** Nelze používat formulace jako *"Uživatelé vidí..."* nebo *"Všichni studenti musí..."*.
3. **Výhradně dvojtečkový zápis:** Pokud je nutné uvést obě rodové formy, používá se **pouze dvojtečka (`:`)**. Závorky (`autor(ka)`) a lomítka (`autor/ka`) jsou **zakázány**.
   - Správně: `autor:ka`, `kouč:ka`, `čtenář:ka`, `kolega:kolegyně`, `zapsal:a`.
   - Špatně: `autor(ka)`, `autor/ka`, `studenti a studentky` (pokud lze nahradit opisem).
4. **Přednost neutralizaci a přítomnému času:**
   - Místo *"Student byl přihlášen"* použijte: *"Přihlášení proběhlo úspěšně"* nebo *"Jsi přihlášen:a"*.
   - Místo *"Uživatelé"* použijte: *"Studující"*, *"Členové a členky týmu"*, *"Tým"*.

---

## 5. Podpora témat (Light & Dark mode)

Aplikace nativně podporuje světlý i tmavý motiv. Každá nová komponenta musí být ověřena v obou režimech:
- Tmavý režim nesmí používat čistě černou barvu `#000000` na velkých plochách, ale sytě břidlicové a uhlíkové tóny s odpovídajícím odstupňováním hloubky.
- Rámečky (`border-border`) mají v tmavém režimu jemný kontrast, aby oddělovaly vrstvy bez oslňování.
