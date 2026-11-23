import type { ReactNode } from 'react';

import { CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Small coloured label that heads every dashboard card; each card picks its colour. */
export function DashboardCardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <CardTitle className={cn('text-sm font-bold text-primary', className)}>
      {children}
    </CardTitle>
  );
}
