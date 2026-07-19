import Link from 'next/link';
import { ArrowRight, CalendarClock } from 'lucide-react';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  reservation: DashboardReservation | null;
}

function relativeDayLabel(startTime: string): string {
  const start = new Date(startTime);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (start.toDateString() === today.toDateString()) return 'dnes';
  if (start.toDateString() === tomorrow.toDateString()) return 'zítra';
  return formatDateShort(start);
}

export function NextReservationCard({ reservation }: NextReservationCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4 text-muted-foreground" />
          Nadcházející rezervace
        </CardTitle>
        {reservation && (
          <CardDescription>
            {relativeDayLabel(reservation.start_at)} ·{' '}
            {formatTime(reservation.start_at)}–{formatTime(reservation.end_at)}
          </CardDescription>
        )}
        <CardAction>
          <Link
            href="/reservations"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline underline-offset-4"
          >
            Místnosti
            <ArrowRight className="size-3.5" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {reservation ? (
          <div>
            <p className="text-sm font-medium">{reservation.title}</p>
            {reservation.room && (
              <p className="text-sm text-muted-foreground">{reservation.room.name}</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">
              Nemáš žádnou nadcházející rezervaci.
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link href="/reservations">Rezervovat místnost</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
