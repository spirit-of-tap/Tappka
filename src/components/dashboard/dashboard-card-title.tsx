import type { ReactNode } from 'react';

import { CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Dashboard widgets are sections inside a shared panel, separated by hairlines,
 * not standalone cards: Card's own border, background and shadow are dropped.
 */
export const DASHBOARD_SECTION = 'gap-4 rounded-none border-0 bg-transparent py-5 shadow-none';

/** Small coloured label that heads every dashboard card; each card picks its colour. */
export function DashboardCardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <CardTitle className={cn('text-sm font-bold text-primary', className)}>
      {children}
    </CardTitle>
  );
}
