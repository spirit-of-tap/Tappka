# Čtení unified tabs — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the four disconnected Čtení surfaces with one module wrapped in a single sticky, role-aware tab bar (Moje · Objevovat · Kontrola · Správa).

**Architecture:** New `/cteni` layout renders a client `CteniTabBar` above all children; active state derives from `usePathname()` so routes stay unchanged and deep links keep working. Desktop sidebar's Čtení special-case collapses into a standard module link; the root layout drops its reviewCount fetch (the module layout fetches it itself).

**Tech Stack:** Next.js App Router layouts, supabase-js server client, Tailwind v4 semantic tokens, vitest + Testing Library (component project), existing `ui/tabs.tsx` primitives (`TabsTriggerCount`, `focus-ring`, `no-scrollbar`).

**Design doc:** `docs/plans/2026-08-21-cteni-unified-tabs-design.md`

---

### Task 1: `CteniTabBar` component (TDD)

**Files:**
- Test: `src/components/cteni/cteni-tab-bar.test.tsx`
- Create: `src/components/cteni/cteni-tab-bar.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CteniTabBar } from './cteni-tab-bar';

const mockPathname = vi.fn(() => '/cteni/prehled');

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

function renderBar(props?: Partial<{ isCoachOrAdmin: boolean; reviewCount: number }>) {
  return render(<CteniTabBar isCoachOrAdmin={false} reviewCount={0} {...props} />);
}

beforeEach(() => {
  mockPathname.mockReturnValue('/cteni/prehled');
});

describe('CteniTabBar', () => {
  it('shows only member areas without a coach role', () => {
    renderBar();

    expect(screen.getByRole('link', { name: 'Moje' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Objevovat' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Kontrola/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Správa' })).not.toBeInTheDocument();
  });

  it('adds the coach work queues with a role', () => {
    renderBar({ isCoachOrAdmin: true });

    expect(screen.getByRole('link', { name: /Kontrola/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Správa' })).toBeInTheDocument();
  });

  it('marks exactly the current section root with aria-current', () => {
    mockPathname.mockReturnValue('/cteni/hledat');
    renderBar({ isCoachOrAdmin: true });

    expect(screen.getByRole('link', { name: 'Objevovat' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const currents = screen
      .getAllByRole('link')
      .filter((link) => link.hasAttribute('aria-current'));
    expect(currents).toHaveLength(1);
  });

  it('highlights nothing on detail routes shared by several sections', () => {
    mockPathname.mockReturnValue('/cteni/knihy/some-id');
    renderBar({ isCoachOrAdmin: true });

    const currents = screen
      .getAllByRole('link')
      .filter((link) => link.hasAttribute('aria-current'));
    expect(currents).toHaveLength(0);
  });

  it('carries the review count badge only while essays are waiting', () => {
    mockPathname.mockReturnValue('/cteni/sprava');
    const { rerender } = renderBar({ isCoachOrAdmin: true, reviewCount: 3 });

    // Accessible name includes the badge digits.
    expect(screen.getByRole('link', { name: /Kontrola/ })).toHaveTextContent('3');

    rerender(<CteniTabBar isCoachOrAdmin reviewCount={0} />);
    // At zero the badge disappears, leaving the bare label.
    expect(screen.getByRole('link', { name: 'Kontrola' })).not.toHaveTextContent('Kontrola0');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project component src/components/cteni/cteni-tab-bar.test.tsx`
Expected: FAIL — cannot resolve `./cteni-tab-bar`.

**Step 3: Write the implementation**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';

import { TabsTriggerCount } from '@/components/ui/tabs';

interface CteniTab {
  title: string;
  url: string;
  /** Renders the coach review count as an attention badge when > 0. */
  showsReviewCount?: boolean;
}

/** Member areas — ordered by visit frequency (most visited first). */
const MEMBER_TABS: CteniTab[] = [
  { title: 'Moje', url: '/cteni/prehled' },
  { title: 'Objevovat', url: '/cteni/hledat' },
];

/** Coach work queues trail behind a divider — a different mental mode ("work" vs "read"). */
const COACH_TABS: CteniTab[] = [
  { title: 'Kontrola', url: '/cteni/eseje/ke-kontrole', showsReviewCount: true },
  { title: 'Správa', url: '/cteni/sprava' },
];

interface CteniTabBarProps {
  isCoachOrAdmin: boolean;
  reviewCount: number;
}

/**
 * Single persistent navigation strip for every /cteni/* route. URL-driven —
 * not Radix state tabs — so back/forward, deep links (?tab=vypujcky) and
 * prefetching behave natively. Visual language mirrors ui/tabs.tsx `line`.
 */
export function CteniTabBar({ isCoachOrAdmin, reviewCount }: CteniTabBarProps) {
  const pathname = usePathname();
  const tabs = isCoachOrAdmin ? [...MEMBER_TABS, ...COACH_TABS] : MEMBER_TABS;

  // Only section roots highlight a tab: detail/editor routes are reachable
  // from more than one tab, so claiming a parent would misrepresent context.
  const activeUrl = tabs.find(
    (tab) => pathname === tab.url || pathname.startsWith(tab.url + '/'),
  )?.url;

  return (
    // -mx-4/px-4 bleeds across main's padding; bg masks content scrolling under.
    <nav aria-label="Čtení" className="sticky top-0 z-40 -mx-4 border-b bg-background px-4">
      <div className="flex max-w-full items-center gap-1 overflow-x-auto no-scrollbar">
        {tabs.map((tab, index) => (
          <Fragment key={tab.url}>
            {index === MEMBER_TABS.length && (
              <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />
            )}
            <Link
              href={tab.url}
              aria-current={activeUrl === tab.url ? 'page' : undefined}
              data-active={activeUrl === tab.url ? 'true' : undefined}
              className={[
                // ~48px tap height (≥44px target), underline indicator on the track.
                'relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-none',
                'px-3 py-3 text-sm font-medium transition-colors focus-ring',
                'after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full',
                'after:bg-primary after:opacity-0 after:transition-opacity',
                'text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground',
                'data-[active=true]:text-foreground data-[active=true]:after:opacity-100',
              ].join(' ')}
            >
              {tab.title}
              {tab.showsReviewCount && (
                <TabsTriggerCount count={reviewCount} tone="attention" />
              )}
            </Link>
          </Fragment>
        ))}
      </div>
    </nav>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project component src/components/cteni/cteni-tab-bar.test.tsx`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/components/cteni/cteni-tab-bar.tsx src/components/cteni/cteni-tab-bar.test.tsx
git commit -m "feat(cteni): add sticky role-aware tab bar"
```

---

### Task 2: `/cteni` layout wiring the bar

**Files:**
- Create: `src/app/(main)/cteni/layout.tsx`

**Step 1: Create the layout**

```tsx
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getCoachUnreadCount } from '@/lib/essays/queries';
import { CteniTabBar } from '@/components/cteni/cteni-tab-bar';

export default async function CteniLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile) redirect('/auth/login');

  const isCoachOrAdmin = profile.role === 'coach' || profile.role === 'admin';
  let reviewCount = 0;
  if (isCoachOrAdmin && profile.team_id) {
    reviewCount = await getCoachUnreadCount(supabase, profile.id, profile.team_id);
  }

  return (
    <>
      <CteniTabBar isCoachOrAdmin={isCoachOrAdmin} reviewCount={reviewCount} />
      {children}
    </>
  );
}
```

Note: layouts persist across child navigations — the bar never re-renders or
flickers between tabs. The root `loading.tsx` keeps working beneath it.

**Step 2: Verify build**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

Manual smoke (dev server, both roles if possible): `/cteni/prehled` shows the
bar pinned under the status bar on mobile viewport; switching Moje ↔ Objevovat
keeps scroll positions independent; coach additionally sees Kontrola/Správa
with divider.

**Step 3: Commit**

```bash
git add "src/app/(main)/cteni/layout.tsx"
git commit -m "feat(cteni): wrap module in shared tab bar layout"
```

---

### Task 3: Sidebar + root layout cleanup

**Files:**
- Modify: `src/components/app-sidebar.tsx` (interface, ~lines 40–67; Čtení branch ~lines 153–208)
- Modify: `src/app/(main)/layout.tsx` (~lines 49–60)
- Modify: `src/lib/navigation.ts:44` comment

**Step 1: Remove reviewCount plumbing**

`src/app/(main)/layout.tsx`:
- delete the import of `getCoachUnreadCount` from `@/lib/essays/queries`
- delete the `isCoachOrAdmin` / `let reviewCount` block
- change `<AppSidebar user={sidebarUser} reviewCount={reviewCount} />` to `<AppSidebar user={sidebarUser} />`

`src/components/app-sidebar.tsx`:
- delete `reviewCount?: number` from `AppSidebarProps`
- `AppSidebar`: drop the `reviewCount` param
- `AppSidebarContent({ user, reviewCount = 0 })` → `AppSidebarContent({ user })`

**Step 2: Remove the Čtení special case**

In `AppSidebarContent` delete:
- `const isCteniActive = pathname.startsWith("/cteni")`
- the whole `const cteniSubItems = [...]` array
- the entire `// Čtení — beta-only` `if (item.title === "Čtení") { … return … }` block

The module then falls through to the generic `betaOnly` branch → plain link
with Beta badge → `/cteni/prehled`. Do NOT touch the Místnosti collapsible or
the Osobnostní testy branch.

Update both stale comments:
- `navigation.ts` line ~44: now only Osobnostní testy renders via a
  title-based special-case branch (Čtení moved into its own layout tab bar).
- `app-sidebar.tsx` lines ~100–102: same adjustment (branch order still
  matters only for Osobnostní testy).

**Step 3: Verify**

Run: `pnpm exec tsc --noEmit && pnpm vitest run --project component src/components/navigation src/lib/navigation.test.ts`
Expected: no errors, tests pass.

Manual smoke: desktop sidebar shows single "Čtení" entry (Beta badge), no
sub-items; mobile bottom nav still lights "Moduly" on any `/cteni/*` route.

**Step 4: Commit**

```bash
git add src/components/app-sidebar.tsx "src/app/(main)/layout.tsx" src/lib/navigation.ts
git commit -m "refactor(nav): collapse Čtení sidebar group into single link"
```

---

### Task 4: Page titles aligned with tab labels

**Files:**
- Modify: `src/app/(main)/cteni/prehled/page.tsx` (metadata + PageHeader)
- Modify: `src/components/search/search-page-client.tsx:123`

**Step 1: Rename Přehled h1**

`src/app/(main)/cteni/prehled/page.tsx`:

```tsx
export const metadata = {
  title: 'Moje čtení | Tappka',
  description: 'Tvůj pokrok, eseje a srovnání s týmem',
};
```

and in JSX: `<PageHeader title="Moje čtení" description="Tvůj pokrok, eseje a srovnání s týmem" />`
(description unchanged — DESIGN.md pairs it with metadata.description.)

**Step 2: Rename Objevovat sr-only h1**

`search-page-client.tsx` line ~123: `<h1 className="sr-only">Hledat</h1>` →
`<h1 className="sr-only">Objevovat</h1>`. Leave the input placeholder
"Hledat eseje, knihy, témata…" as-is (it names the action inside the area).
Ke kontrole and Správa page titles stay (queue/dashboard names, close enough
to their short tab labels).

**Step 3: Verify**

Run: `grep -rn '"Přehled | Tappka"' src/ || echo clean` → `clean`
Run: `pnpm exec tsc --noEmit && pnpm vitest run --project component`
Expected: clean, all green (dashboard cards keep their own local "Přehled"
link text — untouched by design).

**Step 4: Commit**

```bash
git add "src/app/(main)/cteni/prehled/page.tsx" src/components/search/search-page-client.tsx
git commit -m "feat(cteni): align page titles with tab labels"
```

---

### Task 5: Full verification

**Step 1:** `pnpm test` — unit + component green.
**Step 2:** `pnpm exec tsc --noEmit` — clean. Lint per repo convention if configured (`pnpm lint`).
**Step 3:** E2E (needs running stack): `pnpm test:e2e tests/e2e/reading.spec.ts` — routes unchanged, must stay green.
**Step 4:** Manual checklist (dev server, phone viewport + desktop):
- [ ] Member: two tabs; switching works; back button returns correctly
- [ ] Kouč:ka: four tabs, red count badge on Kontrola when essays wait, hidden at zero
- [ ] Detail page (essay/book): no tab highlighted
- [ ] Sticky bar masks scrolled content on mobile; bottom nav clears it (`pb-[calc(4rem+env(safe-area-inset-bottom))]` on main)
- [ ] Light AND dark themes verified
- [ ] Deep link `/cteni/prehled?tab=vypujcky` opens Výpůjčky inside Moje

**Step 5:** Final commit of any fixes; done.
