import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

const RING_RADIUS = 40;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function progressPercent(value: number, target: number): number {
  return target > 0 ? Math.min(100, Math.max(0, (value / target) * 100)) : 0;
}

interface ProgressRingProps extends Omit<ComponentProps<'svg'>, 'viewBox'> {
  /** Filled share of the ring, 0-100. */
  percent: number;
  /** Stroke utility for the arc, e.g. `stroke-chart-5`. */
  strokeClassName: string;
  /** Stroke utility for the background track. */
  trackClassName?: string;
  /** SVG `<text>` nodes drawn in the centre (96x96 viewBox). */
  children?: ReactNode;
}

/** Ring that draws up to `percent`; centre content is passed as SVG children. */
export function ProgressRing({
  percent,
  strokeClassName,
  trackClassName = 'stroke-muted',
  children,
  className,
  ...props
}: ProgressRingProps) {
  const dash = (percent / 100) * RING_CIRCUMFERENCE;

  return (
    <svg viewBox="0 0 96 96" className={cn('size-24 shrink-0', className)} {...props}>
      <circle cx="48" cy="48" r={RING_RADIUS} fill="none" strokeWidth="10" className={trackClassName} />
      <circle
        cx="48"
        cy="48"
        r={RING_RADIUS}
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${RING_CIRCUMFERENCE}`}
        transform="rotate(-90 48 48)"
        className={cn(strokeClassName, 'motion-safe:animate-ring-draw')}
      />
      {children}
    </svg>
  );
}
