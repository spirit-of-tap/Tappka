import { describe, expect, it } from "vitest"

import { getWeekRange } from "@/lib/time-tracking/week"

import { getCurrentSemesterRange, getCurrentWeekRange } from "./periods"

describe("getCurrentSemesterRange", () => {
  it("January belongs to the winter semester that started last September", () => {
    const { start, end } = getCurrentSemesterRange(new Date(2026, 0, 20))
    expect(start.getFullYear()).toBe(2025)
    expect(start.getMonth()).toBe(8) // September
    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth()).toBe(1) // February
  })

  it("February–August is the summer semester", () => {
    const { start, end } = getCurrentSemesterRange(new Date(2026, 4, 15))
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(1)
    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth()).toBe(8)
  })

  it("September starts a winter semester ending next February", () => {
    const { start, end } = getCurrentSemesterRange(new Date(2026, 8, 1))
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(8)
    expect(end.getFullYear()).toBe(2027)
    expect(end.getMonth()).toBe(1)
  })
})

describe("getCurrentWeekRange", () => {
  // Expectations are fixed UTC instants (not runtime-local `Date(y, m, d, ...)`
  // construction) so this suite passes identically whether the test runner's
  // time zone is Europe/Prague (a dev machine) or UTC (CI) — `getCurrentWeekRange`
  // always answers in Europe/Prague wall-clock time regardless of the runtime TZ.

  it("runs from Monday 00:00 to next Monday 00:00 Prague (exclusive), CEST", () => {
    // Thursday 2026-09-24 15:30 UTC (17:30 Prague, CEST)
    const { start, end } = getCurrentWeekRange(new Date("2026-09-24T15:30:00Z"))
    expect(start.toISOString()).toBe("2026-09-20T22:00:00.000Z")
    expect(end.toISOString()).toBe("2026-09-27T22:00:00.000Z")
  })

  it("treats Sunday late evening Prague as the end of the week that started Monday", () => {
    const { start, end } = getCurrentWeekRange(new Date("2026-09-27T21:30:00Z")) // Sun 23:30 Prague
    expect(start.toISOString()).toBe("2026-09-20T22:00:00.000Z")
    expect(end.toISOString()).toBe("2026-09-27T22:00:00.000Z")
  })

  it("starts a new week exactly at Monday 00:00 Prague", () => {
    const { start } = getCurrentWeekRange(new Date("2026-09-27T22:00:00Z")) // Mon 00:00 Prague
    expect(start.toISOString()).toBe("2026-09-27T22:00:00.000Z")
  })

  it("spans a year boundary (28 Dec 2026 – 4 Jan 2027, CET)", () => {
    const { start, end } = getCurrentWeekRange(new Date("2026-12-30T12:00:00Z"))
    expect(start.toISOString()).toBe("2026-12-27T23:00:00.000Z")
    expect(end.toISOString()).toBe("2027-01-03T23:00:00.000Z")
  })

  it("agrees with time-tracking/week.getWeekRange for a range of instants", () => {
    const instants = [
      "2026-09-20T22:00:00Z", // Monday 00:00 Prague, CEST
      "2026-09-24T15:30:00Z",
      "2026-09-27T21:59:00Z", // Sunday 23:59 Prague
      "2026-10-22T12:00:00Z", // DST week (CEST -> CET)
      "2027-03-25T12:00:00Z", // DST week (CET -> CEST)
      "2026-12-30T12:00:00Z", // year boundary
      "2027-01-06T12:00:00Z",
    ]
    for (const iso of instants) {
      const now = new Date(iso)
      const { start, end } = getCurrentWeekRange(now)
      const { from, to } = getWeekRange(now)
      expect(start.toISOString()).toBe(from.toISOString())
      expect(end.toISOString()).toBe(to.toISOString())
    }
  })
})
