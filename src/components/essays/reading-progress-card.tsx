import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

import { bookPointsSlide, type BookStats } from '@/lib/dashboard/progress-slides';
import { currentStudySemester } from '@/lib/metrics/semester-milestone';

const RING_RADIUS = 40;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function percent(value: number, target: number): number {
  return target > 0 ? Math.min(100, Math.max(0, (value / target) * 100)) : 0;
}

interface ReadingProgressCardProps {
  stats: BookStats;
  onboardingYear?: number | null;
  /** Revealed under the card, e.g. the team ranking. Needs `detailsLabel`. */
  details?: ReactNode;
  detailsLabel?: string;
}

/** Book points against the semester milestone and the whole study. */
export function ReadingProgressCard({ stats, onboardingYear, details, detailsLabel }: ReadingProgressCardProps) {
  const slide = bookPointsSlide(stats, currentStudySemester(new Date(), onboardingYear));
  const dash = (percent(slide.value, slide.goal) / 100) * RING_CIRCUMFERENCE;

  const body = (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 96 96" className="size-24 shrink-0" role="img" aria-label={slide.ringLabel}>
          <circle cx="48" cy="48" r={RING_RADIUS} fill="none" strokeWidth="10" className="stroke-muted" />
          <circle
            cx="48"
            cy="48"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${RING_CIRCUMFERENCE}`}
            transform="rotate(-90 48 48)"
            className="stroke-chart-5 motion-safe:animate-ring-draw"
          />
          <text x="48" y="47" textAnchor="middle" className="fill-foreground font-heading text-[22px] font-extrabold">
            {slide.value}
          </text>
          <text x="48" y="64" textAnchor="middle" className="fill-muted-foreground text-[11px]">
            z {slide.goal} {slide.unit}
          </text>
        </svg>
        <div className="min-w-0 space-y-1">
          <p className="font-heading text-lg font-bold">{slide.headline}</p>
          <p className="text-sm text-muted-foreground">{slide.detail}</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex text-xs text-muted-foreground">
          <span>Za celé studium</span>
          <span className="ml-auto tabular-nums">
            <b className="text-foreground">{slide.value}</b> / {slide.studyTotal}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Za celé studium"
          aria-valuemin={0}
          aria-valuemax={slide.studyTotal}
          aria-valuenow={slide.value}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-2 rounded-full bg-chart-5 motion-safe:animate-in motion-safe:slide-in-from-left-full motion-safe:duration-700"
            style={{ width: `${percent(slide.value, slide.studyTotal)}%` }}
          />
        </div>
      </div>
    </div>
  );

  if (!details || !detailsLabel) {
    return (
      <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm motion-safe:animate-rise md:p-6">
        <h2 className="text-sm font-bold text-chart-5">{slide.title}</h2>
        {body}
      </section>
    );
  }

  return (
    <details className="group rounded-2xl border bg-card shadow-sm motion-safe:animate-rise">
      <summary className="focus-ring cursor-pointer list-none rounded-2xl p-5 md:p-6 [&::-webkit-details-marker]:hidden">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-sm font-bold text-chart-5">{slide.title}</h2>
          <span className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-chart-5">
            {detailsLabel}
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </span>
        </div>
        {body}
      </summary>
      <div className="border-t px-5 py-4 md:px-6">{details}</div>
    </details>
  );
}
