import Link from 'next/link';
import { ArrowRight, Tag, Trophy, Users } from 'lucide-react';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { DASHBOARD_SECTION, DashboardCardTitle } from '@/components/dashboard/dashboard-card-title';
import { ProfileAvatar } from '@/components/profile-avatar';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { isMelvilDiscountLive } from '@/lib/books/melvil-discount';
import {
  CTENI_DISCOVER_HREF,
  MELVIL_DISCOUNT,
  teamBookPointsHref,
} from '@/lib/constants/cteni';

const PODIUM_STAGGER_MS = 90;
const PODIUM_HEIGHT = { 1: 88, 2: 64, 3: 48 } as const;
/** DOM stays in rank order for screen readers; the podium shows 2nd · 1st · 3rd. */
const PODIUM_ORDER = { 1: 'order-2', 2: 'order-1', 3: 'order-3' } as const;

interface TeamSnapshotCardProps {
  stats: {
    profile: { id: string; name: string; picture: string | null };
    approved_points: number;
    pending_points: number;
  }[];
  hasTeam: boolean;
  teamId?: string | null;
  teamName?: string | null;
}

export function TeamSnapshotCard({ stats, hasTeam, teamId, teamName }: TeamSnapshotCardProps) {
  const top = [...stats].sort((a, b) => b.approved_points - a.approved_points).slice(0, 3);
  const podium = top.map((row, i) => ({ row, place: (i + 1) as 1 | 2 | 3 }));

  return (
    <Card className={DASHBOARD_SECTION}>
      <CardHeader>
        <DashboardCardTitle className="text-foreground">{teamName ? `Tým ${teamName}` : 'Tým'}</DashboardCardTitle>
        <CardDescription>Nejlepší čtenáři:ky podle knižních bodů</CardDescription>
        {teamId && (
          <CardAction>
            <Link
              href={teamBookPointsHref(teamId)}
              className="focus-ring inline-flex items-center gap-1 rounded-sm text-sm font-medium hover:underline underline-offset-4"
            >
              Celý tým
              <ArrowRight className="size-3.5" />
            </Link>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        {!hasTeam ? (
          <Empty className="p-4 md:p-4">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-chart-4/15">
                <Users aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-base">Nemáš přiřazený tým</EmptyTitle>
              <EmptyDescription>Pořadí týmu se tu ukáže, jakmile tě někdo přiřadí.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : podium.length === 0 ? (
          <Empty className="p-4 md:p-4">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-chart-4/15">
                <Trophy aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-base">Tým zatím nemá žádné body</EmptyTitle>
              <EmptyDescription>Po schválení první knihy se tu objeví pořadí.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ol aria-label="Pořadí podle knižních bodů" className="flex h-40 items-end justify-center gap-3">
            {podium.map(({ row, place }, i) => (
              <li key={row.profile.id} className={cn('flex w-20 min-w-0 flex-col items-center gap-1.5', PODIUM_ORDER[place])}>
                <Link
                  href={`/komunita/profil/${row.profile.id}`}
                  className="focus-ring group flex min-w-0 flex-col items-center gap-1 rounded-md"
                >
                  <ProfileAvatar picture={row.profile.picture} name={row.profile.name} size={place === 1 ? 36 : 30} />
                  <span className="max-w-20 truncate text-xs group-hover:underline underline-offset-4">
                    {row.profile.name}
                  </span>
                </Link>
                <span
                  style={{ height: `${PODIUM_HEIGHT[place]}px`, animationDelay: `${i * PODIUM_STAGGER_MS}ms` }}
                  className={cn(
                    'flex w-full origin-bottom items-start justify-center rounded-t-xl rounded-b-sm pt-2 font-heading text-sm font-bold tabular-nums motion-safe:animate-bar-grow',
                    place === 1 ? 'bg-chart-4/30 text-foreground' : 'bg-chart-4/10 text-foreground',
                  )}
                >
                  <span className="sr-only">{place}. místo, </span>
                  {row.approved_points} b.
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
      {isMelvilDiscountLive(new Date()) && (
        <CardFooter className="mt-auto">
          <Link
            href={CTENI_DISCOVER_HREF}
            className="focus-ring group flex w-full items-center gap-3 rounded-xl bg-chart-4/10 px-3 py-2.5 motion-safe:transition-colors hover:bg-chart-4/15"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-chart-4/20 text-foreground">
              <Tag className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <span className="font-medium">{MELVIL_DISCOUNT.percent} % na knihy od Melvilu</span>
              <span className="block text-xs text-muted-foreground">Zadej kód při objednávce</span>
            </span>
            <code className="rounded-md border border-dashed border-chart-4/60 px-2 py-1 font-mono text-xs font-bold tracking-wider">
              {MELVIL_DISCOUNT.code}
            </code>
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}
