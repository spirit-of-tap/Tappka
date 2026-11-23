import Link from 'next/link';
import { ArrowRight, Tag } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { isMelvilDiscountLive } from '@/lib/books/melvil-discount';
import {
  CTENI_DISCOVER_HREF,
  MELVIL_DISCOUNT,
  teamBookPointsHref,
} from '@/lib/constants/cteni';

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
        <DashboardCardTitle className="text-chart-2-strong">{teamName ? `Tým ${teamName}` : 'Tým'}</DashboardCardTitle>
        <CardDescription>Nejlepší čtenáři:ky podle knižních bodů</CardDescription>
        {teamId && (
          <CardAction>
            <Link
              href={teamBookPointsHref(teamId)}
              className="inline-flex items-center gap-1 text-sm font-medium text-chart-2-strong hover:underline underline-offset-4"
            >
              Celý tým
              <ArrowRight className="size-3.5" />
            </Link>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        {!hasTeam ? (
          <p className="text-sm text-muted-foreground">Nemáš přiřazený tým.</p>
        ) : podium.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tým zatím nemá žádné body.</p>
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
                  style={{ height: `${PODIUM_HEIGHT[place]}px`, animationDelay: `${i * 90}ms` }}
                  className={cn(
                    'flex w-full origin-bottom items-start justify-center rounded-t-xl rounded-b-sm pt-2 font-heading text-sm font-bold tabular-nums motion-safe:animate-bar-grow',
                    place === 1 ? 'bg-chart-2 text-card' : 'bg-chart-2/15 text-chart-2-strong',
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
            className="focus-ring group flex w-full items-center gap-3 rounded-xl bg-chart-2/10 px-3 py-2.5 transition-colors hover:bg-chart-2/15"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-chart-2/20 text-chart-2-strong">
              <Tag className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <span className="font-medium">{MELVIL_DISCOUNT.percent} % na knihy od Melvilu</span>
              <span className="block text-xs text-muted-foreground">Zadej kód při objednávce</span>
            </span>
            <code className="rounded-md border border-dashed border-chart-2-strong/40 px-2 py-1 font-mono text-xs font-bold tracking-wider text-chart-2-strong">
              {MELVIL_DISCOUNT.code}
            </code>
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}
