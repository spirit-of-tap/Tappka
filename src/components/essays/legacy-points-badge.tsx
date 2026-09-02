'use client';

import { Lock } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Always-visible marker for essays whose points are frozen to the old
 * system's scoring (pre-2026-09-03) — a bare `title` attribute needs a hover
 * to discover at all, so this renders as its own small badge instead, with
 * the fuller explanation still available on hover/focus.
 */
export function LegacyPointsBadge() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning-strong px-1.5 py-0.5 text-[10px] font-medium leading-none">
          <Lock className="size-2.5 shrink-0" />
          staré bodování
        </span>
      </TooltipTrigger>
      <TooltipContent>Body za tuto esej jsou zamčené ze staršího systému.</TooltipContent>
    </Tooltip>
  );
}
