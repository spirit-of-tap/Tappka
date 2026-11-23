import Link from 'next/link';
import { ArrowRight, DoorOpen } from 'lucide-react';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
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
    <Card className="h-full">
      <CardHeader>
        <DashboardCardTitle>Nadcházející rezervace</DashboardCardTitle>
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
          <div className="flex gap-3">
            <span aria-hidden className="w-1 shrink-0 rounded-full bg-chart-3" />
            <div className="min-w-0 space-y-0.5">
              <p className="font-medium">{reservation.room?.name ?? reservation.title}</p>
              <p className="text-sm text-muted-foreground first-letter:uppercase">
                {relativeDayLabel(reservation.start_at)} · {formatTime(reservation.start_at)}–
                {formatTime(reservation.end_at)}
              </p>
              {reservation.room && reservation.title && (
                <p className="text-sm text-muted-foreground line-clamp-1">{reservation.title}</p>
              )}
            </div>
          </div>
        ) : (
          <DashboardEmptyState
            icon={DoorOpen}
            tone="bg-chart-3/15 text-chart-3-strong"
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
