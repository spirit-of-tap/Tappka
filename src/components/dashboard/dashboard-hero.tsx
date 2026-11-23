import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';

import { formatPointsWithLabel } from '@/lib/books/points';
import { SETTINGS_ROUTES } from '@/lib/settings/sections';

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

function reservationLabel(n: number): string {
  return n >= 1 && n <= 4 ? 'rezervace' : 'rezervací';
}

/**
 * Greeting and key numbers in the brown frame colour. Bleeds over the sheet's
 * padding and ends with a rounded cream corner, so on desktop it reads as part
 * of the frame and the sheet appears to start below it. The (main) layout
 * drops the sheet's own corner while [data-frame-hero] is present.
 */
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
    <div data-frame-hero className="-mx-4 -mt-4 -mb-2 bg-sidebar">
      <div data-surface="frame" className="flex text-foreground flex-wrap items-end gap-x-6 gap-y-4 px-4 pt-6 pb-6 md:px-6 md:pt-4">
        <div className="min-w-0">
          <p className="font-quote text-lg text-primary">{greeting},</p>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
            {firstName ? `Vítej, ${firstName}!` : 'Vítej!'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {now.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', timeZone: TIME_ZONE })}
          </p>
        </div>

        <ul className="flex flex-wrap gap-2 text-sm">
          {bookPoints !== null && (
            <li className="flex h-8 items-center gap-1.5 rounded-full bg-accent px-3">
              <b className="font-heading">{formatPointsWithLabel(bookPoints)}</b>
            </li>
          )}
          <li className="flex h-8 items-center gap-1.5 rounded-full bg-accent px-3">
            <b className="font-heading">{upcomingReservations}</b> {reservationLabel(upcomingReservations)}
          </li>
          {unreadEssays !== null && (
            <li className="flex h-8 items-center gap-1.5 rounded-full bg-primary/20 px-3">
              <b className="font-heading">{unreadEssays}</b> ke kontrole
            </li>
          )}
        </ul>

        <Link
          href={SETTINGS_ROUTES.dashboard}
          className="focus-ring ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Upravit
        </Link>
      </div>
      <div aria-hidden className="h-7 rounded-tl-[28px] bg-background" />
    </div>
  );
}
