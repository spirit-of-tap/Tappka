import Link from 'next/link';
import { ArrowRight, Presentation } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TS_ROUTES } from '@/lib/training-sessions/constants';
import { formatDayHeading, formatTimeRange } from '@/lib/training-sessions/format';

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
  now?: Date;
}

const TIME_ZONE = 'Europe/Prague';
const DAY_MS = 86_400_000;

const HERO = 'relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl bg-hero p-5 text-hero-foreground md:p-6';

function pragueDayIndex(date: Date): number {
  const [y, m, d] = date.toLocaleDateString('sv-SE', { timeZone: TIME_ZONE }).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

function untilLabel(startsAt: string, now: Date): string {
  const days = pragueDayIndex(new Date(startsAt)) - pragueDayIndex(now);
  if (days <= 0) return 'dnes';
  if (days === 1) return 'zítra';
  return days < 5 ? `za ${days} dny` : `za ${days} dní`;
}

/** Calendar leaf in TAP red, the hero's visual anchor. */
function SessionDateTile({ startsAt }: { startsAt: string }) {
  const date = new Date(startsAt);
  const part = (options: Intl.DateTimeFormatOptions) =>
    date.toLocaleDateString('cs-CZ', { ...options, timeZone: TIME_ZONE });

  return (
    <div
      aria-hidden
      className="flex w-20 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl bg-primary py-3.5 text-primary-foreground shadow-lg shadow-black/20"
    >
      <span className="text-[11px] font-bold uppercase tracking-widest">{part({ weekday: 'short' })}</span>
      <span className="font-heading text-3xl font-extrabold leading-none">{part({ day: 'numeric' })}</span>
      <span className="text-[11px]">{part({ month: 'long' })}</span>
    </div>
  );
}

function HeroHeader({ label }: { label: string }) {
  return (
    <div className="relative flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wider text-hero-muted">{label}</span>
      <Link
        href={TS_ROUTES.overview}
        className="focus-ring ml-auto inline-flex shrink-0 items-center gap-1 rounded-sm whitespace-nowrap text-sm font-medium text-hero-foreground/90 hover:underline underline-offset-4"
      >
        Všechny TS
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

/** Decorative ring in the corner of the dark hero. */
function HeroRing() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -right-12 -bottom-20 size-56 rounded-full border-[28px] border-hero-foreground/5"
    />
  );
}

export function NextTrainingSessionCard({ session, now = new Date() }: NextTrainingSessionCardProps) {
  if (!session) {
    return (
      <section className={HERO}>
        <HeroRing />
        <HeroHeader label="Nejbližší training session" />
        <div className="relative flex flex-1 items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-hero-foreground/10">
            <Presentation className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="font-heading text-lg font-bold">Žádná naplánovaná TS</p>
            <p className="text-sm text-hero-muted">
              Tvůj tým zatím nemá další training session. Mrkni, jestli se nedá přidat na cross jiného týmu.
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="secondary" className="relative self-start">
          <Link href={TS_ROUTES.discover}>Objevovat TS</Link>
        </Button>
      </section>
    );
  }

  const facilitatorNames = session.facilitators.flatMap((f) => (f.profile?.name ? [f.profile.name] : []));
  const place = [session.team?.name, session.location].filter(Boolean).join(' · ');

  return (
    <section className={HERO}>
      <HeroRing />
      <HeroHeader label={`Nejbližší training session · ${untilLabel(session.starts_at, now)}`} />
      <Link
        href={TS_ROUTES.detail(session.id)}
        className="focus-ring group relative flex flex-1 flex-col items-start gap-4 rounded-xl sm:flex-row sm:items-center sm:gap-5"
      >
        <SessionDateTile startsAt={session.starts_at} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-start gap-2">
            <p className="font-heading text-xl font-bold leading-snug group-hover:underline underline-offset-4 md:text-2xl">
              {session.topic}
            </p>
            {session.isCross && <Badge variant="secondary">Cross</Badge>}
          </div>
          <p className="text-sm text-hero-foreground/90">
            <span className="font-medium">{formatDayHeading(session.starts_at)}</span>
            {' · '}
            {formatTimeRange(session.starts_at, session.ends_at)}
            {place && ` · ${place}`}
          </p>
          {facilitatorNames.length > 0 && (
            <p className="text-sm text-hero-muted">Facilitace: {facilitatorNames.join(', ')}</p>
          )}
        </div>
      </Link>
    </section>
  );
}
