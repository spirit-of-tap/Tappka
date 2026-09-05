# Příručka pro lokální vývojové prostředí

Tato příručka provede nového vývojáře:vývojářku zprovozněním lokálního vývojového prostředí projektu Tappka od čistého stroje až po běžící aplikaci.

---

## 1. Prerekvizity

Než začneš, ujisti se, že máš nainstalováno:
1. **[Git](https://git-scm.com/)**
2. **[Docker Desktop](https://www.docker.com/)** nebo jiný OCI kompatibilní daemon (nezbytný pro lokální Supabase stack).
3. **[mise](https://mise.jdx.dev/)** — doporučený správce verzí pro Node.js a pnpm.

### Rychlá instalace přes mise:
V repozitáři je definován soubor `.mise.toml` s přesnými verzemi:
```toml
[tools]
node = "24.13.0"
pnpm = "10.28.0"
```

Spusť v kořenu repozitáře:
```bash
mise install
mise doctor
```

---

## 2. Krok za krokem: První spuštění

### Krok 1: Klonování repozitáře
```bash
git clone https://github.com/spirit-of-tap/Tappka.git
cd Tappka
```

### Krok 2: Instalace závislostí
```bash
pnpm install
```

### Krok 3: Spuštění vývojového prostředí
Ujisti se, že ti běží Docker, a spusť:
```bash
pnpm dev
```

### Co `pnpm dev` udělá automaticky za tebe?
Skript `pnpm dev` je složený z několika automatických kroků:
1. **`ensure-env`:** Ověří existenci `.env.local` a základních proměnných.
2. **`supabase:start`:** Nastartuje kompletní lokální kontejnerový stack Supabase (PostgreSQL 16, Supabase Auth, Storage, Realtime, Studio).
3. **Migrace a typy:** Automaticky aplikuje všechny migrace a vygeneruje aktuální typy.
4. **`dev:next`:** Spustí vývojový server Next.js s povoleným Node.js inspektorem pro ladění.

---

## 3. Lokální porty a služby

Po úspěšném startu jsou dostupné tyto služby:

| Služba | URL adresa | Účel |
| :--- | :--- | :--- |
| **Webová aplikace** | `http://localhost:3000` | Běžící Next.js aplikace |
| **Supabase Studio** | `http://localhost:54323` | Grafická správa databáze, tabulek, RLS a Storage |
| **Inbucket (E-mail Inbox)** | `http://localhost:54324` | Zachytávání všech odeslaných potvrzovacích e-mailů a notifikací |
| **PostgreSQL Port** | `localhost:54322` | Přímé připojení do DB (uživatel: `postgres`, heslo: `postgres`) |

---

## 4. Běžné příkazy pro vývoj

```bash
# Zastavení lokálního Supabase Docker stacku
pnpm stop

# Čistý restart celého prostředí
pnpm restart

# Kontrola TypeScript typů
pnpm typecheck

# Kontrola linteru
pnpm lint

# Spuštění unit a komponentních testů
pnpm test

# Spuštění interní dokumentace / wiki
pnpm wiki
```

---

## 5. Konfigurace Google OAuth pro lokální přihlašování

Pro přihlášení do aplikace je potřeba Google Client ID a Secret:
1. Pro rychlý start můžeš použít sdílené vývojové přihlašovací údaje od správce týmu.
2. Nebo si vytvoř vlastní projekt v [Google Cloud Console](https://console.cloud.google.com/auth/clients/create):
   - **Authorized JavaScript Origins:** `http://localhost:3000`
   - **Authorized Redirect URIs:** `http://127.0.0.1:54321/auth/v1/callback`
   - Získané `GOOGLE_CLIENT_ID` a `GOOGLE_CLIENT_SECRET` vlož do `.env.local`.
