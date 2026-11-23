import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

import { ProgressRing, progressPercent } from '@/components/ui/progress-ring';
import { bookPointsSlide, type BookStats } from '@/lib/dashboard/progress-slides';
import { currentStudySemester } from '@/lib/metrics/semester-milestone';

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

  const body = (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <ProgressRing
          percent={progressPercent(slide.value, slide.goal)}
          strokeClassName="stroke-chart-5"
          role="img"
          aria-label={slide.ringLabel}
        >
          <text x="48" y="47" textAnchor="middle" className="fill-foreground font-heading text-[22px] font-extrabold">
            {slide.value}
          </text>
          <text x="48" y="64" textAnchor="middle" className="fill-muted-foreground text-[11px]">
            z {slide.goal} {slide.unit}
          </text>
        </ProgressRing>
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
            style={{ width: `${progressPercent(slide.value, slide.studyTotal)}%` }}
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
    <section className="rounded-2xl border bg-card shadow-sm motion-safe:animate-rise">
      <div className="space-y-4 p-5 md:p-6">
        <h2 className="text-sm font-bold text-chart-5">{slide.title}</h2>
        {body}
      </div>
      <details className="group border-t">
        <summary className="focus-ring flex cursor-pointer list-none items-center gap-1 px-5 py-3 text-sm font-medium text-chart-5 md:px-6 [&::-webkit-details-marker]:hidden">
          {detailsLabel}
          <ChevronDown className="size-4 motion-safe:transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="border-t px-5 py-4 md:px-6">{details}</div>
      </details>
    </section>
  );
}
