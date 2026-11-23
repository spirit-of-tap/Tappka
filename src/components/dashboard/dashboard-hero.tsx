import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import { formatPoints, pointsLabel } from '@/lib/books/points';
import { SETTINGS_ROUTES } from '@/lib/settings/sections';
import { cn } from '@/lib/utils';

const TIME_ZONE = 'Europe/Prague';

/** Keyed by the cs-CZ weekday name; the adjective agrees with each day's gender. */
const WEEKDAY_GREETINGS: Record<string, string> = {
  pondělí: 'Hezké pondělí',
  úterý: 'Hezké úterý',
  středa: 'Hezkou středu',
  čtvrtek: 'Hezký čtvrtek',
  pátek: 'Hezký pátek',
  sobota: 'Hezkou sobotu',
  neděle: 'Hezkou neděli',
};
const FALLBACK_GREETING = 'Hezký den';

interface DashboardHeroProps {
  firstName: string;
  now: Date;
  bookPoints: number | null;
  upcomingReservations: number;
  unreadEssays: number | null;
  /** Quick actions, rendered under the greeting. */
  children?: ReactNode;
}

const STAT_LINK = 'focus-ring rounded-sm font-semibold underline-offset-4 hover:underline';

function reservationLabel(n: number): string {
  if (n === 1) return 'nadcházející rezervaci';
  return n >= 2 && n <= 4 ? 'nadcházející rezervace' : 'nadcházejících rezervací';
}

function essayLabel(n: number): string {
  if (n === 1) return 'esej týmu ke kontrole';
  return n >= 2 && n <= 4 ? 'eseje týmu ke kontrole' : 'esejí týmu ke kontrole';
}

/**
 * Greeting straight on the page (no card) with the key numbers in one
 * sentence; each number links to its page. Quick actions go below it.
 */
export function DashboardHero({
  firstName,
  now,
  bookPoints,
  upcomingReservations,
  unreadEssays,
  children,
}: DashboardHeroProps) {
  const weekday = now.toLocaleDateString('cs-CZ', { weekday: 'long', timeZone: TIME_ZONE });
  const greeting = WEEKDAY_GREETINGS[weekday] ?? FALLBACK_GREETING;

  const stats: ReactNode[] = [];
  if (bookPoints !== null) {
    stats.push(
      <Link key="points" href="/cteni/prehled" className={cn(STAT_LINK, 'text-chart-5')}>
        {formatPoints(bookPoints)} {pointsLabel(bookPoints) === 'bodů' ? 'knižních' : 'knižní'} {pointsLabel(bookPoints)}
      </Link>,
    );
  }
  stats.push(
    <Link key="reservations" href="/reservations" className={cn(STAT_LINK, 'text-chart-3-strong')}>
      {upcomingReservations} {reservationLabel(upcomingReservations)}
    </Link>,
  );
  if (unreadEssays !== null) {
    stats.push(
      unreadEssays > 0 ? (
        <Link key="essays" href="/cteni/eseje/ke-kontrole" className={cn(STAT_LINK, 'text-primary')}>
          {unreadEssays} {essayLabel(unreadEssays)}
        </Link>
      ) : (
        <Link key="essays" href="/cteni/eseje/ke-kontrole" className={cn(STAT_LINK, 'text-success-strong')}>
          eseje týmu přečtené
        </Link>
      ),
    );
  }

  return (
    <section className="flex flex-col gap-4 pt-2">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="font-quote text-lg text-primary">{greeting},</p>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
            {firstName ? `Vítej, ${firstName}!` : 'Vítej!'}
          </h1>
        </div>
        <Link
          href={SETTINGS_ROUTES.dashboard}
          className="focus-ring ml-auto inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground hover:text-foreground"
        >
          <SlidersHorizontal className="size-3.5" aria-hidden />
          Upravit
        </Link>
      </div>
      <p className="text-base text-muted-foreground">
        {now.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TIME_ZONE })}
        {' · Máš '}
        {stats.map((stat, i) => (
          <Fragment key={i}>
            {i > 0 && (i === stats.length - 1 ? ' a ' : ', ')}
            {stat}
          </Fragment>
        ))}
        .
      </p>
      {children}
    </section>
  );
}
