import type { ReactNode } from 'react';

import { CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Small uppercase label that heads every dashboard card. */
export function DashboardCardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <CardTitle className={cn('text-xs font-medium uppercase tracking-wider text-muted-foreground', className)}>
      {children}
    </CardTitle>
  );
}
