'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users as UsersIcon, ChevronDown } from 'lucide-react';
import type { TeamWithCount } from '@/lib/komunita/types';
import { cn } from '@/lib/utils';

interface TeamBadgesProps {
  teams: TeamWithCount[];
}

function TeamPill({
  team,
  muted = false,
}: {
  team: TeamWithCount;
  muted?: boolean;
}) {
  return (
    <Link
      href={`/komunita/tymy/${team.id}`}
      className={cn(
        'group inline-flex items-center gap-2 rounded-full border bg-card pl-2.5 pr-1.5 py-1 text-sm transition-colors hover:bg-muted',
        muted && 'opacity-70 hover:opacity-100'
      )}
    >
      {team.color ? (
        <span
          className="size-2.5 rounded-full shrink-0 ring-1 ring-inset ring-black/10"
          style={{ backgroundColor: team.color }}
        />
      ) : (
        <UsersIcon className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="font-medium">{team.name}</span>
      <span
        className={cn(
          'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums',
          muted
            ? 'text-muted-foreground'
            : 'bg-muted text-muted-foreground group-hover:bg-background'
        )}
      >
        {team.member_count}
      </span>
    </Link>
  );
}

export function TeamBadges({ teams }: TeamBadgesProps) {
  const [showAlumni, setShowAlumni] = useState(false);

  if (teams.length === 0) return null;

  const active = teams
    .filter((t) => t.removed_at === null)
    .sort((a, b) => b.member_count - a.member_count);
  const alumni = teams
    .filter((t) => t.removed_at !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-3">
      {active.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {active.map((team) => (
            <TeamPill key={team.id} team={team} />
          ))}
        </div>
      )}

      {alumni.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowAlumni((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                'size-3.5 transition-transform',
                showAlumni && 'rotate-180'
              )}
            />
            Staré týmy
            <span className="text-muted-foreground/70">({alumni.length})</span>
          </button>

          {showAlumni && (
            <div className="flex flex-wrap gap-2">
              {alumni.map((team) => (
                <TeamPill key={team.id} team={team} muted />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
