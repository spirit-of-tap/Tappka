import Link from 'next/link';
import type { ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
  /** Quick actions, shown on the right of the greeting. */
  children?: ReactNode;
}

/** Greeting straight on the page; quick actions and the layout settings sit top right. */
export function DashboardHero({ firstName, now, children }: DashboardHeroProps) {
  const weekday = now.toLocaleDateString('cs-CZ', { weekday: 'long', timeZone: TIME_ZONE });
  const greeting = WEEKDAY_GREETINGS[weekday] ?? FALLBACK_GREETING;
  const date = now.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TIME_ZONE });

  return (
    <section className="relative flex flex-wrap items-end gap-x-6 gap-y-4 motion-safe:animate-rise">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{date}</p>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
          <span className="mr-2 font-quote text-xl font-normal tracking-normal text-primary sm:text-2xl">{greeting},</span>
          {firstName ? `${firstName}!` : 'vítej!'}
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <Button asChild variant="outline" size="icon" className="absolute top-0 right-0 rounded-full sm:static">
          <Link href={SETTINGS_ROUTES.dashboard} aria-label="Upravit dashboard" title="Upravit dashboard">
            <SlidersHorizontal className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}
