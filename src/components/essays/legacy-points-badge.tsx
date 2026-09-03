'use client';

import { Lock } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatPoints } from '@/lib/books/points';
import { cn } from '@/lib/utils';

export interface LegacyPointsBadgeProps {
  points?: number | string | null;
  label?: string;
  className?: string;
}

/**
 * Compact marker for essays whose points are frozen to the old
 * system's scoring (pre-2026-09-03). When points are provided, renders
 * a unified segmented badge `[🔒 staré | 3 b.]`.
 */
export function LegacyPointsBadge({ points, label = 'b.', className }: LegacyPointsBadgeProps) {
  const hasPoints = points != null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center overflow-hidden rounded-full border border-warning/35 bg-warning/10 text-xs leading-none select-none',
            className
          )}
        >
          <span
            className={cn(
              'inline-flex items-center gap-1 bg-warning/25 text-warning-strong px-1.5 py-0.5 text-[10px] font-medium',
              hasPoints && 'border-r border-warning/35'
            )}
          >
            <Lock className="size-2.5 shrink-0" />
            <span>staré</span>
          </span>
          {hasPoints && (
            <span className="px-1.5 py-0.5 text-xs font-semibold tabular-nums text-foreground">
              {formatPoints(points)} {label}
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>Body za tuto esej jsou zamčené ze staršího systému.</TooltipContent>
    </Tooltip>
  );
}

