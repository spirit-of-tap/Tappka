import Link from 'next/link';
import { ArrowRight, DoorOpen } from 'lucide-react';

import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { DashboardCardTitle } from '@/components/dashboard/dashboard-card-title';
import { Button } from '@/components/ui/button';
import { formatDateShort, formatTime } from '@/lib/reservations/utils';

export interface DashboardReservation {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  room: { id: string; code: string; name: string } | null;
}

interface NextReservationCardProps {
  reservations: DashboardReservation[];
  /** All upcoming reservations, including those not previewed. */
  total: number;
}

function relativeDayLabel(startTime: string): string {
  const start = new Date(startTime);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (start.toDateString() === today.toDateString()) return 'Dnes';
  if (start.toDateString() === tomorrow.toDateString()) return 'Zítra';
  return formatDateShort(start);
}

export function NextReservationCard({ reservations, total }: NextReservationCardProps) {
  const more = total - reservations.length;

  return (
    <Card className="h-full border-transparent bg-chart-3/10">
      <CardHeader>
        <DashboardCardTitle className="text-chart-3-strong">Tvoje rezervace</DashboardCardTitle>
        <CardAction>
          <Link
            href="/reservations"
            className="inline-flex items-center gap-1 text-sm font-medium text-chart-3-strong hover:underline underline-offset-4"
          >
            Místnosti
            <ArrowRight className="size-3.5" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {reservations.length > 0 ? (
          <ul className="space-y-2">
            {reservations.map((reservation) => (
              <li key={reservation.id} className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5">
                <span className="w-14 shrink-0 font-heading text-sm font-bold text-chart-3-strong">
                  {relativeDayLabel(reservation.start_at)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {reservation.room?.name ?? reservation.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {formatTime(reservation.start_at)}–{formatTime(reservation.end_at)}
                    {reservation.room && reservation.title && ` · ${reservation.title}`}
                  </span>
                </span>
              </li>
            ))}
            {more > 0 && (
              <li>
                <Link
                  href="/reservations"
                  className="flex items-center justify-center gap-1 rounded-xl border border-dashed border-chart-3-strong/30 px-3 py-2 text-xs font-medium text-chart-3-strong hover:bg-card"
                >
                  + {more} {more === 1 ? 'další rezervace' : more < 5 ? 'další rezervace' : 'dalších rezervací'}
                  <ArrowRight className="size-3" aria-hidden />
                </Link>
              </li>
            )}
          </ul>
        ) : (
          <DashboardEmptyState
            icon={DoorOpen}
            tone="bg-card text-chart-3-strong"
            title="Žádná rezervace"
            description="Potřebuješ místo na schůzku nebo práci v týmu? Zabookuj si místnost."
            action={
              <Button asChild variant="secondary" size="sm">
                <Link href="/reservations">Rezervovat místnost</Link>
              </Button>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
