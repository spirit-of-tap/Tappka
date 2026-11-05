import Link from 'next/link';
import { ArrowRight, CalendarClock, MapPin, Presentation, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TS_ROUTES } from '@/lib/training-sessions/constants';
import {
  formatDayHeading,
  formatTimeRange,
  teamAccentStyles,
} from '@/lib/training-sessions/format';

export interface DashboardTrainingSession {
  id: string;
  topic: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  team: { name: string; color: string | null } | null;
  facilitators: { profile: { name: string | null } | null }[];
  isCross: boolean;
}

interface NextTrainingSessionCardProps {
  session: DashboardTrainingSession | null;
}

export function NextTrainingSessionCard({ session }: NextTrainingSessionCardProps) {
  const accent = teamAccentStyles(session?.team?.color);
  const facilitatorNames = session
    ? session.facilitators.flatMap((f) => (f.profile?.name ? [f.profile.name] : []))
    : [];

  return (
    <Card className="relative h-full overflow-hidden">
      {session && (
        <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={accent.stripe} />
      )}
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Presentation className="size-4 text-muted-foreground" />
          Nejbližší training session
        </CardTitle>
        <CardAction>
          <Link
            href={TS_ROUTES.overview}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline underline-offset-4"
          >
            Všechny TS
            <ArrowRight className="size-3.5" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {session ? (
          <Link
            href={TS_ROUTES.detail(session.id)}
            className="focus-ring group block space-y-2.5 rounded-md"
            style={accent.surface}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-medium group-hover:underline underline-offset-4">
                {session.topic}
              </p>
              {session.isCross && <Badge variant="secondary">Cross</Badge>}
            </div>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarClock className="size-3.5 shrink-0" aria-hidden />
              <span>
                <span className="font-medium text-foreground">
                  {formatDayHeading(session.starts_at)}
                </span>{' '}
                · {formatTimeRange(session.starts_at, session.ends_at)}
              </span>
            </p>
            {(session.team || session.location) && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {session.team ? (
                  <Users className="size-3.5 shrink-0" aria-hidden />
                ) : (
                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                )}
                <span>
                  {[session.team?.name, session.location].filter(Boolean).join(' · ')}
                </span>
              </p>
            )}
            {facilitatorNames.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Facilitace: {facilitatorNames.join(', ')}
              </p>
            )}
          </Link>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">
              Nemáš naplánovanou žádnou training session.
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link href={TS_ROUTES.discover}>Objevovat TS</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
