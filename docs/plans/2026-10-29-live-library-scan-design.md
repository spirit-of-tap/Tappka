# Živé skenování knihovních štítků

Datum: 2026-10-29

## Cíl

Projít fyzický fond (řádově 100 knih) a bez klikání zjistit, které
vytištěné knihovní QR štítky (`/l/<code>`) jsou přiřazené ke knize
v `library_books.label_code` a které ne. Výsledkem je hlasitá a vizuální
zpětná vazba u každého skenu, ne seznam k dohledání.

## UX

- Vstup: tlačítko **Živé skenování** v hlavičce záložky *Fyzická knihovna*
  (`/cteni/sprava`), vedle *Přiřazení štítků*.
- Otevře se celoobrazovkový dialog s nepřetržitým náhledem kamery
  (QR, interval 300 ms) a černým pozadím.
- Horní lišta: název, počítadla `Přiřazeno` / `Nepřiřazeno` / `Celkem`,
  zavírací tlačítko (Esc funguje).
- Přes obraz poslední výsledek: zeleně *Přiřazeno* + `#007` + název knihy,
  oranžově *Nepřiřazeno* + `#012`, před prvním skenem neutrální nápověda.
- Každý sken:
  - přiřazený štítek → zelený toast, krátký vysoký tón, vibrace 60 ms;
  - nepřiřazený štítek → oranžový toast, nižší dvojtón, vibrace
    `[40, 60, 40]`;
  - jiný QR kód (ISBN, odkaz) → jedno varování, nepočítá se.
- Stejný kód se znovu ohlásí až po ~1,5 s bez detekce, takže držení
  telefonu nad štítkem nespamuje toasty. Počítadla počítají unikátní
  štítky za relaci a resetují se při každém otevření dialogu.
- Odepřený přístup ke kameře nebo chybějící kamera zobrazí uvnitř
  dialogu návod místo černého obdélníku.

## Implementace

- `src/components/library/library-scan-session.tsx` – tlačítko + dialog +
  stav skenu (poslední výsledek, počítadla, deduplikace).
- `src/lib/library/scan-session.ts` – čistá logika: `buildLabelLookup`
  (mapa `label_code → název knihy` z inventáře) a `shouldReportScan`
  (časové okno pro opakovanou detekci).
- `src/lib/library/scan-feedback.ts` – `primeScanAudio()` a
  `playScanFeedback('paired' | 'unpaired')` přes Web Audio (bez
  zvukových souborů) + `navigator.vibrate`; vše guardované.
- `src/components/books/coach-library-tools.tsx` – tlačítko a mapa štítků
  z už načteného inventáře.

Bez změn schématu, API ani zápisů do DB – režim je pouze pro čtení.
`options` skeneru je konstanta modulu, jinak knihovna restartuje skenovací
smyčku při každém renderu.

## Testy

- `library-scan-session.test.tsx` (mock `react-barcode-scanner` a
  `sonner`): přiřazený štítek, nepřiřazený štítek, cizí QR, deduplikace
  v okně a po něm, nepočítání duplicit.
- `scan-session.test.ts`: mapa štítků, okno opakované detekce.
- `pnpm test` a `pnpm typecheck` musí projít.
