import { describe, expect, it } from "vitest";

import {
  getRoomFloor,
  getDayBarSegments,
  getRoomMapStatus,
  getSlotChips,
  groupRoomsByFloor,
} from "./room-map";
import type { Reservation, Room } from "./types";

const room = (code: string, overrides: Partial<Room> = {}): Room => ({
  id: code,
  code,
  name: code,
  description: null,
  available_days: null,
  can_have_ts: false,
  removed_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  created_by_profile_id: "p1",
  updated_at: "2026-01-01T00:00:00.000Z",
  updated_by_profile_id: "p1",
  ...overrides,
});

const reservation = (roomId: string, start: Date, end: Date): Reservation => ({
  id: `${roomId}-${start.getTime()}`,
  room_id: roomId,
  owner_profile_id: "p1",
  title: "x",
  person_count: 1,
  start_at: start.toISOString(),
  end_at: end.toISOString(),
  cancelled_at: null,
  cancelled_by_profile_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  created_by_profile_id: "p1",
  updated_at: "2026-01-01T00:00:00.000Z",
  updated_by_profile_id: "p1",
});

describe("getRoomFloor", () => {
  it("reads the first digit after the letter", () => {
    expect(getRoomFloor("D126")).toBe(1);
    expect(getRoomFloor("d226")).toBe(2);
    expect(getRoomFloor("D107")).toBe(1);
  });

  it("returns null for unparsable codes", () => {
    expect(getRoomFloor("aula")).toBeNull();
    expect(getRoomFloor("126")).toBeNull();
    expect(getRoomFloor("")).toBeNull();
  });
});

describe("groupRoomsByFloor", () => {
  it("groups by floor, sorts floors and rooms, and puts unparsable codes last", () => {
    const groups = groupRoomsByFloor([
      room("d226"),
      room("zahrada"),
      room("d132"),
      room("d126"),
    ]);

    expect(groups.map((g) => g.label)).toEqual(["1. patro", "2. patro", "Ostatní"]);
    expect(groups[0].rooms.map((r) => r.code)).toEqual(["d126", "d132"]);
    expect(groups[2].rooms.map((r) => r.code)).toEqual(["zahrada"]);
  });

  it("returns no groups for no rooms", () => {
    expect(groupRoomsByFloor([])).toEqual([]);
  });
});

describe("getRoomMapStatus", () => {
  const day = new Date(2026, 10, 23);
  const at = (h: number, m = 0) => new Date(2026, 10, 23, h, m);

  it("is closed on days the room is not available", () => {
    const monday = new Date(2026, 10, 23);
    const closed = room("d1", { available_days: [2] });
    expect(getRoomMapStatus(closed, [], monday, null)).toEqual({ kind: "closed" });
  });

  it("is busy until the end of the overlapping reservation", () => {
    const r = room("d1");
    const status = getRoomMapStatus(r, [reservation("d1", at(10), at(11))], day, {
      start: at(10, 30),
      end: at(11, 30),
    });
    expect(status).toEqual({ kind: "busy", until: at(11) });
  });

  it("is free until the next reservation", () => {
    const r = room("d1");
    const status = getRoomMapStatus(r, [reservation("d1", at(14), at(15))], day, {
      start: at(10),
      end: at(11),
    });
    expect(status).toEqual({ kind: "free", until: at(14), reservationCount: 1 });
  });

  it("ignores other rooms' reservations", () => {
    const status = getRoomMapStatus(
      room("d1"),
      [reservation("d2", at(10), at(11))],
      day,
      { start: at(10), end: at(11) },
    );
    expect(status.kind).toBe("free");
  });

  it("is free in a whole-day view even with reservations", () => {
    const status = getRoomMapStatus(
      room("d1"),
      [reservation("d1", at(10), at(11))],
      day,
      null,
    );
    expect(status).toEqual({ kind: "free", until: null, reservationCount: 1 });
  });
});

describe("getSlotChips", () => {
  const day = new Date(2026, 10, 23);
  const at = (h: number, m = 0) => new Date(2026, 10, 23, h, m);

  it("marks past, busy and free slots for the chosen duration", () => {
    const chips = getSlotChips(day, [reservation("d1", at(9), at(10))], 60, at(7, 30));
    const stateAt = (h: number, m = 0) =>
      chips.find((c) => c.start.getTime() === at(h, m).getTime())?.state;

    expect(stateAt(7)).toBe("past");
    expect(stateAt(8)).toBe("free");
    expect(stateAt(9)).toBe("busy");
    expect(stateAt(10)).toBe("free");
  });

  it("makes a slot busy when the longer duration would run into a reservation", () => {
    const chips = getSlotChips(day, [reservation("d1", at(10), at(11))], 120, at(7));
    const nineThirty = chips.find((c) => c.start.getTime() === at(9, 30).getTime());
    expect(nineThirty?.state).toBe("busy");
  });

  it("stops offering starts that would end after closing", () => {
    const chips = getSlotChips(day, [], 120, at(7));
    expect(chips.at(-1)?.end).toEqual(at(22));
  });
});

describe("getDayBarSegments", () => {
  const day = new Date(2026, 10, 23);
  const at = (h: number, m = 0) => new Date(2026, 10, 23, h, m);

  it("positions reservations as percentages of the 8-20 h bar", () => {
    const [segment] = getDayBarSegments([reservation("d1", at(11), at(14))], "d1", day);

    expect(segment.left).toBeCloseTo(25);
    expect(segment.width).toBeCloseTo(25);
    expect(segment.mine).toBe(false);
  });

  it("clips to the bar, ignores other rooms and out-of-range reservations, flags own ones", () => {
    const own = reservation("d1", at(7), at(9));
    const segments = getDayBarSegments(
      [own, reservation("d2", at(10), at(11)), reservation("d1", at(21), at(22))],
      "d1",
      day,
      new Set([own.id]),
    );

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ left: 0, mine: true });
    expect(segments[0].width).toBeCloseTo(100 / 12);
  });
});
