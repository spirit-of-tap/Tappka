# Čtení IA Redesign

## Problem

The "Čtení" (Reading) sidebar section links to only 6 routes, but the feature actually spans 16 routes across four unrelated URL roots with no shared parent: `/prehled`, `/hledat`, `/knihovna/*`, `/eseje/*`, and `/settings/kniha-knih`. Depth is inconsistent (root-level, one level under `/knihovna`, two levels under `/knihovna/[bookId]/...`, a separate `/eseje` root with no index page, and an unrelated `/settings/*` root for admin). There's also dead/orphaned surface: `/knihovna` is a no-op redirect to `/hledat`, and `/knihovna/nova` (add book) has zero inbound links anywhere in the app.

## New URL hierarchy

Everything moves under a shared `/cteni/...` prefix, matching the sidebar's single "Čtení" grouping:

```
/cteni/prehled                        (was /prehled)
/cteni/hledat                         (was /hledat)

/cteni/knihy/[bookId]                 (was /knihovna/[bookId])
/cteni/knihy/[bookId]/pujcit          (was /knihovna/[bookId]/pujcit)
/cteni/knihy/[bookId]/upravit         (was /knihovna/[bookId]/upravit)
/cteni/knihy/nova                     (was /knihovna/nova)
/cteni/knihy/rocket-model             (was /knihovna/rocket-model)
/cteni/knihy/top-bob                  (was /knihovna/top-bob)

/cteni/eseje/[essayId]                (was /eseje/[essayId])
/cteni/eseje/[essayId]/upravit        (was /eseje/[essayId]/upravit)
/cteni/eseje/nova                     (was /eseje/nova)
/cteni/eseje/ke-kontrole              (was /eseje/ke-kontrole)

/cteni/sprava                         (was /settings/kniha-knih)
```

Removed entirely:
- `/knihovna` (dead redirect to `/hledat` — nothing will reference bare `/knihovna` after the rename)
- `/knihovna/import` as a standalone route — its content (`LibraryImportScanner`) becomes a tab inside `/cteni/sprava`
- `/knihovna/moje` as a standalone route — its content (`MyLoansList`) becomes a tab inside `/cteni/prehled`

No redirects are added for old paths — this is an internal app navigated via sidebar/in-app links, not bookmarks, so old paths can just stop resolving.

## Sidebar changes

`src/components/app-sidebar.tsx` — the "Čtení" sub-item list drops from 6 to 4:

| New sidebar item | href | Visibility | Was |
|---|---|---|---|
| Přehled | `/cteni/prehled` | everyone | Přehled + Moje výpůjčky (merged as a tab) |
| Hledat | `/cteni/hledat` | everyone | Hledat |
| Ke kontrole | `/cteni/eseje/ke-kontrole` | coach/admin | Ke kontrole |
| Správa knihovny | `/cteni/sprava` | coach/admin | Nastavení + Import (merged as a tab) |

The active-state matcher (currently line ~150) updates to treat any path starting with `/cteni` as part of the Čtení section — replacing the current list of five separate prefix checks (`/prehled`, `/hledat`, `/knihovna`, `/eseje`, `/settings/kniha-knih`).

### Přehled tabs

`PrehledTabs` gains a third tab, "Výpůjčky", rendering `MyLoansList` (moved from `/knihovna/moje/page.tsx`), alongside the existing "moje"/"tym" tabs.

### Sprava tabs

`CoachDashboard` (the admin back office at `/cteni/sprava`) gains an "Import" tab rendering `LibraryImportScanner` (moved from `/knihovna/import/page.tsx`), alongside its existing processing/highlighted/rocket-model/shortlisted/longlisted management tabs. It also gains a way to reach `/cteni/knihy/nova` (see below).

## Wiring up the orphaned "Add book" page

`/cteni/knihy/nova` (`AddBookWizard`) currently has no inbound links anywhere in the codebase. Add a "Přidat knihu" action/button inside `/cteni/sprava` (coach/admin back office) linking to it, since it's coach/admin-only functionality and belongs alongside the other catalog-management actions.

## Scope of the rename

This is a pure route/navigation restructuring — no data model, RLS, or business-logic changes. Work is:

1. Move each `src/app/(main)/<old-path>/` folder to its new `src/app/(main)/cteni/<new-path>/` location.
2. Update every in-app link (`<Link href=...>`, `redirect(...)`, `router.push(...)`) that references an old path, across pages, components, and any server actions.
3. Update `src/components/app-sidebar.tsx` per the table above.
4. Merge `MyLoansList` into `PrehledTabs` as a new tab; merge `LibraryImportScanner` into `CoachDashboard` as a new tab.
5. Delete the now-empty old route folders and the dead `/knihovna` redirect page.
6. Add the "Přidat knihu" entry point inside `/cteni/sprava`.

## Testing

Per `docs/runbooks/testing.md`, this app's E2E suite (`tests/e2e/*.spec.ts`) is where route/navigation coverage lives — any spec that navigates to or asserts on one of the renamed paths (`/prehled`, `/hledat`, `/knihovna/*`, `/eseje/*`, `/settings/kniha-knih`) needs its paths updated to the `/cteni/*` equivalents. No integration or unit test changes are expected since no DB/schema or pure-logic behavior changes.
