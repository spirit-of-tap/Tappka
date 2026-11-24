import { cn } from '@/lib/utils';
import { formatPoints, pointsLabel } from '@/lib/books/points';
import { bookPointsSlide, type BookStats } from '@/lib/dashboard/progress-slides';
import {
  buildPathMilestones,
  buildReadingPath,
  daysLeftInSemester,
  daysLeftLabel,
  labelAlign,
  pickLabeledMilestones,
  readingSummary,
  type LabelAlign,
} from '@/lib/essays/reading-path';
import type { EssayWithDetails } from '@/lib/essays/types';
import { currentStudySemester } from '@/lib/metrics/semester-milestone';

interface ReadingPathHeroProps {
  stats: BookStats;
  essays: EssayWithDetails[];
  /** Team cohort year; drives which semester the path shows. */
  onboardingYear?: number | null;
}

const LABEL_ALIGN_CLASSES: Record<LabelAlign, string> = {
  start: '',
  center: '-translate-x-1/2',
  end: '-translate-x-full',
};

/** Dark hero: book points on the way through the semester, one dot per credited essay. */
export function ReadingPathHero({ stats, essays, onboardingYear }: ReadingPathHeroProps) {
  const now = new Date();
  const semester = currentStudySemester(now, onboardingYear);
  const slide = bookPointsSlide(stats, semester);
  const milestones = buildPathMilestones(essays, slide.goal);
  const path = buildReadingPath(slide.value, stats.pending_points, slide.goal);
  const labeled = pickLabeledMilestones(milestones.map((m) => m.position));

  return (
    <section
      aria-labelledby="reading-path-heading"
      className="rounded-3xl bg-hero p-5 text-hero-foreground motion-safe:animate-rise sm:p-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="space-y-1">
          <h2
            id="reading-path-heading"
            className="text-xs font-semibold uppercase tracking-wider text-hero-muted"
          >
            Cesta {semester}. semestrem
          </h2>
          <p className="font-heading text-4xl font-extrabold tabular-nums sm:text-5xl">
            {formatPoints(slide.value)}{' '}
            <span className="text-lg font-bold text-hero-muted sm:text-xl">
              z {slide.goal} {pointsLabel(slide.goal)}
            </span>
          </p>
        </div>
        <div className="space-y-1 text-sm text-hero-muted sm:text-right">
          {path.goalReached && (
            <p className="inline-block rounded-full bg-hero-foreground/10 px-2.5 py-0.5 text-xs font-semibold text-hero-success">
              Cíl splněn
            </p>
          )}
          <p>
            Za celé studium{' '}
            <span className="font-semibold tabular-nums text-hero-foreground">
              {formatPoints(slide.value)} / {slide.studyTotal}
            </span>
          </p>
          <p>{daysLeftLabel(daysLeftInSemester(now))}</p>
        </div>
      </div>

      <div aria-hidden="true" className="relative mx-2 mb-12 mt-12 h-5">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-hero-foreground/20" />
        <div
          className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-hero-success motion-safe:animate-in motion-safe:slide-in-from-left-full motion-safe:duration-700"
          style={{ width: `${path.fillPercent}%` }}
        />

        {milestones.map((milestone, index) => (
          <div key={milestone.id}>
            <span
              className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-hero-foreground ring-2 ring-hero"
              style={{ left: `${milestone.position}%` }}
            />
            {labeled.has(index) && (
              <span
                className={cn(
                  'absolute bottom-full mb-1.5 max-w-16 truncate text-xs text-hero-muted sm:max-w-28',
                  LABEL_ALIGN_CLASSES[labelAlign(milestone.position)],
                )}
                style={{ left: `${milestone.position}%` }}
              >
                {milestone.title}
              </span>
            )}
          </div>
        ))}

        {path.pending && (
          <div>
            <span
              className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-hero-muted bg-hero"
              style={{ left: `${path.pending.position}%` }}
            />
            {path.pending.showLabel && (
              <span
                className={cn(
                  'absolute top-full mt-2 whitespace-nowrap text-xs text-hero-muted',
                  LABEL_ALIGN_CLASSES[labelAlign(path.pending.position)],
                )}
                style={{ left: `${path.pending.position}%` }}
              >
                +{path.pending.count} čeká
              </span>
            )}
          </div>
        )}

        <span
          className={cn(
            'absolute right-0 top-1/2 size-5 translate-x-1/2 -translate-y-1/2 rounded-full border-2',
            path.goalReached ? 'border-hero-success bg-hero-success' : 'border-hero-muted bg-hero',
          )}
        />
        <span className="absolute right-0 top-full mt-2 whitespace-nowrap text-xs font-semibold text-hero-foreground">
          {slide.goal} · cíl semestru
        </span>
      </div>

      {(milestones.length > 0 || path.pending) && (
        <ol className="sr-only" aria-label="Milníky semestru">
          {milestones.map((milestone) => (
            <li key={milestone.id}>
              {milestone.title}: {formatPoints(milestone.points)} {pointsLabel(milestone.points)}, celkem{' '}
              {formatPoints(milestone.cumulative)} z {slide.goal}
            </li>
          ))}
          {path.pending && <li>+{path.pending.count} čeká na schválení</li>}
        </ol>
      )}

      <p className="text-sm text-hero-muted">{readingSummary(stats)}</p>
    </section>
  );
}
