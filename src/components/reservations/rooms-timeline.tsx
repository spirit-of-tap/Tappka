"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  getTimelineSegments,
  groupRoomsByFloor,
  TIMELINE_END_HOUR,
  TIMELINE_START_HOUR,
  timelinePercent,
} from "@/lib/reservations/room-map";
import { formatTime, isRoomAvailableOnDay } from "@/lib/reservations/utils";
import type { Reservation, Room } from "@/lib/reservations/types";

import { getRoomTitle } from "./room-map";

const LABEL_EVERY_HOURS = 3;
/** Segments narrower than this (in % of the day) drop their title to stay legible. */
const TITLE_MIN_WIDTH = 7;
const DAY_KEY_FORMAT = "yyyy-MM-dd";
const LOAD_ERROR_MESSAGE = "Rezervace se nepodařilo načíst. Zkus to prosím znovu.";

const HOURS = Array.from(
  { length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 },
  (_, i) => TIMELINE_START_HOUR + i,
);

const subscribeNoop = () => () => {};

function roomSubtitle(room: Room, open: boolean): string {
  const title = getRoomTitle(room);
  const label = title.toLowerCase() === room.code.toLowerCase() ? (room.description ?? "") : title;
  return open ? label : [label, "zavřeno"].filter(Boolean).join(" · ");
}

interface RoomsTimelineProps {
  rooms: Room[];
  profileId: string;
}

interface LoadedDay {
  key: string;
  items: Reservation[];
}

function hourPercent(day: Date, hour: number): number {
  return timelinePercent(new Date(new Date(day).setHours(hour, 0, 0, 0)), day);
}

/** All rooms on one day axis; each row opens that room's calendar. */
export function RoomsTimeline({ rooms, profileId }: RoomsTimelineProps) {
  // Times depend on the viewer's timezone, so the axis renders only in the browser.
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const [dayOffset, setDayOffset] = useState(0);
  const [loaded, setLoaded] = useState<LoadedDay | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  const now = new Date();
  const day = addDays(startOfDay(now), dayOffset);
  const dayKey = format(day, DAY_KEY_FORMAT);
  const isToday = isSameDay(day, now);

  useEffect(() => {
    let cancelled = false;
    const start = new Date(`${dayKey}T00:00:00`);
    const params = new URLSearchParams({
      start_date: start.toISOString(),
      end_date: addDays(start, 1).toISOString(),
    });
    fetch(`/api/reservations?${params}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Reservations request failed: ${response.status}`);
        return response.json();
      })
      .then((result: { data?: Reservation[] }) => {
        if (cancelled) return;
        setLoaded({ key: dayKey, items: result.data ?? [] });
        setFailedKey(null);
      })
      .catch(() => {
        if (!cancelled) setFailedKey(dayKey);
      });
    return () => {
      cancelled = true;
    };
  }, [dayKey]);

  const hasDay = isClient && loaded?.key === dayKey;
  const reservations = hasDay ? loaded.items : [];
  const nowPercent = isToday ? timelinePercent(now, day) : null;
  const showNow = nowPercent !== null && nowPercent > 0 && nowPercent < 100;
  const orderedRooms = groupRoomsByFloor(rooms).flatMap((group) => group.rooms);
  const mineIds = new Set(reservations.filter((r) => r.owner_profile_id === profileId).map((r) => r.id));
  const dayLabel = day.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });

  return (
    <section aria-labelledby="rooms-timeline-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="rooms-timeline-heading" className="font-heading text-lg font-bold first-letter:uppercase">
          {isClient ? dayLabel : "Dnes"}
        </h2>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Předchozí den"
            disabled={dayOffset <= 0}
            onClick={() => setDayOffset((offset) => offset - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button type="button" variant={dayOffset === 0 ? "default" : "outline"} onClick={() => setDayOffset(0)}>
            Dnes
          </Button>
          <Button type="button" variant={dayOffset === 1 ? "default" : "outline"} onClick={() => setDayOffset(1)}>
            Zítra
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Další den"
            onClick={() => setDayOffset((offset) => offset + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card p-3 shadow-xs sm:p-5">
        <div className="min-w-[40rem]">
          <div
            aria-hidden
            className="grid grid-cols-[9rem_minmax(0,1fr)_6.5rem] gap-3 pb-2 text-xs text-muted-foreground tabular-nums"
          >
            <span />
            <div className="relative h-5">
              {HOURS.filter((hour) => (hour - TIMELINE_START_HOUR) % LABEL_EVERY_HOURS === 0).map((hour) => (
                <span
                  key={hour}
                  className="absolute top-0.5 -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
                  style={{ left: `${hourPercent(day, hour)}%` }}
                >
                  {hour}
                </span>
              ))}
              {isClient && showNow && (
                <span
                  className="absolute top-0 -translate-x-1/2 rounded-md bg-primary px-1.5 py-0.5 font-bold leading-none text-primary-foreground"
                  style={{ left: `${nowPercent}%` }}
                >
                  {formatTime(now)}
                </span>
              )}
            </div>
            <span />
          </div>

          <ul className="divide-y divide-border/60">
            {orderedRooms.map((room) => {
              const open = isRoomAvailableOnDay(room, day);
              const segments = getTimelineSegments(reservations, room.id, day, mineIds);
              return (
                <li key={room.id}>
                  <Link
                    href={`/reservations/${room.code}?date=${dayKey}`}
                    aria-label={`${room.name}: otevřít kalendář místnosti`}
                    className="group focus-ring grid grid-cols-[9rem_minmax(0,1fr)_6.5rem] items-center gap-3 rounded-xl px-1 py-2 motion-safe:transition-colors hover:bg-accent/60"
                  >
                    <span className="min-w-0 px-2">
                      <span className="block font-heading text-lg font-extrabold uppercase leading-tight">
                        {room.code}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {roomSubtitle(room, open)}
                      </span>
                    </span>

                    <span
                      aria-hidden
                      className={cn(
                        "relative block h-12 overflow-hidden rounded-xl",
                        open ? "bg-success/12 ring-1 ring-inset ring-success/20" : "bg-muted",
                      )}
                    >
                      {HOURS.slice(1, -1)
                        .filter((hour) => (hour - TIMELINE_START_HOUR) % LABEL_EVERY_HOURS === 0)
                        .map((hour) => (
                          <span
                            key={hour}
                            className="absolute inset-y-0 w-px bg-foreground/10"
                            style={{ left: `${hourPercent(day, hour)}%` }}
                          />
                        ))}
                      {isClient && showNow && open && (
                        <span className="absolute inset-y-0 left-0 bg-muted/80" style={{ width: `${nowPercent}%` }} />
                      )}
                      {!hasDay && isClient && failedKey !== dayKey && (
                        <Skeleton className="absolute inset-1 rounded-lg" />
                      )}
                      {open &&
                        segments.map((segment) => (
                          <span
                            key={segment.id}
                            className={cn(
                              "absolute inset-y-1.5 flex items-center overflow-hidden rounded-lg px-2 text-xs font-semibold whitespace-nowrap",
                              segment.mine ? "bg-primary text-primary-foreground" : "bg-chart-2 text-warning-foreground",
                            )}
                            style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
                          >
                            {segment.width >= TITLE_MIN_WIDTH &&
                              (segment.mine
                                ? "Ty"
                                : (reservations.find((r) => r.id === segment.id)?.title ?? formatTime(segment.start)))}
                          </span>
                        ))}
                      {isClient && showNow && (
                        <span
                          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-primary"
                          style={{ left: `${nowPercent}%` }}
                        />
                      )}
                    </span>

                    <span className="flex items-center justify-end gap-1.5 pr-2 text-sm font-semibold text-primary">
                      <CalendarDays className="size-4" aria-hidden />
                      Kalendář
                      <ChevronRight
                        className="size-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {failedKey === dayKey && (
        <p role="alert" className="text-sm text-destructive-strong">
          {LOAD_ERROR_MESSAGE}
        </p>
      )}

      <ul
        aria-label="Legenda"
        className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
      >
        <LegendItem className="bg-success/30 ring-1 ring-inset ring-success/40">volno</LegendItem>
        <LegendItem className="bg-chart-2">obsazeno</LegendItem>
        <LegendItem className="bg-primary">tvoje</LegendItem>
        {isToday && <LegendItem className="bg-muted ring-1 ring-inset ring-border">uplynulo</LegendItem>}
      </ul>
    </section>
  );
}

function LegendItem({ className, children }: { className: string; children: string }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span className={cn("size-3 rounded-sm", className)} aria-hidden />
      {children}
    </li>
  );
}
