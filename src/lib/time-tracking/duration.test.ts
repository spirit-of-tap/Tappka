import { describe, expect, it } from "vitest"

import {
  computeDurationMs,
  entryDurationMs,
  formatDurationHms,
  formatDurationShort,
  parseDurationInput,
} from "./duration"

const MINUTE = 60_000
const HOUR = 60 * MINUTE

describe("formatDurationHms", () => {
  it("formats hours, minutes and seconds", () => {
    expect(formatDurationHms(5_400_000)).toBe("01:30:00")
    expect(formatDurationHms(3_723_000)).toBe("01:02:03")
  })
  it("handles zero, negatives and >24 h", () => {
    expect(formatDurationHms(0)).toBe("00:00:00")
    expect(formatDurationHms(-5)).toBe("00:00:00")
    expect(formatDurationHms(30 * HOUR)).toBe("30:00:00")
  })
  it("floors partial seconds", () => {
    expect(formatDurationHms(1_999)).toBe("00:00:01")
  })
  it("does not wrap or truncate at 100 hours", () => {
    expect(formatDurationHms(100 * HOUR)).toBe("100:00:00")
  })
  it("formats 59 seconds without rounding up to a minute", () => {
    expect(formatDurationHms(59_000)).toBe("00:00:59")
  })
})

describe("formatDurationShort", () => {
  it("formats hours and minutes", () => {
    expect(formatDurationShort(5_400_000)).toBe("1 h 30 min")
    expect(formatDurationShort(60_000)).toBe("1 min")
    expect(formatDurationShort(2 * HOUR)).toBe("2 h")
  })
  it("handles sub-minute and zero", () => {
    expect(formatDurationShort(0)).toBe("0 min")
    expect(formatDurationShort(30_000)).toBe("< 1 min")
    expect(formatDurationShort(59_000)).toBe("< 1 min")
  })
  it("treats exactly 60 seconds as 1 minute, not '< 1 min'", () => {
    expect(formatDurationShort(60_000)).toBe("1 min")
  })
  it("formats hours beyond a day without wrapping (25 h 5 min)", () => {
    expect(formatDurationShort(25 * HOUR + 5 * MINUTE)).toBe("25 h 5 min")
  })
})

describe("parseDurationInput", () => {
  it("parses unit forms", () => {
    expect(parseDurationInput("1h 30m")).toBe(5_400_000)
    expect(parseDurationInput("1h30m")).toBe(5_400_000)
    expect(parseDurationInput("1 h 30 min")).toBe(5_400_000)
    expect(parseDurationInput("2h")).toBe(2 * HOUR)
    expect(parseDurationInput("45m")).toBe(45 * MINUTE)
    expect(parseDurationInput("1,5h")).toBe(90 * MINUTE)
    expect(parseDurationInput("1.5H")).toBe(90 * MINUTE)
  })
  it("parses bare minutes and clock form", () => {
    expect(parseDurationInput("90")).toBe(5_400_000)
    expect(parseDurationInput(" 90 ")).toBe(5_400_000)
    expect(parseDurationInput("1:30")).toBe(5_400_000)
    expect(parseDurationInput("90m")).toBe(5_400_000)
  })
  it("parses additional unit spacing and comma-decimal forms", () => {
    expect(parseDurationInput("1 h 30 m")).toBe(5_400_000)
    expect(parseDurationInput("1,5 h")).toBe(90 * MINUTE)
  })
  // `null` documents "not a usable duration": empty input, zero, or text that
  // does not match any of the accepted forms (unit, clock, or bare minutes).
  it("returns null for zero, empty and garbage", () => {
    expect(parseDurationInput("0")).toBeNull()
    expect(parseDurationInput("0h 0m")).toBeNull()
    expect(parseDurationInput("")).toBeNull()
    expect(parseDurationInput("abc")).toBeNull()
    expect(parseDurationInput("h")).toBeNull()
    expect(parseDurationInput("1:75")).toBeNull()
    expect(parseDurationInput("-5")).toBeNull()
  })
})

describe("computeDurationMs", () => {
  it("computes the difference between ISO timestamps", () => {
    expect(computeDurationMs("2026-09-24T08:00:00.000Z", "2026-09-24T09:30:00.000Z")).toBe(5_400_000)
    expect(computeDurationMs("2026-09-24T10:00:00+02:00", "2026-09-24T08:00:01.250Z")).toBe(1_250)
  })
  it("preserves millisecond precision across mixed offset notations", () => {
    expect(computeDurationMs("2026-09-24T08:00:00.100Z", "2026-09-24T08:00:00.900Z")).toBe(800)
    expect(computeDurationMs("2026-09-24T10:00:00.000+02:00", "2026-09-24T08:00:00.500Z")).toBe(500)
  })
})

describe("entryDurationMs", () => {
  it("uses stored duration for finished entries", () => {
    expect(
      entryDurationMs({ started_at: "2026-09-24T08:00:00Z", ended_at: "2026-09-24T09:00:00Z", duration_ms: HOUR }),
    ).toBe(HOUR)
  })
  it("measures running entries against now", () => {
    expect(
      entryDurationMs(
        { started_at: "2026-09-24T08:00:00Z", ended_at: null, duration_ms: null },
        new Date("2026-09-24T08:10:00Z"),
      ),
    ).toBe(10 * MINUTE)
  })
})
