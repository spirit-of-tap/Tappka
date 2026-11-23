import type { ReactNode } from 'react';

import { CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Standalone dashboard card: fills its grid cell, softer radius than the default Card. */
export const DASHBOARD_SECTION = 'h-full gap-4 rounded-2xl py-5';

/** Small coloured label that heads every dashboard card; each card picks its colour. */
export function DashboardCardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <CardTitle className={cn('text-sm font-bold text-primary', className)}>
      {children}
    </CardTitle>
  );
}
