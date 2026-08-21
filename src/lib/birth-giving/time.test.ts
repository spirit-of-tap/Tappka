import { describe, expect, it } from "vitest";

import {
  calculateEventEnd,
  formatBirthGivingCountdown,
  getEventTimeState,
  isAssignmentReleased,
  parseBirthGivingDateTimeInput,
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

describe("formatBirthGivingCountdown", () => {
  it("formats whole hours with an exact hour unit", () => {
    expect(formatBirthGivingCountdown(3 * 60 * 60 * 1000)).toBe("3 h");
  });

  it("combines hours and minutes without leading zeros", () => {
    expect(formatBirthGivingCountdown(2 * 60 * 60 * 1000 + 5 * 60 * 1000)).toBe(
      "2 h 5 min",
    );
  });

  it("formats minutes alone below one hour", () => {
    expect(formatBirthGivingCountdown(45 * 60 * 1000)).toBe("45 min");
  });

  it("rounds a fraction of a minute up to keep a non-empty countdown", () => {
    expect(formatBirthGivingCountdown(61 * 1000)).toBe("1 min");
  });

  it("returns zero for a non-positive remaining time", () => {
    expect(formatBirthGivingCountdown(-1000)).toBe("0 min");
  });
});

describe("parseBirthGivingDateTimeInput", () => {
  it("parses a valid datetime-local value", () => {
    expect(parseBirthGivingDateTimeInput("2026-08-19T08:00")).toEqual(
      new Date("2026-08-19T08:00"),
    );
  });

  it("returns null for an invalid datetime-local value", () => {
    expect(parseBirthGivingDateTimeInput("2026-13-45T10:00")).toBeNull();
  });
});
