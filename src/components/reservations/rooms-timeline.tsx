"use client";

import { useEffect, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  bookableRange,
  firstBookableRange,
  getTimelineSegments,
  groupRoomsByFloor,
  TIMELINE_END_HOUR,
  TIMELINE_START_HOUR,
  timelineMinutesAt,
  timelinePercent,
  type TimeRange,
} from "@/lib/reservations/room-map";
import { formatTime, isRoomAvailableOnDay } from "@/lib/reservations/utils";
import type { Reservation, Room } from "@/lib/reservations/types";

import { QuickReservationDialog } from "./quick-reservation-dialog";
import { getRoomTitle } from "./room-map";

const LABEL_EVERY_HOURS = 3;
/** Segments narrower than this (in % of the day) drop their title to stay legible. */
const TITLE_MIN_WIDTH = 7;
const DAY_KEY_FORMAT = "yyyy-MM-dd";
const LOAD_ERROR_MESSAGE = "Rezervace se nepodařilo načíst. Zkus to prosím znovu.";
const NOTHING_FREE_MESSAGE = "Tahle místnost už dnes nemá volný čas.";

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

function hourPercent(day: Date, hour: number): number {
  return timelinePercent(new Date(new Date(day).setHours(hour, 0, 0, 0)), day);
}

function pointerMinutes(event: ReactPointerEvent<HTMLElement>): number {
  const rect = event.currentTarget.getBoundingClientRect();
  return timelineMinutesAt((event.clientX - rect.left) / rect.width);
}

interface RoomsTimelineProps {
  rooms: Room[];
  profileId: string;
}

interface LoadedDay {
  key: string;
  items: Reservation[];
}

interface Drag {
  roomId: string;
  from: number;
  to: number;
}

interface Booking extends TimeRange {
  room: Room;
}

/** All rooms on one day axis: drag over free time to book, or open a room's calendar. */
export function RoomsTimeline({ rooms, profileId }: RoomsTimelineProps) {
  // Times depend on the viewer's timezone, so the axis renders only in the browser.
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const [dayOffset, setDayOffset] = useState(0);
  const [loaded, setLoaded] = useState<LoadedDay | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
  }, [dayKey, refreshKey]);

  const hasDay = isClient && loaded?.key === dayKey;
  const reservations = hasDay ? loaded.items : [];
  const nowPercent = isToday ? timelinePercent(now, day) : null;
  const showNow = nowPercent !== null && nowPercent > 0 && nowPercent < 100;
  const orderedRooms = groupRoomsByFloor(rooms).flatMap((group) => group.rooms);
  const mineIds = new Set(reservations.filter((r) => r.owner_profile_id === profileId).map((r) => r.id));
  const dayLabel = day.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });

  const roomReservations = (roomId: string) => reservations.filter((r) => r.room_id === roomId);
  const dragRange = drag ? bookableRange(day, drag.from, drag.to, roomReservations(drag.roomId), now) : null;

  const changeDay = (offset: number) => {
    setDayOffset(offset);
    setNotice(null);
  };

  const openBooking = (room: Room, range: TimeRange | null) => {
    if (!range) return;
    setBooking({ room, ...range });
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setBooking(null);
      setRefreshKey((key) => key + 1);
    }
  };

  const handlePointerDown = (room: Room, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!hasDay || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const minutes = pointerMinutes(event);
    setNotice(null);
    setDrag({ roomId: room.id, from: minutes, to: minutes });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const minutes = pointerMinutes(event);
    if (minutes !== drag.to) setDrag({ ...drag, to: minutes });
  };

  const handlePointerUp = (room: Room) => {
    if (!drag) return;
    openBooking(room, dragRange);
    setDrag(null);
  };

  const handleKeyboardBook = (room: Room) => {
    const range = firstBookableRange(day, roomReservations(room.id), now);
    if (!range) setNotice(`${room.code.toUpperCase()}: ${NOTHING_FREE_MESSAGE}`);
    openBooking(room, range);
  };

  const preview = drag ? dragRange : booking;
  const previewRoomId = drag ? drag.roomId : booking?.room.id;

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
            onClick={() => changeDay(dayOffset - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button type="button" variant={dayOffset === 0 ? "default" : "outline"} onClick={() => changeDay(0)}>
            Dnes
          </Button>
          <Button type="button" variant={dayOffset === 1 ? "default" : "outline"} onClick={() => changeDay(1)}>
            Zítra
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Další den"
            onClick={() => changeDay(dayOffset + 1)}
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
              const calendarHref = `/reservations/${room.code}?date=${dayKey}`;
              const showPreview = preview && previewRoomId === room.id;
              const previewLeft = showPreview ? timelinePercent(preview.start, day) : 0;
              const previewWidth = showPreview ? timelinePercent(preview.end, day) - previewLeft : 0;
              return (
                <li
                  key={room.id}
                  className="grid grid-cols-[9rem_minmax(0,1fr)_6.5rem] items-center gap-3 rounded-xl px-1 py-2"
                >
                  <Link href={calendarHref} className="focus-ring min-w-0 rounded-lg px-2 py-1 hover:bg-accent/60">
                    <span className="block font-heading text-lg font-extrabold uppercase leading-tight">
                      {room.code}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">{roomSubtitle(room, open)}</span>
                  </Link>

                  <button
                    type="button"
                    disabled={!open || !hasDay}
                    aria-label={`Zarezervovat ${room.code.toUpperCase()} v nejbližším volném čase`}
                    onPointerDown={(event) => handlePointerDown(room, event)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={() => handlePointerUp(room)}
                    onPointerCancel={() => setDrag(null)}
                    onClick={(event) => {
                      if (event.detail === 0) handleKeyboardBook(room);
                    }}
                    className={cn(
                      "focus-ring relative block h-12 w-full touch-pan-y select-none overflow-hidden rounded-xl",
                      open
                        ? "cursor-crosshair bg-success/12 ring-1 ring-inset ring-success/20 hover:ring-success/50"
                        : "cursor-not-allowed bg-muted",
                    )}
                  >
                    {HOURS.slice(1, -1)
                      .filter((hour) => (hour - TIMELINE_START_HOUR) % LABEL_EVERY_HOURS === 0)
                      .map((hour) => (
                        <span
                          key={hour}
                          aria-hidden
                          className="absolute inset-y-0 w-px bg-foreground/10"
                          style={{ left: `${hourPercent(day, hour)}%` }}
                        />
                      ))}
                    {isClient && showNow && open && (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 bg-muted/80"
                        style={{ width: `${nowPercent}%` }}
                      />
                    )}
                    {!hasDay && isClient && failedKey !== dayKey && (
                      <Skeleton className="absolute inset-1 rounded-lg" />
                    )}
                    {open &&
                      segments.map((segment) => (
                        <span
                          key={segment.id}
                          aria-hidden
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
                    {showPreview && previewWidth > 0 && (
                      <span
                        aria-hidden
                        className="absolute inset-y-1 flex items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-chart-3 bg-chart-3/20 px-1 text-xs font-bold whitespace-nowrap text-chart-3-strong tabular-nums"
                        style={{ left: `${previewLeft}%`, width: `${previewWidth}%` }}
                      >
                        {formatTime(preview.start)}–{formatTime(preview.end)}
                      </span>
                    )}
                    {isClient && showNow && (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-primary"
                        style={{ left: `${nowPercent}%` }}
                      />
                    )}
                  </button>

                  <Link
                    href={calendarHref}
                    aria-label={`Kalendář místnosti ${room.code.toUpperCase()}`}
                    className="group focus-ring flex min-h-11 items-center justify-end gap-1.5 rounded-lg pr-2 text-sm font-semibold text-primary hover:underline"
                  >
                    <CalendarDays className="size-4" aria-hidden />
                    Kalendář
                    <ChevronRight
                      className="size-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
                      aria-hidden
                    />
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
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      <ul aria-label="Legenda" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <LegendItem className="bg-success/30 ring-1 ring-inset ring-success/40">volno, táhni pro rezervaci</LegendItem>
        <LegendItem className="bg-chart-2">obsazeno</LegendItem>
        <LegendItem className="bg-primary">tvoje</LegendItem>
        <LegendItem className="border-2 border-dashed border-chart-3 bg-chart-3/20">vybraný čas</LegendItem>
        {isToday && <LegendItem className="bg-muted ring-1 ring-inset ring-border">uplynulo</LegendItem>}
      </ul>

      {booking && (
        <QuickReservationDialog
          open={dialogOpen}
          onOpenChange={handleDialogOpenChange}
          roomId={booking.room.id}
          roomName={booking.room.name}
          startTime={booking.start}
          endTime={booking.end}
        />
      )}
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
