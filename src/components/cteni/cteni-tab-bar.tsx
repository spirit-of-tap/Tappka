'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';
import { User, Compass, ClipboardCheck, SlidersHorizontal, type LucideIcon } from 'lucide-react';

import { TabsTriggerCount } from '@/components/ui/tabs';

interface CteniTab {
  title: string;
  url: string;
  icon?: LucideIcon;
  /** Renders the coach review count as an attention badge when > 0. */
  showsReviewCount?: boolean;
}

/** Member areas — ordered by visit frequency (most visited first). */
const MEMBER_TABS: CteniTab[] = [
  { title: 'Moje', url: '/cteni/prehled', icon: User },
  { title: 'Objevovat', url: '/cteni/hledat', icon: Compass },
];

/** Coach work queues trail behind a divider. */
const COACH_TABS: CteniTab[] = [
  { title: 'Kontrola', url: '/cteni/eseje/ke-kontrole', icon: ClipboardCheck, showsReviewCount: true },
  { title: 'Správa', url: '/cteni/sprava', icon: SlidersHorizontal },
];

export function getActiveCteniTabUrl(pathname: string, isCoachOrAdmin: boolean): string | undefined {
  // 1. Coach queues
  if (
    isCoachOrAdmin &&
    (pathname === '/cteni/eseje/ke-kontrole' || pathname.startsWith('/cteni/eseje/ke-kontrole/'))
  ) {
    return '/cteni/eseje/ke-kontrole';
  }
  if (
    isCoachOrAdmin &&
    (pathname === '/cteni/sprava' || pathname.startsWith('/cteni/sprava/'))
  ) {
    return '/cteni/sprava';
  }

  // 2. Moje čtení (overview, authoring new essay, editing own draft/essay, or any subpage under /cteni/prehled)
  if (
    pathname === '/cteni/prehled' ||
    pathname.startsWith('/cteni/prehled/') ||
    pathname === '/cteni/eseje/nova' ||
    pathname.endsWith('/upravit')
  ) {
    return '/cteni/prehled';
  }

  // 3. Objevovat (search/discovery feed, book details, community essays, curated selections)
  if (
    pathname === '/cteni/hledat' ||
    pathname.startsWith('/cteni/hledat/') ||
    pathname.startsWith('/cteni/knihy') ||
    pathname.startsWith('/cteni/eseje')
  ) {
    return '/cteni/hledat';
  }

  // 4. Default prefix match
  const tabs = isCoachOrAdmin ? [...MEMBER_TABS, ...COACH_TABS] : MEMBER_TABS;
  return tabs.find((tab) => pathname === tab.url || pathname.startsWith(tab.url + '/'))?.url;
}

interface CteniTabBarProps {
  isCoachOrAdmin: boolean;
  reviewCount: number;
}

/**
 * Single persistent navigation strip for every /cteni/* route. URL-driven —
 * not Radix state tabs — so back/forward, deep links and
 * prefetching behave natively. Visual language mirrors ui/tabs.tsx `line`.
 */
export function CteniTabBar({ isCoachOrAdmin, reviewCount }: CteniTabBarProps) {
  const pathname = usePathname();
  const tabs = isCoachOrAdmin ? [...MEMBER_TABS, ...COACH_TABS] : MEMBER_TABS;
  const activeUrl = getActiveCteniTabUrl(pathname, isCoachOrAdmin);

  return (
    // Mobile: pinned full-bleed strip — there is no top header on phones, so
    // this bar IS the module chrome and must stay one thumb-tap away.
    // Desktop (md+): static, content-aligned — pinned it would stack under the
    // breadcrumb header and read as a second navbar.
    <nav
      aria-label="Čtení"
      className="sticky top-0 z-40 -mx-4 border-b bg-background px-4 md:static md:z-auto md:mx-0 md:px-0"
    >
      <div className="flex max-w-full items-center gap-1 overflow-x-auto no-scrollbar md:container md:mx-auto md:px-6">
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
                // ~48px tap height (≥44px minimum), underline indicator on the track.
                'relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-none',
                'px-3 py-3.5 text-sm font-medium transition-colors focus-ring',
                'after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full',
                'after:bg-primary after:opacity-0 after:transition-opacity',
                'text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground',
                'data-[active=true]:text-foreground data-[active=true]:after:opacity-100',
              ].join(' ')}
            >
              {tab.icon && <tab.icon className="size-4 shrink-0" aria-hidden="true" />}
              <span>{tab.title}</span>
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
