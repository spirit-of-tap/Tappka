'use client';

import Link from 'next/link';
import { Users, UserCheck, UserX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StorageAvatar } from '@/components/storage/storage-avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ProfileWithTeam } from '@/lib/komunita/types';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/komunita/types';
import { cn } from '@/lib/utils';

interface UserCardProps {
  profile: ProfileWithTeam;
  pictureUrl: string | null;
  from?: string;
}

export function UserCard({ profile, pictureUrl, from }: UserCardProps) {
  const href = from
    ? `/komunita/profil/${profile.id}?from=${encodeURIComponent(from)}`
    : `/komunita/profil/${profile.id}`;

  return (
    <Link href={href} className="group focus-ring rounded-xl">
      <Card className="h-full py-0 border-border/60 shadow-none transition-colors group-hover:border-border group-hover:bg-muted/40">
        <CardContent className="flex items-center gap-3 p-3">
          {/* Avatar with team-colored ring */}
          <div
            className={cn(
              'rounded-full ring-2 transition-all',
              profile.team?.color ? '' : 'ring-border'
            )}
            style={
              profile.team?.color
                ? ({ '--tw-ring-color': profile.team.color } as React.CSSProperties)
                : undefined
            }
          >
            <StorageAvatar
              storageKey={pictureUrl}
              name={profile.name}
              size="default"
              className="size-12"
            />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-semibold text-sm leading-tight">
                {profile.name}
              </h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  {profile.user_id ? (
                    <UserCheck className="size-3.5 text-green-500 shrink-0" />
                  ) : (
                    <UserX className="size-3.5 text-muted-foreground/60 shrink-0" />
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {profile.user_id ? 'V portálu' : 'Není v portálu'}
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <Badge
                variant="outline"
                className={cn('text-[11px] px-1.5 py-0 font-medium shrink-0', ROLE_COLORS[profile.role])}
              >
                {ROLE_LABELS[profile.role]}
              </Badge>
              {profile.team && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                  <Users className="size-3 shrink-0" />
                  <span className="truncate">{profile.team.name}</span>
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
