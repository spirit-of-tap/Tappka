import { Sparkles } from 'lucide-react';
import { COACH_POINT_VALUES, formatPointsWithLabel, suggestedReviewPoints } from '@/lib/books/points';
import { cn } from '@/lib/utils';

interface AiVerdictCardProps {
  /** `books.book_points` — a numeric column, so PostgREST may hand it over as a string. */
  points: number | string | null;
  /** `books.list_status_reason`, which holds the AI's rationale until a coach decides. */
  reason: string | null;
  className?: string;
}

/**
 * The AI's suggestion, read-only. A coach either confirms it as-is or switches to
 * editing — so this never appears alongside an input carrying the same text.
 */
export function AiVerdictCard({ points, reason, className }: AiVerdictCardProps) {
  const suggested = suggestedReviewPoints(points);
  if (suggested === null && !reason?.trim()) return null;

  const isRejection = suggested === 0;

  return (
    <div
      className={cn(
        'rounded-lg border p-4 space-y-2.5',
        isRejection ? 'border-destructive/20 bg-destructive/5' : 'border-primary/15 bg-primary/5',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide',
            isRejection ? 'text-destructive' : 'text-primary',
          )}
        >
          <Sparkles className="size-3.5" />
          Návrh AI
        </span>
        {suggested !== null && (
          <span className="flex items-center gap-2">
            <span aria-hidden className="flex items-center gap-1">
              {COACH_POINT_VALUES.map((value) => (
                <span
                  key={value}
                  className={cn(
                    'h-1.5 w-5 rounded-full',
                    value <= suggested ? 'bg-primary' : 'bg-foreground/10',
                  )}
                />
              ))}
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {formatPointsWithLabel(suggested)}
            </span>
            {isRejection && (
              <span className="text-xs font-medium text-destructive">— zamítnout</span>
            )}
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
