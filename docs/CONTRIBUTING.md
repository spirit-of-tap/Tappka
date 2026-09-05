# Jak přispívat do projektu Tappka

Tento dokument shrnuje zásadní postupy pro vývojář:ky, kteří chtějí přispívat do kódu platformy Tappka.

---

## 1. Proměnné prostředí a hladký start

Projekt je navržen tak, aby jej bylo možné spustit lokálně bez zdlouhavého ručního nastavování proměnných. Cílem je umožnit novým členům:kám týmu začít okamžitě vyvíjet (vibecoding) bez zbytečných překážek.

- Pokud vznikne potřeba nové proměnné prostředí a není citlivá, přidej ji do `.env.example`.
- Skripty v `scripts/package-json-helpers/` při startu automaticky kontrolují přítomnost potřebných proměnných a v případě potřeby tě vyzvou k jejich doplnění.

### Google OAuth pro lokální vývoj

Pro lokální přihlašování přes Google je vyžadován Google OAuth Client Secret:
1. Můžeš požádat správce projektu o sdílený vývojový klíč.
2. Nebo si vytvoř vlastní testovací OAuth aplikaci v [Google Cloud Console](https://console.cloud.google.com/auth/clients/create):
   - **Authorized JavaScript Origins:** `http://localhost:3000`
   - **Authorized Redirect URIs:** `http://127.0.0.1:54321/auth/v1/callback`

---

## 2. Databázové migrace

Před úpravami databáze si prostuduj podrobný návod v [`docs/data-layer.md`](https://github.com/spirit-of-tap/Tappka/blob/production/docs/data-layer.md) a [`docs/runbooks/database-migrations.md`](https://github.com/spirit-of-tap/Tappka/blob/production/docs/runbooks/database-migrations.md).

### Změna schématu nebo RLS politik:
1. Uprav definici v `db/schema/`.
2. Spusť generování a aplikaci migrace:
   ```bash
   pnpm db:migrate
   ```
   *(Pokud se Drizzle zeptá, zda se jedná o přejmenování, odpověz podle skutečnosti. Pokud došlo ke změně typu, zvol ne).*
3. Pokud potřebuješ čistý stav bez ohledu na stávající lokální data:
   ```bash
   pnpm db:force-migrate
   ```

### PostgreSQL funkce a triggery:
1. Vygeneruj prázdnou migraci:
   ```bash
   pnpm db:generate:custom
   ```
2. Vepiš do nového SQL souboru definici funkce nebo triggeru.
3. Aplikuj migraci do lokální databáze:
   ```bash
   pnpm db:up
   ```

---

## 3. Spouštění testů

Před odesláním kódu vždy spusť testovací sadu:
```bash
pnpm test          # Rychlé unit a komponentní testy
pnpm test:watch    # Režim automatického spouštění při úpravě kódu
pnpm test:integration  # Testy databázových migrací a RLS v Dockeru
pnpm test:e2e      # End-to-end toky v Playwrightu
```

---

## 4. Vývojová prostředí a nasazení

- **Lokální prostředí:** `http://localhost:3000` (Supabase Studio běží na `http://localhost:54323`).
- **Náhled (Preview):** Push do větve `preview` automaticky nasadí aplikaci na [preview.tiimi.cz](https://preview.tiimi.cz).
  > [!WARNING]
  > V náhledové databázi neukládej trvalá data — může být kdykoliv resetována. Důležitá testovací data vkládej do `supabase/seed.sql`.
- **Produkce:** Změny do produkce se nasazují otevřením Pull Requestu z větve `preview` do větve `production`. Po schválení a začlenění proběhne automatický deploy na [tiimi.cz](https://tiimi.cz).
