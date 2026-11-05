import { ProfileAvatar } from '@/components/profile-avatar';
import { formatPoints } from '@/lib/books/points';
import { shortName } from '@/lib/string-utils';
import { cn } from '@/lib/utils';

interface MemberStats {
  profile: { id: string; name: string; picture: string | null };
  approved_points: number;
  pending_points: number;
}

interface TeamPointsRankingProps {
  stats: MemberStats[];
  /** Points everyone works toward; bars are drawn against this. */
  goal: number;
  currentProfileId?: string;
}

/**
 * Compact team standings revealed under the Moje progress bar: one row per
 * member, sorted by total, with an approved/pending bar against the study
 * goal. The full chart lives on the team detail page.
 */
export function TeamPointsRanking({ stats, goal, currentProfileId }: TeamPointsRankingProps) {
  if (stats.length === 0) {
    return <p className="text-sm text-muted-foreground">Tým zatím nemá žádné členy:ky.</p>;
  }

  const rows = [...stats].sort(
    (a, b) => b.approved_points + b.pending_points - (a.approved_points + a.pending_points),
  );
  const scale = Math.max(goal, ...rows.map((r) => r.approved_points + r.pending_points));
  const pct = (value: number) => `${Math.min(100, (value / scale) * 100)}%`;

  return (
    <ol className="space-y-1">
      {rows.map((row, index) => {
        const isMe = row.profile.id === currentProfileId;

        return (
          <li
            key={row.profile.id}
            className={cn('flex items-center gap-3 rounded-md px-2 py-1.5', isMe && 'bg-accent')}
          >
            <span className="w-4 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {index + 1}.
            </span>
            <ProfileAvatar picture={row.profile.picture} name={row.profile.name} size={24} />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className={cn('truncate', isMe ? 'font-semibold' : 'text-muted-foreground')}>
                  {isMe ? 'Ty' : shortName(row.profile.name)}
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold">{formatPoints(row.approved_points)}</span>
                  {row.pending_points > 0 && (
                    <span className="text-muted-foreground"> +{formatPoints(row.pending_points)}</span>
                  )}
                </span>
              </div>
              <div
                className="flex h-1.5 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`${formatPoints(row.approved_points)} schválených a ${formatPoints(row.pending_points)} čekajících bodů z ${goal}`}
              >
                <div className="bg-primary" style={{ width: pct(row.approved_points) }} />
                <div className="bg-primary/30" style={{ width: pct(row.pending_points) }} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
