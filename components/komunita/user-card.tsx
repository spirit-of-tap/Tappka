'use client';

import Link from 'next/link';
import { Mail, Phone, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { ProfileWithTeam } from '@/lib/komunita/types';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/komunita/types';
import { cn } from '@/lib/utils';

interface UserCardProps {
  profile: ProfileWithTeam;
  pictureUrl: string | null;
}

/**
 * Get user initials from name
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function UserCard({ profile, pictureUrl }: UserCardProps) {
  return (
    <Link href={`/komunita/profil/${profile.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-4 space-y-3">
          {/* Avatar and Name */}
          <div className="flex items-start gap-4">
            {/* Avatar with team-colored border */}
            <div
              className={cn(
                'rounded-full ring-4 transition-all',
                profile.team?.color ? '' : 'ring-border'
              )}
              style={
                profile.team?.color
                  ? ({ '--tw-ring-color': profile.team.color } as React.CSSProperties)
                  : undefined
              }
            >
              <Avatar size="xl">
                <AvatarImage src={pictureUrl || undefined} alt={profile.name} />
                <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base truncate">{profile.name}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn('text-xs', ROLE_COLORS[profile.role])}
                >
                  {ROLE_LABELS[profile.role]}
                </Badge>
                {profile.team && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="size-3" />
                    <span className="truncate">{profile.team.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-3.5 shrink-0" />
              <span className="truncate">{profile.work_email}</span>
            </div>
            {profile.phone_number && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="size-3.5 shrink-0" />
                <span className="truncate">{profile.phone_number}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
