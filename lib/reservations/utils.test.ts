import { describe, expect, it } from "vitest";
import { doTimesOverlap, isRoomAvailableOnDay } from "@/lib/reservations/utils";
import type { Room } from "@/lib/reservations/types";

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
