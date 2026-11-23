"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, addMinutes, format, isSameDay, startOfDay } from "date-fns";
import { Spinner } from "@/components/ui/spinner";
import { RoomFilter, getDefaultStartTime, type FilterState } from "./room-filter";
import { RoomMap, type MapRoom } from "./room-map";
import { RoomDetailPanel } from "./room-detail-panel";
import { QuickReservationDialog } from "./quick-reservation-dialog";
import {
  getRoomMapStatus,
  getSlotChips,
  groupRoomsByFloor,
  type StatusWindow,
} from "@/lib/reservations/room-map";
import { DEFAULT_RESERVATION_MINUTES } from "@/lib/reservations/utils";
import type { Reservation, Room, RoomWithStatus } from "@/lib/reservations/types";

interface RoomsWithFilterProps {
  rooms: RoomWithStatus[];
  reservations: Reservation[];
  myReservations: Reservation[];
}

interface Booking {
  room: Room;
  start: Date;
  end: Date;
}

interface LoadedDay {
  key: string;
  items: Reservation[];
}

const DAY_KEY_FORMAT = "yyyy-MM-dd";
const MOBILE_QUERY = "(max-width: 1023px)";

function parseTime(day: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(day);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * Floor-plan room map with a detail panel for the selected room and day
 */
export function RoomsWithFilter({ rooms, reservations, myReservations }: RoomsWithFilterProps) {
  const [filter, setFilter] = useState<FilterState>(() => ({
    date: new Date(),
    startTime: getDefaultStartTime(),
    duration: null,
  }));
  const [loaded, setLoaded] = useState<LoadedDay | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chosenStart, setChosenStart] = useState<Date | null>(null);
  const [chosenDuration, setChosenDuration] = useState<number | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const day = startOfDay(filter.date);
  const dayKey = format(day, DAY_KEY_FORMAT);
  const isToday = isSameDay(day, now);

  useEffect(() => {
    if (isToday && refreshKey === 0) return;

    let cancelled = false;
    const params = new URLSearchParams({
      start_date: day.toISOString(),
      end_date: addDays(day, 1).toISOString(),
    });

    fetch(`/api/reservations?${params}`)
      .then((response) => response.json())
      .then((result: { data?: Reservation[] }) => {
        if (!cancelled) setLoaded({ key: dayKey, items: result.data ?? [] });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key: dayKey, items: [] });
      });

    return () => {
      cancelled = true;
    };
    // `day` is derived from `dayKey`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey, refreshKey, isToday]);

  const hasLoadedDay = loaded?.key === dayKey;
  const isLoadingDay = !hasLoadedDay && !isToday;
  const dayReservations = hasLoadedDay ? loaded.items : isToday ? reservations : [];

  const filterActive = filter.duration !== null;
  const filterStart = parseTime(day, filter.startTime);
  const filterMinutes = filter.duration ? parseInt(filter.duration, 10) : null;

  let statusWindow: StatusWindow | null = null;
  if (filterMinutes !== null) {
    statusWindow = { start: filterStart, end: addMinutes(filterStart, filterMinutes) };
  } else if (isToday) {
    statusWindow = { start: now, end: addMinutes(now, 1) };
  }

  const items: MapRoom[] = rooms.map((room) => {
    const mine = myReservations
      .filter(
        (r) =>
          r.room_id === room.id &&
          isSameDay(new Date(r.start_at), day) &&
          new Date(r.end_at) > now,
      )
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];

    return {
      room,
      status: getRoomMapStatus(room, dayReservations, day, statusWindow),
      mineStart: mine ? new Date(mine.start_at) : null,
    };
  });

  const orderedItems = groupRoomsByFloor(rooms).flatMap((group) =>
    group.rooms.map((room) => items.find((item) => item.room.id === room.id)!),
  );
  const selectedItem =
    orderedItems.find((item) => item.room.id === selectedId) ??
    orderedItems.find((item) => item.status.kind === "free") ??
    orderedItems[0] ??
    null;

  const duration = chosenDuration ?? filterMinutes ?? DEFAULT_RESERVATION_MINUTES;
  const chips =
    selectedItem && selectedItem.status.kind !== "closed"
      ? getSlotChips(
          day,
          dayReservations.filter((r) => r.room_id === selectedItem.room.id),
          duration,
          now,
        )
      : [];
  const isFreeStart = (start: Date | null) =>
    start !== null &&
    chips.some((chip) => chip.state === "free" && chip.start.getTime() === start.getTime());
  const filterChipStart = filterActive ? filterStart : null;
  const effectiveStart =
    [chosenStart, filterChipStart].find(isFreeStart) ??
    chips.find((chip) => chip.state === "free")?.start ??
    null;

  const mineIds = new Set(myReservations.map((r) => r.id));
  const freeCount = items.filter((item) => item.status.kind === "free").length;

  const handleSelectRoom = useCallback((room: Room) => {
    setSelectedId(room.id);
    if (window.matchMedia?.(MOBILE_QUERY).matches) {
      panelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleBook = () => {
    const chip = chips.find((c) => c.start.getTime() === effectiveStart?.getTime());
    if (!selectedItem || !chip) return;
    setBooking({ room: selectedItem.room, start: chip.start, end: chip.end });
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setRefreshKey((key) => key + 1);
  };

  return (
    <div className="space-y-4">
      <RoomFilter value={filter} onChange={setFilter} />

      {filterActive && (
        <div className="flex items-center gap-2 px-1 text-sm font-medium text-chart-3-strong">
          <span>{freeCount} volné z {rooms.length} místností</span>
          {isLoadingDay && <Spinner className="size-3.5" />}
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_21.25rem]">
        <RoomMap
          items={orderedItems}
          selectedId={selectedItem?.room.id ?? null}
          isToday={isToday}
          onSelect={handleSelectRoom}
        />

        <div ref={panelRef} className="scroll-mt-4 lg:sticky lg:top-4">
          {selectedItem && (
            <RoomDetailPanel
              room={selectedItem.room}
              status={selectedItem.status}
              isToday={isToday}
              isLoading={isLoadingDay}
              chips={chips}
              day={day}
              reservations={dayReservations.filter((r) => r.room_id === selectedItem.room.id)}
              mineIds={mineIds}
              duration={duration}
              chosenStart={effectiveStart}
              onChooseStart={setChosenStart}
              onChooseDuration={setChosenDuration}
              onBook={handleBook}
            />
          )}
        </div>
      </div>

      {booking && (
        <QuickReservationDialog
          open={dialogOpen}
          onOpenChange={handleDialogOpenChange}
          roomId={booking.room.id}
          roomName={booking.room.name}
          roomCode={booking.room.code}
          startTime={booking.start}
          endTime={booking.end}
        />
      )}
    </div>
  );
}
