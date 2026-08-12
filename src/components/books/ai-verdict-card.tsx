import { Sparkles } from 'lucide-react';
import { COACH_POINT_VALUES, formatPointsWithLabel, suggestedBookPoints } from '@/lib/books/points';
import { cn } from '@/lib/utils';

interface AiVerdictCardProps {
  /** `books.book_points` — a numeric column, so PostgREST hands it over as a string. */
  points: number | string | null;
  /** `books.list_status_reason`, which holds the AI's rationale until a coach decides. */
  reason: string | null;
}

/**
 * The AI's suggestion, shown read-only. It exists so the coach can see what was
 * proposed and why before overriding it — previously both values reached this
 * screen and neither was rendered.
 */
export function AiVerdictCard({ points, reason }: AiVerdictCardProps) {
  const hasPoints = points !== null && points !== undefined && Number(points) > 0;
  if (!hasPoints && !reason?.trim()) return null;

  const filled = suggestedBookPoints(points);

  return (
    <div className="rounded-lg border border-primary/15 bg-primary/5 p-4 space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
          <Sparkles className="size-3.5" />
          Návrh AI
        </span>
        {hasPoints && (
          <span className="flex items-center gap-2">
            <span aria-hidden className="flex items-center gap-1">
              {COACH_POINT_VALUES.map((value) => (
                <span
                  key={value}
                  className={cn(
                    'h-1.5 w-5 rounded-full',
                    value <= filled ? 'bg-primary' : 'bg-primary/20',
                  )}
                />
              ))}
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {formatPointsWithLabel(points)}
            </span>
          </span>
        )}
      </div>
      {reason?.trim() && (
        <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-foreground/80">
          {reason}
        </p>
      )}
    </div>
  );
}
