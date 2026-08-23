# Čtení — unified tab navigation

Date: 2026-08-21
Status: approved (approach B — shared layout with tab bar)

## Problem

The Čtení module is split across four sibling routes presented as four sidebar
sub-items:

| Route | Audience | Content |
|---|---|---|
| `/cteni/prehled` | everyone | progress, my essays, team points, loans (internal tabs Moje/Tým/Výpůjčky) |
| `/cteni/hledat` | everyone | search + discovery (popular essays, category bests, highlighted books) |
| `/cteni/eseje/ke-kontrole` | kouč:ky/admin | essay review queue |
| `/cteni/sprava` | kouč:ky/admin | library management dashboard (7 internal tabs) |

UX issues found (Laws of UX analysis):

- **critical** — on mobile the module is four disconnected islands: no visible
  way to move between Přehled ↔ Hledat once inside; users must exit through
  Moduly and re-enter (Law of Uniform Connectedness, Flow).
- **major** — sidebar mixes two "places" with two "work queues" labeled by
  function type instead of user intent (Hick's Law, Chunking, Mental Model).
- **minor** — "Přehled" (state) vs "Hledat" (action) as sibling labels breaks
  area-naming conventions users know from native apps (Jakob's Law).

Mobile is the dominant access path; there is no sidebar on phones at all.

## Decision

Keep the four routes. Wrap all of `/cteni/*` in a shared layout that renders a
single app-style tab bar. One module, one persistent strip, URL-driven.

### Tab bar

Role-aware, ordered by visit frequency (Pareto):

| # | Label | Route | Who |
|---|---|---|---|
| 1 | Moje | `/cteni/prehled` | everyone |
| 2 | Objevovat | `/cteni/hledat` | everyone |
| 3 | Kontrola (+ attention badge) | `/cteni/eseje/ke-kontrole` | kouč:ky/admin |
| 4 | Správa | `/cteni/sprava` | kouč:ky/admin |

Regular members see exactly two tabs. Coach work queues sit last behind a
subtle divider ("consume" vs "work" modes). Four short labels fit a 375px
screen without scrolling; `no-scrollbar` overflow covers edge cases.

Labels are renamed to area-style names (routes unchanged): Přehled → **Moje**,
Hledat → **Objevovat**. Page h1s align with tab labels.

### Behavior

- Tabs are `<Link>`s styled after the `line` variant of `ui/tabs.tsx`
  (underline indicator on a `border-b` track); not Radix state tabs.
- Active state derives from `usePathname()`; links carry
  `aria-current="page"`. Back/forward, deep links
  (`/cteni/prehled?tab=vypujcky`) and prefetching behave natively.
- Bar is `sticky top-0 z-40 bg-background` — pinned under the status bar on
  mobile (there is no top header), always one thumb-tap away mid-scroll.
- Touch targets ≈48px (≥44px minimum).
- Badge on Kontrola uses the `TabsTriggerCount` attention tone; reserved for
  this one tab only.
- **Activation rule:** only the four section roots highlight a tab.
  Detail/editor routes (`eseje/[essayId]`, `knihy/[bookId]`, nova/upravit/
  pujcit) highlight none — they are reachable from two tabs, so picking a
  parent would misrepresent context half the time.

### Desktop sidebar

The collapsible Čtení group becomes a plain single link to `/cteni/prehled`
(standard module treatment). The title-based special-case branch in
`app-sidebar.tsx` is deleted. One mental model on every device.

## Implementation map

New files:

1. `src/app/(main)/cteni/layout.tsx` — server component; auth + profile lookup,
   one `getCoachUnreadCount()` for kouč:ky/admin; renders `<CteniTabBar>` above
   `{children}`. Layout persistence across child navigations = no flicker.
2. `src/components/cteni/cteni-tab-bar.tsx` — client component (`usePathname`);
   sticky link-nav per spec above.

Edited files:

- `src/components/app-sidebar.tsx` — remove Čtení branch + `cteniSubItems`.
- `src/app/(main)/layout.tsx` — remove `getCoachUnreadCount` call and
  `reviewCount` prop (sidebar no longer consumes it).
- Page titles aligned: Přehled h1 → "Moje čtení", Hledat sr-only h1 →
  "Objevovat".
- `src/lib/navigation.ts` — update stale special-case comment.

Tests: new component test for the tab bar (role visibility, active state per
route, badge hidden at zero). Routes don't move, so existing E2E specs and
deep-linking notification URLs stay valid.

## Out of scope

- Merging routes into one URL (rejected: loses per-page loading/metadata,
  rewrites E2E + notification links for no UX gain over the layout approach).
- Restructuring Správa's internal 7 tabs (nested second-level tabs are a
  normal native pattern).
