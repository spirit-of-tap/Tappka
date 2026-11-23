'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, DoorOpen, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import type { WeekDay, WeekReservation } from '@/lib/dashboard/rooms-week';
import { cn } from '@/lib/utils';

const LIST_LIMIT = 4;

interface RoomsWeekCardProps {
  days: WeekDay[];
  items: WeekReservation[];
  /** All upcoming reservations, including those past the strip. */
  total: number;
}

function moreLabel(n: number): string {
  return n >= 5 ? `+ ${n} dalších rezervací` : `+ ${n} další rezervace`;
}

/**
 * Rooms at a glance: a rolling week strip (dot per reservation) that filters the
 * list below. Clicking the selected day again shows everything upcoming.
 */
export function RoomsWeekCard({ days, items, total }: RoomsWeekCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const visible = selected ? items.filter((r) => r.dayKey === selected) : items;
  const shown = visible.slice(0, LIST_LIMIT);
  const more = selected ? visible.length - shown.length : total - shown.length;
  const selectedDay = days.find((d) => d.key === selected);

  return (
    <section className="flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 text-card-foreground shadow-sm md:p-6">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold text-chart-3-strong">Místnosti · tvůj týden</h2>
        <Link
          href="/reservations"
          className="focus-ring ml-auto inline-flex items-center gap-1 rounded-sm text-sm font-medium text-chart-3-strong hover:underline underline-offset-4"
        >
          Všechny
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div role="group" aria-label="Dny v týdnu" className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const active = day.key === selected;
          return (
            <Button
              key={day.key}
              type="button"
              variant="ghost"
              aria-pressed={active}
              aria-label={`${day.label}: ${day.count} rezervací`}
              onClick={() => setSelected(active ? null : day.key)}
              className={cn(
                'flex h-auto min-w-0 flex-col gap-1 rounded-xl px-0 py-2 font-normal',
                active
                  ? 'bg-chart-3-strong text-card hover:bg-chart-3-strong hover:text-card'
                  : day.isToday
                    ? 'bg-chart-3/15 text-chart-3-strong hover:bg-chart-3/25'
                    : 'bg-muted/60 hover:bg-muted',
              )}
            >
              <span className="text-[11px] leading-none">{day.weekday}</span>
              <span className="font-heading text-base font-bold leading-none">{day.day}</span>
              <span aria-hidden className="flex h-1.5 gap-0.5">
                {Array.from({ length: Math.min(day.count, 3) }, (_, i) => (
                  <span key={i} className={cn('size-1.5 rounded-full', active ? 'bg-card' : 'bg-chart-3')} />
                ))}
              </span>
            </Button>
          );
        })}
      </div>

      {shown.length > 0 ? (
        <ul key={selected ?? 'all'} className="flex flex-col gap-1">
          {shown.map((r, i) => (
            <li
              key={r.id}
              style={{ animationDelay: `${i * 50}ms` }}
              className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/50 motion-safe:animate-rise"
            >
              <span className="w-22 shrink-0 text-xs leading-tight whitespace-nowrap">
                <span className="block font-bold text-chart-3-strong">{r.dayLabel}</span>
                <span className="tabular-nums text-muted-foreground">{r.time}</span>
              </span>
              {r.roomCode && (
                <span className="shrink-0 rounded-lg bg-chart-3/15 px-2 py-1 font-heading text-xs font-bold text-chart-3-strong">
                  {r.roomCode}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.title || r.roomName}</span>
                {r.title && r.roomName !== r.roomCode && (
                  <span className="block truncate text-xs text-muted-foreground">{r.roomName}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : selectedDay ? (
        <p className="flex-1 rounded-xl border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          {selectedDay.label} nemáš nic zarezervováno.
        </p>
      ) : (
        <DashboardEmptyState
          icon={DoorOpen}
          tone="bg-chart-3/15 text-chart-3-strong"
          title="Žádná rezervace"
          description="Potřebuješ místo na schůzku nebo práci v týmu? Zabookuj si místnost."
        />
      )}

      <div className="mt-auto flex items-center gap-3">
        <Button asChild size="sm" className="bg-chart-3-strong text-card hover:bg-chart-3-strong/90">
          <Link href="/reservations">
            <Plus className="size-4" aria-hidden />
            Rezervovat
          </Link>
        </Button>
        {more > 0 && (
          <Link
            href="/reservations"
            className="focus-ring rounded-sm text-xs font-medium text-chart-3-strong hover:underline underline-offset-4"
          >
            {moreLabel(more)}
          </Link>
        )}
      </div>
    </section>
  );
}
