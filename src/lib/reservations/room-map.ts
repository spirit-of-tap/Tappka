import { OPERATING_HOURS } from "./types";
import type { Reservation, Room } from "./types";
import {
  doTimesOverlap,
  getNextAvailableTime,
  isRoomAvailableOnDay,
  isSlotInPast,
} from "./utils";

export const OTHER_FLOOR_LABEL = "Ostatní";

export const SLOT_CHIP_STEP_MINUTES = 30;

export interface FloorGroup<T extends { code: string }> {
  key: string;
  label: string;
  rooms: T[];
}

/** Floor is the first digit after the building letter: D126 -> 1, D226 -> 2. */
export function getRoomFloor(code: string): number | null {
  const match = /^[a-z]+(\d)/i.exec(code.trim());
  return match ? Number(match[1]) : null;
}

export function groupRoomsByFloor<T extends { code: string }>(
  rooms: T[],
): FloorGroup<T>[] {
  const byFloor = new Map<number, T[]>();
  const other: T[] = [];

  for (const room of rooms) {
    const floor = getRoomFloor(room.code);
    if (floor === null) {
      other.push(room);
    } else {
      byFloor.set(floor, [...(byFloor.get(floor) ?? []), room]);
    }
  }

  const byCode = (a: T, b: T) => a.code.localeCompare(b.code);

  const groups: FloorGroup<T>[] = [...byFloor.entries()]
    .sort(([a], [b]) => a - b)
    .map(([floor, floorRooms]) => ({
      key: String(floor),
      label: `${floor}. patro`,
      rooms: [...floorRooms].sort(byCode),
    }));

  if (other.length > 0) {
    groups.push({
      key: "other",
      label: OTHER_FLOOR_LABEL,
      rooms: [...other].sort(byCode),
    });
  }

  return groups;
}

export type RoomMapStatus =
  | { kind: "closed" }
  | { kind: "busy"; until: Date | null }
  | { kind: "free"; until: Date | null; reservationCount: number };

export interface StatusWindow {
  start: Date;
  end: Date;
}

/**
 * Status of a room for a day. With a `window` the room is busy when a
 * reservation overlaps it; without one (a whole-day view) it is only closed or free.
 */
export function getRoomMapStatus(
  room: Room,
  reservations: Reservation[],
  day: Date,
  window: StatusWindow | null,
): RoomMapStatus {
  if (!isRoomAvailableOnDay(room, day)) {
    return { kind: "closed" };
  }

  const roomReservations = reservations.filter((r) => r.room_id === room.id);

  if (!window) {
    return { kind: "free", until: null, reservationCount: roomReservations.length };
  }

  const isBusy = roomReservations.some((r) =>
    doTimesOverlap(window.start, window.end, new Date(r.start_at), new Date(r.end_at)),
  );

  if (isBusy) {
    return { kind: "busy", until: getNextAvailableTime(roomReservations, window.start) };
  }

  const nextStart = roomReservations
    .map((r) => new Date(r.start_at))
    .filter((start) => start >= window.end && start.toDateString() === window.start.toDateString())
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const sameDay = window.start.toDateString();
  return {
    kind: "free",
    until: nextStart ?? null,
    reservationCount: roomReservations.filter((r) => new Date(r.start_at).toDateString() === sameDay).length,
  };
}

export type SlotChipState = "free" | "busy" | "past";

export interface SlotChip {
  start: Date;
  end: Date;
  state: SlotChipState;
}

/** Start times for one room and day, with the chosen duration applied to every chip. */
export function getSlotChips(
  day: Date,
  reservations: Reservation[],
  durationMinutes: number,
  now: Date = new Date(),
): SlotChip[] {
  const dayEnd = new Date(day);
  dayEnd.setHours(OPERATING_HOURS.end, 0, 0, 0);

  const chips: SlotChip[] = [];
  const cursor = new Date(day);
  cursor.setHours(OPERATING_HOURS.start, 0, 0, 0);

  while (cursor.getTime() + durationMinutes * 60_000 <= dayEnd.getTime()) {
    const start = new Date(cursor);
    const end = new Date(cursor.getTime() + durationMinutes * 60_000);

    let state: SlotChipState = "free";
    if (isSlotInPast(start, now)) {
      state = "past";
    } else if (
      reservations.some((r) =>
        doTimesOverlap(start, end, new Date(r.start_at), new Date(r.end_at)),
      )
    ) {
      state = "busy";
    }

    chips.push({ start, end, state });
    cursor.setMinutes(cursor.getMinutes() + SLOT_CHIP_STEP_MINUTES);
  }

  return chips;
}
