# Mobile Bottom Navigation — Design

Date: 2026-08-20
Status: Validated

## Goal

On mobile (< `md`), replace the sidebar-based navigation (slide-over sheet)
with a native-app-like bottom tab bar and hub pages. The desktop experience
(sidebar, header trigger) stays exactly as it is today.

## Current state

- `(main)/layout.tsx` renders `SidebarProvider` + `AppSidebar` + header
  (`SidebarTrigger` + breadcrumb) + `main` + footer.
- Below `md` the shadcn `Sidebar` component renders a `Sheet` instead of the
  rail; `AppSidebarContent` closes it on navigation.
- `FloatingFeedback` pill floats at `fixed bottom-20 right-5`.

## Decisions

- **Scope**: all modules listed, beta-gated exactly like the sidebar.
- **Profil tab** opens a hub page (user card + account actions), not the raw
  profile page.
- **Header**: stays, slim, without the burger on mobile.
- **Floating feedback pill is removed entirely.** Feedback stays reachable on
  mobile via a row on the Profil hub; desktop keeps the sidebar footer button.

## Architecture

### 1. Shared nav config — `src/lib/navigation.ts`

Single source of truth for modules: `{ title, url, icon, betaOnly,
description }` (Czech, gender-neutral descriptions for cards). Used by:

- `app-sidebar.tsx` (renders the "Hlavní" group from it; keeps its special
  collapsibles for Místnosti/Čtení, keyed by `title`)
- `/moduly` hub page
- Dev/Mailpit items stay sidebar-only.

### 2. `/moduly` hub page (new, server component)

`PageShell` + `PageHeader`; responsive icon-card grid (`grid-cols-2
lg:grid-cols-4`). Card: icon tile (`bg-primary/10 text-primary`), title,
description, `Beta` badge on beta items. Gating mirrors the sidebar
(`beta_access_granted_at`). Active module shows a subtle ring. Cards are plain
`Link`s.

### 3. `/profil` hub page (new, server component)

User card (avatar, name, email, role) + rows: Můj profil →
`/komunita/profil/:id`, Notifikace, Portfolio (beta-badged), Beta přístup,
Zpětná vazba (rose-tinted, replaces the removed floating pill), theme switcher
(client), Odhlásit se (client; same `signOut` + redirect as `nav-user.tsx`).

### 4. `MobileBottomNav` (new, client component)

- `md:hidden fixed inset-x-0 bottom-0 z-50 h-16 border-t`
- `bg-background/95 backdrop-blur`; iOS safe area via
  `pb-[env(safe-area-inset-bottom)]`
- Tabs (flex column, icon `size-5` + `text-[11px]` label):
  - **Domů** (`House`) → `/`, active on exact `/`
  - **Moduly** (`LayoutGrid`) → `/moduly`, active on `/moduly`+ prefix
  - **Profil** (`User`) → `/profil`, active on `/profil`+ prefix
- Active: `text-primary`; inactive: `text-muted-foreground`; whole-tab
  `active:scale-[0.98]`.

### 5. Layout changes — `(main)/layout.tsx`

- `AppSidebar` returns `null` when `useSidebar().isMobile` → mobile sheet dies
  with it (no flash: desktop rail is `hidden` below `md` on SSR anyway).
- `SidebarTrigger` becomes `hidden md:inline-flex`.
- Remove `FloatingFeedback` import/usage; delete
  `src/components/feedback/floating-feedback.tsx`.
- `main` padding: `pb-24 md:pb-0` so the bar never covers content.
- Footer text: `hidden md:block` (tab bar replaces it as bottom chrome).

## UX notes

- Pages stay single-column on mobile (existing behavior, NOT changed).
- All colors via semantic tokens from `globals.css`; both themes verified.
- Czech copy gender-neutral (`:` separator rules per DESIGN.md).

## Testing

- Component tests (vitest + testing-library):
  - `mobile-bottom-nav.test.tsx` — renders 3 tabs; correct active state per
    path.
  - moduly page — beta user sees beta modules, non-beta does not.
  - profil hub — renders user info and menu rows.
- `pnpm typecheck` + full fast suite before commit.
- No DB / migration changes.

## Amendment (2026-08-21, product owner feedback)

1. **Bottom bar has 4 tabs**: Domů, Moduly, **Komunita**, Profil (Komunita
   promoted from the hub grid to its own tab).
2. **Section highlighting**: the Moduly tab stays active while the user is
   inside any module route (derived from `NAV_MODULES`, excluding `/` and
   `/komunita*` — Komunita owns that space). Komunita tab is active on
   `/komunita*`.
3. **Hub composition & ordering by visit frequency** (product owner data):
   Čtení (multiple×/week), Místnosti (weekly), Nástroje a techniky (weekly),
   Zák. schůzky (few×/month), Týmová reflexe (monthly), Týmový deník (3×/year),
   Koučování (2×/year), Birth Giving (2×/year), Osobnostní testy (≤1×/year).
   Dashboard and Komunita no longer appear as hub cards (both are permanent
   tabs). Weekly+ tier renders as full-width featured cards; the rest stay
   compact grid cards. Desktop sidebar order is unchanged.
4. **No top header on mobile** (reverses the earlier "slim header with title"
   decision — the owner tried it and found it not useful). The header
   (trigger/breadcrumb/title) renders `md+` only; content starts at the top on
   phones. The `MobilePageTitle` component is removed.

## Out of scope

- Desktop sidebar behavior (unchanged).
- Module internals (no new module routes).
- Feedback destination page itself.