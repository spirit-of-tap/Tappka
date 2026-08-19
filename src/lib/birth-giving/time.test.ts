import { describe, expect, it } from "vitest";

import {
  calculateEventEnd,
  getEventTimeState,
  isAssignmentReleased,
} from "./time";

const STARTS_AT = new Date("2026-08-19T08:00:00.000Z");

describe("calculateEventEnd", () => {
  it.each([
    ["8h", "2026-08-19T16:00:00.000Z"],
    ["24h", "2026-08-20T08:00:00.000Z"],
  ] as const)("calculates the end of a %s event", (duration, expected) => {
    expect(calculateEventEnd(STARTS_AT, duration)).toEqual(new Date(expected));
  });
});

describe("getEventTimeState", () => {
  it("is upcoming immediately before the start", () => {
    expect(
      getEventTimeState(STARTS_AT, "8h", new Date(STARTS_AT.getTime() - 1)),
    ).toBe("upcoming");
  });

  it("is active at the exact start", () => {
    expect(getEventTimeState(STARTS_AT, "8h", STARTS_AT)).toBe("active");
  });

  it("is active immediately before the end", () => {
    const endsAt = calculateEventEnd(STARTS_AT, "8h");

    expect(
      getEventTimeState(STARTS_AT, "8h", new Date(endsAt.getTime() - 1)),
    ).toBe("active");
  });

  it("is ended at the exact end", () => {
    expect(
      getEventTimeState(
        STARTS_AT,
        "8h",
        new Date("2026-08-19T16:00:00.000Z"),
      ),
    ).toBe("ended");
  });
});

describe("isAssignmentReleased", () => {
  it("is false immediately before the start", () => {
    expect(
      isAssignmentReleased(STARTS_AT, new Date(STARTS_AT.getTime() - 1)),
    ).toBe(false);
  });

  it("is true at the exact start", () => {
    expect(isAssignmentReleased(STARTS_AT, STARTS_AT)).toBe(true);
  });
});
