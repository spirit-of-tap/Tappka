import Link from 'next/link';
import { ArrowRight, CalendarClock, MapPin, Presentation, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { DashboardCardTitle } from '@/components/dashboard/dashboard-card-title';
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

const TIME_ZONE = 'Europe/Prague';

/** Calendar-leaf date in the frame colour, the card's visual anchor. */
function SessionDateTile({ startsAt }: { startsAt: string }) {
  const date = new Date(startsAt);
  const part = (options: Intl.DateTimeFormatOptions) =>
    date.toLocaleDateString('cs-CZ', { ...options, timeZone: TIME_ZONE });

  return (
    <div
      aria-hidden
      className="flex w-18 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl bg-primary/10 py-3 text-primary"
    >
      <span className="text-[11px] font-bold uppercase tracking-widest">
        {part({ weekday: 'short' })}
      </span>
      <span className="font-heading text-2xl font-extrabold leading-none">{part({ day: 'numeric' })}</span>
      <span className="text-[11px]">{part({ month: 'long' })}</span>
    </div>
  );
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
        <DashboardCardTitle>Nejbližší training session</DashboardCardTitle>
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
            className="focus-ring group flex items-start gap-4 rounded-md"
            style={accent.surface}
          >
            <SessionDateTile startsAt={session.starts_at} />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-heading text-lg font-bold leading-snug group-hover:underline underline-offset-4">
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
            </div>
          </Link>
        ) : (
          <DashboardEmptyState
            icon={Presentation}
            tone="bg-chart-5/15 text-chart-5"
            title="Žádná naplánovaná TS"
            description="Tvůj tým zatím nemá další training session. Mrkni, jestli se nedá přidat na cross jiného týmu."
            action={
              <Button asChild variant="secondary" size="sm">
                <Link href={TS_ROUTES.discover}>Objevovat TS</Link>
              </Button>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
