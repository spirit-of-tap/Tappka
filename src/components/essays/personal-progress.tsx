import { cn } from '@/lib/utils';
import { BOOK_POINTS_GOAL } from '@/lib/books/types';

interface PersonalProgressProps {
  approved_points: number;
  pending_points: number;
}

const MILESTONES = [20, 40, 60, 80, 100, 120];

const MILESTONE_LABELS: Record<number, string> = {
  20: 'Rok 1 · 1. pol.',
  40: 'Rok 1 · 2. pol.',
  60: 'Rok 2 · 1. pol.',
  80: 'Rok 2 · 2. pol.',
  100: 'Rok 3 · 1. pol.',
  120: 'Rok 3 · 2. pol.',
};

export function PersonalProgress({ approved_points, pending_points }: PersonalProgressProps) {
  const pct = Math.min(100, (approved_points / BOOK_POINTS_GOAL) * 100);
  const pendingPct = Math.min(100 - pct, (pending_points / BOOK_POINTS_GOAL) * 100);
  const next = MILESTONES.find((m) => approved_points < m);

  return (
    <div className="space-y-1.5 py-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium tabular-nums text-foreground">
          {approved_points}
          <span className="font-normal text-muted-foreground"> / {BOOK_POINTS_GOAL} b.</span>
        </span>
        <span>
          {next
            ? `${MILESTONE_LABELS[next]} · ještě ${next - approved_points} b.`
            : 'Cíl splněn! 🎉'}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
        {pendingPct > 0 && (
          <div
            className="absolute inset-y-0 bg-primary/30 transition-all duration-700"
            style={{ left: `${pct}%`, width: `${pendingPct}%` }}
          />
        )}
        {MILESTONES.slice(0, -1).map((m) => (
          <div
            key={m}
            className={cn(
              'absolute top-0 bottom-0 w-px',
              approved_points >= m ? 'bg-background/40' : 'bg-background/50',
            )}
            style={{ left: `${(m / BOOK_POINTS_GOAL) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}
