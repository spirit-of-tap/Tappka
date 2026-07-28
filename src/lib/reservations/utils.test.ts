import { describe, expect, it } from "vitest";
import {
  doTimesOverlap,
  getFirstBookableRange,
  isRoomAvailableOnDay,
} from "@/lib/reservations/utils";
import type { Reservation, Room } from "@/lib/reservations/types";

describe("doTimesOverlap", () => {
  const at = (h: number) => new Date(`2026-07-09T${String(h).padStart(2, "0")}:00:00Z`);

  it("returns true when ranges overlap", () => {
    expect(doTimesOverlap(at(9), at(11), at(10), at(12))).toBe(true);
  });

  it("returns false when ranges only touch at the boundary", () => {
    expect(doTimesOverlap(at(9), at(10), at(10), at(11))).toBe(false);
  });

  it("returns false when ranges are disjoint", () => {
    expect(doTimesOverlap(at(9), at(10), at(11), at(12))).toBe(false);
  });
});

describe("isRoomAvailableOnDay", () => {
  const room = (available_days: number[] | null) =>
    ({ available_days }) as unknown as Room;

  it("treats null available_days as every day", () => {
    // 2026-07-09 is a Thursday (getDay() === 4)
    expect(isRoomAvailableOnDay(room(null), new Date("2026-07-09T09:00:00Z"))).toBe(true);
  });

  it("returns false when the weekday is not in available_days", () => {
    expect(isRoomAvailableOnDay(room([1, 2, 3]), new Date("2026-07-09T09:00:00Z"))).toBe(false);
  });
});

describe("getFirstBookableRange", () => {
  // Local-time constructors: the schedule views position everything in local time.
  const day = new Date(2026, 6, 9); // Thursday 2026-07-09
  const at = (hour: number, minute = 0) => new Date(2026, 6, 9, hour, minute, 0, 0);
  const beforeOpening = new Date(2026, 6, 9, 5, 0, 0, 0);

  const reservation = (startHour: number, startMinute: number, endHour: number, endMinute: number) =>
    ({
      start_at: at(startHour, startMinute).toISOString(),
      end_at: at(endHour, endMinute).toISOString(),
    }) as unknown as Reservation;

  it("returns the first hour of operating hours for an empty day", () => {
    const { startTime, endTime } = getFirstBookableRange(day, [], 60, beforeOpening);
    expect(startTime).toEqual(at(7));
    expect(endTime).toEqual(at(8));
  });

  it("skips past existing reservations", () => {
    const { startTime, endTime } = getFirstBookableRange(
      day,
      [reservation(7, 0, 9, 0)],
      60,
      beforeOpening
    );
    expect(startTime).toEqual(at(9));
    expect(endTime).toEqual(at(10));
  });

  it("skips gaps shorter than the requested duration", () => {
    // 7:30–8:00 is free but too short for a 60 minute window.
    const { startTime } = getFirstBookableRange(
      day,
      [reservation(7, 0, 7, 30), reservation(8, 0, 9, 0)],
      60,
      beforeOpening
    );
    expect(startTime).toEqual(at(9));
  });

  it("starts at the next slot after now when the day is today", () => {
    const { startTime, endTime } = getFirstBookableRange(day, [], 60, at(10, 7));
    expect(startTime).toEqual(at(10, 15));
    expect(endTime).toEqual(at(11, 15));
  });

  it("falls back to the last window of the day when fully booked", () => {
    const { startTime, endTime } = getFirstBookableRange(
      day,
      [reservation(7, 0, 22, 0)],
      60,
      beforeOpening
    );
    expect(startTime).toEqual(at(21));
    expect(endTime).toEqual(at(22));
  });
});
