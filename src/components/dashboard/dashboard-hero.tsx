import Link from 'next/link';
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
}

const TILE =
  'focus-ring flex min-w-32 flex-col gap-1 rounded-2xl px-4 py-3 transition-[filter] hover:brightness-95 dark:hover:brightness-125';

function reservationLabel(n: number): string {
  if (n === 1) return 'rezervace';
  return n >= 2 && n <= 4 ? 'rezervace' : 'rezervací';
}

function essayLabel(n: number): string {
  if (n === 1) return 'esej ke kontrole';
  return n >= 2 && n <= 4 ? 'eseje ke kontrole' : 'esejí ke kontrole';
}

/** Greeting card with the key numbers as tinted tiles that link to their pages. */
export function DashboardHero({
  firstName,
  now,
  bookPoints,
  upcomingReservations,
  unreadEssays,
}: DashboardHeroProps) {
  const weekday = now.toLocaleDateString('cs-CZ', { weekday: 'long', timeZone: TIME_ZONE });
  const greeting = WEEKDAY_GREETINGS[weekday] ?? FALLBACK_GREETING;

  return (
    <section className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-3xl border bg-card p-5 md:p-6">
      <div className="min-w-0 flex-1 basis-60">
        <p className="font-quote text-lg text-primary">{greeting},</p>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
          {firstName ? `Vítej, ${firstName}!` : 'Vítej!'}
        </h1>
        <p className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
          {now.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', timeZone: TIME_ZONE })}
          <Link
            href={SETTINGS_ROUTES.dashboard}
            className="focus-ring inline-flex items-center gap-1 rounded-md hover:text-foreground"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden />
            Upravit
          </Link>
        </p>
      </div>

      <ul className="flex flex-wrap gap-3">
        {bookPoints !== null && (
          <li>
            <Link href="/cteni/prehled" className={cn(TILE, 'bg-chart-5/15 text-chart-5')}>
              <b className="font-heading text-3xl leading-none font-extrabold">{formatPoints(bookPoints)}</b>
              <span className="text-sm font-medium">
                {pointsLabel(bookPoints) === 'bodů' ? 'knižních' : 'knižní'} {pointsLabel(bookPoints)}
              </span>
            </Link>
          </li>
        )}
        <li>
          <Link href="/reservations" className={cn(TILE, 'bg-chart-3/15 text-chart-3-strong')}>
            <b className="font-heading text-3xl leading-none font-extrabold">{upcomingReservations}</b>
            <span className="text-sm font-medium">{reservationLabel(upcomingReservations)}</span>
          </Link>
        </li>
        {unreadEssays !== null && (
          <li>
            <Link
              href="/cteni/eseje/ke-kontrole"
              className={cn(TILE, unreadEssays > 0 ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success-strong')}
            >
              <b className="font-heading text-3xl leading-none font-extrabold">{unreadEssays}</b>
              <span className="text-sm font-medium">
                {unreadEssays > 0 ? essayLabel(unreadEssays) : 'vše přečteno'}
              </span>
            </Link>
          </li>
        )}
      </ul>
    </section>
  );
}
