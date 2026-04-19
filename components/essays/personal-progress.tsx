import { CheckCircle2 } from 'lucide-react';
import { BOOK_POINTS_GOAL, BOOK_POINTS_PER_YEAR } from '@/lib/books/types';

interface PersonalProgressProps {
  approved_points: number;
  pending_points: number;
}

const milestones = [
  { label: 'Rok 1', threshold: BOOK_POINTS_PER_YEAR },
  { label: 'Rok 2', threshold: BOOK_POINTS_PER_YEAR * 2 },
  { label: 'Rok 3', threshold: BOOK_POINTS_GOAL },
];

export function PersonalProgress({ approved_points, pending_points }: PersonalProgressProps) {
  const next = milestones.find((m) => approved_points < m.threshold);
  const remaining = next ? next.threshold - approved_points : 0;
  const pct = Math.min(100, (approved_points / BOOK_POINTS_GOAL) * 100);
  const pendingPct = Math.min(100 - pct, (pending_points / BOOK_POINTS_GOAL) * 100);

  return (
    <div className="rounded-xl border bg-card p-5 space-y-5">

      {/* Top row: points + next checkpoint */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Tvůj pokrok</p>
          <p className="text-4xl font-bold leading-none">
            {approved_points}
            <span className="text-lg font-normal text-muted-foreground ml-1">/ {BOOK_POINTS_GOAL} b.</span>
          </p>
          {pending_points > 0 && (
            <p className="text-xs text-muted-foreground mt-1.5">+ {pending_points} čeká na schválení</p>
          )}
        </div>
        {next && (
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Další cíl</p>
            <p className="text-2xl font-bold leading-none text-primary">{next.threshold} b.</p>
            <p className="text-xs text-muted-foreground mt-1.5">ještě {remaining} b. do {next.label}</p>
          </div>
        )}
        {!next && (
          <div className="text-right shrink-0">
            <CheckCircle2 className="size-8 text-primary ml-auto" />
            <p className="text-xs text-muted-foreground mt-1">Cíl splněn!</p>
          </div>
        )}
      </div>

      {/* Segmented progress bar */}
      <div className="space-y-1.5">
        <div className="relative h-3 rounded-full bg-muted overflow-hidden flex">
          {/* Filled approved */}
          <div
            className="h-full bg-primary transition-all duration-500 rounded-l-full"
            style={{ width: `${pct}%` }}
          />
          {/* Pending overlay */}
          {pendingPct > 0 && (
            <div
              className="h-full bg-primary/30 transition-all duration-500"
              style={{ width: `${pendingPct}%` }}
            />
          )}
          {/* Segment dividers */}
          {[1, 2].map((i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-background/60"
              style={{ left: `${(i / 3) * 100}%` }}
            />
          ))}
        </div>

        {/* Segment labels */}
        <div className="flex">
          {milestones.map(({ label, threshold }, i) => {
            const done = approved_points >= threshold;
            const isNext = next?.threshold === threshold;
            return (
              <div
                key={label}
                className="flex-1 flex items-center gap-1 text-xs"
                style={{ justifyContent: i === 0 ? 'flex-start' : i === milestones.length - 1 ? 'flex-end' : 'center' }}
              >
                {done ? (
                  <CheckCircle2 className="size-3 text-primary shrink-0" />
                ) : (
                  <div className={`size-3 rounded-full border-2 shrink-0 ${isNext ? 'border-primary' : 'border-muted-foreground/40'}`} />
                )}
                <span className={done ? 'font-medium text-foreground' : isNext ? 'text-primary font-medium' : 'text-muted-foreground'}>
                  {label} · {threshold} b.
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
