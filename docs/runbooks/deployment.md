# Nasazení a CI/CD (Deployment)

Tento dokument popisuje prostředí aplikace Tappka, automatizované testování v CI a proces nasazování do náhledového (preview) i produkčního prostředí.

---

## 1. Přehled prostředí

| Prostředí | Veřejná URL | Spouštěč nasazení | Databáze |
| :--- | :--- | :--- | :--- |
| **Lokální vývoj** | `http://localhost:3000` | `pnpm dev` na vývojářském počítači | Lokální Docker PostgreSQL |
| **Náhled (Preview)** | [preview.tiimi.cz](https://preview.tiimi.cz) | Push do větve `preview` | Supabase Preview Branch |
| **Produkce** | [tiimi.cz](https://tiimi.cz) | Merge Pull Requestu do větve `production` | Supabase Production Project |

---

## 2. Kontinuální integrace (GitHub Actions)

Při každém pushnutí větve a otevření Pull Requestu se spouští validační workflow (`.github/workflows/test.yml`), které provádí:

1. **Kontrola linteru:** `pnpm lint`
2. **Kontrola typů:** `pnpm typecheck`
3. **Unit a komponentní testy:** `pnpm test`
4. **Integrační testy databáze:** `pnpm test:integration` (spustí izolovaný kontejner PostgreSQL 16 a prověří RLS i migrace)
5. **Kompilace aplikace:** `pnpm build`

Žádný kód nemůže být začleněn do produkce, pokud tyto kontroly neskončí se zeleným statusem.

---

## 3. Postup nasazení do Preview

Pro otestování změn v cloudu stačí poslat commit do větve `preview`:
```bash
git checkout preview
git merge feature/moje-funkce
git push origin preview
```
GitHub Actions a hostingová platforma automaticky sestaví novou verzi a během několika minut ji zpřístupní na [preview.tiimi.cz](https://preview.tiimi.cz).

> [!WARNING]
> **Data v Preview databázi nejsou permanentní.** V případě konfliktů může být náhledová databáze kdykoliv resetována. Důležitá testovací data vkládej výhradně do `supabase/seed.sql`.

---

## 4. Postup nasazení do Produkce

1. Vytvoř Pull Request z větve `preview` do větve `production`.
2. Počkej na proběhnutí všech CI testů.
3. Zkontroluj diff změn a migrace.
4. Schval a začleň Pull Request (Merge).
5. Produkční nasazení proběhne automaticky bez výpadku.

---

## 5. Správa Supabase Preview větve a Google OAuth

Pokud je v Supabase dashboardu smazána a znovu vytvořena vývojová větev `preview`, získá **nový `project_id`**. V takovém případě je nutné aktualizovat:

1. **Soubor `supabase/config.toml`:**
   ```toml
   [remotes.preview]
   project_id = "<nové-preview-project-id>"
   ```
2. **Google Cloud Console (OAuth klienti):**
   V [Google Auth clients](https://console.cloud.google.com/auth/clients) aktualizuj pole **Authorized redirect URIs** na tvar:
   ```
   https://<nové-preview-project-id>.supabase.co/auth/v1/callback
   ```
   Bez této změny by nefungovalo přihlašování přes Google na náhledovém prostředí.
