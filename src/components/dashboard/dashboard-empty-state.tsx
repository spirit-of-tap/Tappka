import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface DashboardEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Tinted chip classes, matching the quick-action colours. */
  tone?: string;
  action?: ReactNode;
}

/** Empty card body: tinted icon, one-line headline, short hint and an optional action. */
export function DashboardEmptyState({
  icon: Icon,
  title,
  description,
  tone = 'bg-muted text-muted-foreground',
  action,
}: DashboardEmptyStateProps) {
  return (
    <div className="flex items-start gap-3">
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', tone)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
        {action && <div className="pt-2">{action}</div>}
      </div>
    </div>
  );
}
