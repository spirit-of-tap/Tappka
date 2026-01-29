# TAP Brand Manual - Tappka

**Dokument:** Branding guide pro konzistentní design  
**Zdroj:** Oficiální TAP Brand Manuál V.1 (listopad 2024) + analýza kódu  
**Poslední aktualizace:** 2026-01-29

> *"We do business to learn, to live fully we earn!"*

---

## Barvy

### Primární barvy TAP

| Název | HEX | HSL | Použití |
|-------|-----|-----|---------|
| **TAP Red** | `#b31b1b` | `0 76% 39%` | Primární akce, tlačítka, odkazy, focus stavy |
| **TAP White** | `#fcfff7` | `80 100% 98%` | Pozadí (light mode), text (dark mode) |
| **TAP Brown** | `#2c1a1d` | `350 26% 14%` | Text (light mode), pozadí (dark mode) |

### CSS proměnné pro přímý přístup

```css
--color-tap-red: #b31b1b;
--color-tap-white: #fcfff7;
--color-tap-brown: #2c1a1d;
```

### Sémantické barvy

| Proměnná | Light Mode | Dark Mode | Použití |
|----------|------------|-----------|---------|
| `--primary` | TAP Red | TAP Red | Primární akce |
| `--background` | TAP White | Dark Brown | Pozadí stránky |
| `--foreground` | TAP Brown | TAP White | Hlavní text |
| `--muted` | Light warm gray | Dark brown | Tlumené pozadí |
| `--muted-foreground` | Medium brown | Light brown | Sekundární text |
| `--destructive` | Red 50% | Red 50% | Chybové stavy, mazání |
| `--border` | Light warm | Dark border | Ohraničení |
| `--ring` | TAP Red | TAP Red | Focus rings |

---

## Typografie

### Fonty

| Font | Váhy | Použití | CSS proměnná |
|------|------|---------|--------------|
| **Poppins** | 400, 600, 700, 800 | Nadpisy, branding | `--font-heading` |
| **Roboto** | 300, 400, 500, 700 | Běžný text, UI | `--font-body`, `--font-sans` |
| **Pacifico** | 400 | Citáty, dekorativní | `--font-quote` |

### Použití v kódu

```tsx
// Nadpisy - automaticky Poppins + bold
<h1>Nadpis</h1>

// Explicitní třídy
<p className="font-heading">Poppins text</p>
<p className="font-body">Roboto text</p>
<p className="font-quote">Pacifico text</p>
```

### Typografická hierarchie

| Element | Font | Velikost | Příklad použití |
|---------|------|----------|-----------------|
| H1 | Poppins Bold | `text-5xl` | Logo "Tappka" na landing |
| H2 | Poppins Bold | `text-3xl` | "Vítej, jméno!" na dashboardu |
| H3 | Poppins Bold | `text-2xl` | Titulky formulářů |
| Body | Roboto | `text-base` | Běžný text |
| Small | Roboto | `text-sm` | Popisky, nápověda |
| XS | Roboto | `text-xs` | Footer, metadata |

---

## Komponenty UI

### shadcn/ui konfigurace

```json
{
  "style": "new-york",
  "rsc": true,
  "tailwind": {
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide"
}
```

### Tlačítka (Button)

**Varianty:**
- `default` - TAP Red pozadí, bílý text
- `secondary` - TAP Brown pozadí
- `outline` - průhledné s okrajem
- `ghost` - bez pozadí, hover efekt
- `destructive` - červené pro nebezpečné akce
- `link` - vypadá jako odkaz

**Velikosti:**
- `xs`, `sm`, `default`, `lg`
- `icon`, `icon-xs`, `icon-sm`, `icon-lg`

```tsx
<Button>Primární akce</Button>
<Button variant="outline">Sekundární</Button>
<Button variant="ghost" size="sm">Malé ghost</Button>
```

### Inputy

- Výška: `h-12` pro formuláře, `h-9` default
- Border radius: `rounded-md`
- Focus: TAP Red ring

```tsx
<Input className="h-12 text-base" />
```

### Karty (Card)

- Bílé pozadí (card color)
- Jemný stín: `shadow-sm`
- Border radius: `rounded-xl`
- Padding: `px-6 py-6`

```tsx
<Card>
  <CardHeader>
    <CardTitle>Titulek</CardTitle>
    <CardDescription>Popis</CardDescription>
  </CardHeader>
  <CardContent>Obsah</CardContent>
</Card>
```

---

## Layout vzory

### Auth stránky (Landing, Sign-up, Verify)

```
┌─────────────────────────────────────┐
│ [Header - ThemeSwitcher vpravo]     │
├─────────────────────────────────────┤
│                                     │
│           Logo "Tappka"             │
│         (text-5xl, primary)         │
│           Podtitulek                │
│         (text-sm, muted)            │
│                                     │
│         [Formulář - max-w-md]       │
│                                     │
├─────────────────────────────────────┤
│ [Footer - copyright, text-xs]       │
└─────────────────────────────────────┘
```

### Dashboard layout

```
┌────────────────┬────────────────────────────┐
│                │ [Header - Breadcrumbs]     │
│   Sidebar      ├────────────────────────────┤
│                │                            │
│   - Logo       │     Main Content           │
│   - Navigace   │     (flex-1, p-4)          │
│   - User menu  │                            │
│                ├────────────────────────────┤
│                │ [Footer - copyright]       │
└────────────────┴────────────────────────────┘
```

### Sidebar struktura

- Header: Logo "T" v červeném čtverci + "Tappka"
- Search form
- Navigační skupiny: Hlavní, Aktivity, Ostatní
- Footer: User menu s avatarem

---

## Ikony

**Knihovna:** Lucide React

**Běžně používané:**
- `LayoutDashboard` - Dashboard
- `CalendarDays` - Rezervace
- `FileText` - Eseje
- `Users` - Schůzky/Týmy
- `BookOpen` - Knihovna
- `Settings` - Nastavení
- `HelpCircle` - Nápověda
- `LogOut` - Odhlášení
- `Sun`, `Moon`, `Laptop` - Téma
- `User`, `Shield` - Profil, Role

**Velikosti:**
- Sidebar ikony: `size-4` (16px)
- Běžné: 16-20px
- Dekorativní: `w-5 h-5` až `w-7 h-7`

---

## Spacing a rozměry

### Formuláře

- Max šířka: `max-w-md` (448px)
- Gap mezi poli: `space-y-5`
- Input výška: `h-12`
- Button výška: `h-12`

### Karty na dashboardu

- Grid: `grid gap-4 md:grid-cols-3`
- Padding: standardní Card padding

### Sidebar

- Logo čtverec: `size-8`
- User avatar: `h-8 w-8`

---

## Animace a přechody

### Hover efekty

```css
transition-colors
transition-all duration-300
group-hover:scale-110
group-hover:translate-x-1
```

### Focus stavy

- Ring: TAP Red (`--ring`)
- Ring width: `ring-[3px]`
- Ring opacity: `ring-ring/50`

---

## Dark/Light Mode

- Automatická detekce systému
- Manuální přepínač v UI
- Uloženo přes `next-themes`
- Všechny barvy mají light/dark variantu

---

## Lokalizace

- Primární jazyk: **Čeština**
- Sekundární: Angličtina
- UI texty jsou česky (tlačítka, labely)
- Kód a komentáře anglicky

### Příklady českých textů

- "Přihlásit se" / "Přihlašuji..."
- "Zaregistrovat se" / "Registruji..."
- "Odhlásit se"
- "Zapomenuté heslo?"
- "Ověřit kód" / "Ověřuji..."

---

## Doporučení pro nové komponenty

1. **Používej shadcn/ui** jako základ
2. **Dodržuj barevné proměnné** - nepoužívej hardcoded barvy
3. **Konzistentní spacing** - používej Tailwind utility classes
4. **Responzivita** - mobile-first přístup
5. **Přístupnost** - labels, ARIA atributy, focus stavy
6. **České texty** v UI, anglické v kódu
