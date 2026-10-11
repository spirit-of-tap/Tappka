import { describe, expect, it } from "vitest"

import {
  calendarSegments,
  dayDifference,
  minutesToClock,
  minutesToPx,
  movedRange,
  pragueMinuteOfDay,
  resizedEnd,
  snapMinutes,
  weekDayKeys,
} from "./calendar"

const NOW = new Date("2026-10-11T12:00:00Z")

describe("geometry", () => {
  it("maps minutes to pixels (48 px per hour) and snaps to 15 minutes within a day", () => {
    expect(minutesToPx(90)).toBe(72)
    expect(snapMinutes(52)).toBe(45)
    expect(snapMinutes(53)).toBe(60)
    expect(snapMinutes(-10)).toBe(0)
    expect(snapMinutes(1500)).toBe(1440)
  })

  it("formats clock labels", () => {
    expect(minutesToClock(0)).toBe("00:00")
    expect(minutesToClock(615)).toBe("10:15")
  })

  it("lists Monday-first week days and counts day differences", () => {
    expect(weekDayKeys("2026-10-05")).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ])
    expect(dayDifference("2026-10-24", "2026-10-26")).toBe(2)
  })

  it("reads the Prague wall clock (summer and winter time)", () => {
    expect(pragueMinuteOfDay(new Date("2026-07-01T08:30:00Z"))).toBe(10 * 60 + 30)
    expect(pragueMinuteOfDay(new Date("2026-12-01T08:30:00Z"))).toBe(9 * 60 + 30)
  })
})

describe("calendarSegments", () => {
  const days = weekDayKeys("2026-10-05")

  it("places an entry by its Prague start and length", () => {
    const [segment] = calendarSegments(
      [{ id: "e1", started_at: "2026-10-06T07:00:00Z", ended_at: "2026-10-06T08:30:00Z" }],
      days,
      NOW,
    )
    expect(segment).toEqual({
      entryId: "e1",
      dateKey: "2026-10-06",
      startMinute: 9 * 60,
      endMinute: 10 * 60 + 30,
      isFirst: true,
      isLast: true,
    })
  })

  it("splits an entry over midnight into two day segments", () => {
    const segments = calendarSegments(
      [{ id: "e2", started_at: "2026-10-06T21:00:00Z", ended_at: "2026-10-06T23:00:00Z" }],
      days,
      NOW,
    )
    expect(segments.map(({ dateKey, startMinute, endMinute, isFirst, isLast }) => ({ dateKey, startMinute, endMinute, isFirst, isLast }))).toEqual([
      { dateKey: "2026-10-06", startMinute: 23 * 60, endMinute: 24 * 60, isFirst: true, isLast: false },
      { dateKey: "2026-10-07", startMinute: 0, endMinute: 60, isFirst: false, isLast: true },
    ])
  })

  it("draws a running timer until now and skips days outside the week", () => {
    const segments = calendarSegments(
      [
        { id: "run", started_at: "2026-10-11T10:00:00Z", ended_at: null },
        { id: "old", started_at: "2026-09-01T10:00:00Z", ended_at: "2026-09-01T11:00:00Z" },
      ],
      days,
      NOW,
    )
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({ entryId: "run", startMinute: 12 * 60, endMinute: 14 * 60 })
  })
})

describe("moving and resizing", () => {
  const entry = { started_at: "2026-10-06T07:00:00Z", ended_at: "2026-10-06T08:00:00Z" }

  it("moves by days and minutes, keeping the length", () => {
    expect(movedRange(entry, 1, 30)).toEqual({
      startedAt: "2026-10-07T07:30:00.000Z",
      endedAt: "2026-10-07T08:30:00.000Z",
    })
  })

  it("keeps the wall-clock time when moving across the end of summer time", () => {
    // Sat 24. 10. 9:00 CEST → Mon 26. 10. 9:00 CET.
    const summer = { started_at: "2026-10-24T07:00:00Z", ended_at: "2026-10-24T08:00:00Z" }
    expect(movedRange(summer, 2, 0)).toEqual({
      startedAt: "2026-10-26T08:00:00.000Z",
      endedAt: "2026-10-26T09:00:00.000Z",
    })
  })

  it("never resizes below 15 minutes and refuses running timers", () => {
    expect(resizedEnd(entry, 45)).toBe("2026-10-06T08:45:00.000Z")
    expect(resizedEnd(entry, -120)).toBe("2026-10-06T07:15:00.000Z")
    expect(resizedEnd({ ...entry, ended_at: null }, 15)).toBeNull()
    expect(movedRange({ ...entry, ended_at: null }, 1, 0)).toBeNull()
  })
})
