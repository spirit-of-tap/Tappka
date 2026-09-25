import { describe, expect, it } from "vitest"

import type { TimeEntry } from "./types"
import {
  getWeekRange,
  groupEntriesByDay,
  pragueDayStart,
  shiftWeekRange,
  splitEntryAcrossDays,
  summarize,
  toPragueDateKey,
} from "./week"

const MINUTE = 60_000
const HOUR = 60 * MINUTE

let idCounter = 0

function entry(overrides: Partial<TimeEntry> & Pick<TimeEntry, "started_at">): TimeEntry {
  idCounter += 1
  const ended = overrides.ended_at === undefined ? null : overrides.ended_at
  return {
    id: `entry-${idCounter}`,
    profile_id: "profile-1",
    direction: "practise",
    tag_id: null,
    title: null,
    duration_ms: ended === null ? null : Date.parse(ended) - Date.parse(overrides.started_at),
    source: "manual",
    attendance_id: null,
    created_at: overrides.started_at,
    updated_at: overrides.started_at,
    created_by_profile_id: "profile-1",
    updated_by_profile_id: "profile-1",
    ...overrides,
    ended_at: ended,
  }
}

describe("getWeekRange", () => {
  it("returns Monday 00:00 to next Monday 00:00 in Prague (CEST)", () => {
    const range = getWeekRange(new Date("2026-09-24T10:00:00Z"))
    expect(range.from.toISOString()).toBe("2026-09-20T22:00:00.000Z")
    expect(range.to.toISOString()).toBe("2026-09-27T22:00:00.000Z")
  })

  it("keeps Sunday 23:30 Prague in the same week and moves Monday 00:30 to the next", () => {
    expect(getWeekRange(new Date("2026-09-27T21:30:00Z")).from.toISOString()).toBe("2026-09-20T22:00:00.000Z")
    expect(getWeekRange(new Date("2026-09-27T22:30:00Z")).from.toISOString()).toBe("2026-09-27T22:00:00.000Z")
  })

  it("treats Monday 00:00 Prague as the first instant of the week", () => {
    expect(getWeekRange(new Date("2026-09-20T22:00:00Z")).from.toISOString()).toBe("2026-09-20T22:00:00.000Z")
  })

  it("handles the DST change inside the week (CEST → CET)", () => {
    const range = getWeekRange(new Date("2026-10-22T12:00:00Z"))
    expect(range.from.toISOString()).toBe("2026-10-18T22:00:00.000Z")
    expect(range.to.toISOString()).toBe("2026-10-25T23:00:00.000Z")
  })

  it("works in winter (CET)", () => {
    const range = getWeekRange(new Date("2027-01-06T12:00:00Z"))
    expect(range.from.toISOString()).toBe("2027-01-03T23:00:00.000Z")
    expect(range.to.toISOString()).toBe("2027-01-10T23:00:00.000Z")
  })

  it("spans exactly 169 hours for the CEST->CET DST week of 2026-10-25", () => {
    const range = getWeekRange(new Date("2026-10-22T12:00:00Z"))
    expect(range.from.toISOString()).toBe("2026-10-18T22:00:00.000Z")
    expect(range.to.toISOString()).toBe("2026-10-25T23:00:00.000Z")
    expect(range.to.getTime() - range.from.getTime()).toBe(169 * HOUR)
  })

  it("spans exactly 167 hours for the CET->CEST DST week of 2027-03-28", () => {
    const range = getWeekRange(new Date("2027-03-25T12:00:00Z"))
    expect(range.from.toISOString()).toBe("2027-03-21T23:00:00.000Z")
    expect(range.to.toISOString()).toBe("2027-03-28T22:00:00.000Z")
    expect(range.to.getTime() - range.from.getTime()).toBe(167 * HOUR)
  })

  it("treats a UTC instant that is already Monday in Prague as the new week", () => {
    // Sunday 23:30 UTC == Monday 01:30 Prague (CEST, +2h)
    const range = getWeekRange(new Date("2026-09-20T23:30:00Z"))
    expect(range.from.toISOString()).toBe("2026-09-20T22:00:00.000Z")
    expect(range.to.toISOString()).toBe("2026-09-27T22:00:00.000Z")
  })

  it("spans a year boundary (28 Dec 2026 – 4 Jan 2027)", () => {
    const range = getWeekRange(new Date("2026-12-30T12:00:00Z"))
    expect(range.from.toISOString()).toBe("2026-12-27T23:00:00.000Z")
    expect(range.to.toISOString()).toBe("2027-01-03T23:00:00.000Z")
  })
})

describe("shiftWeekRange", () => {
  it("moves by whole weeks", () => {
    const current = getWeekRange(new Date("2026-09-24T10:00:00Z"))
    expect(shiftWeekRange(current, -1).from.toISOString()).toBe("2026-09-13T22:00:00.000Z")
    expect(shiftWeekRange(current, 5).from.toISOString()).toBe("2026-10-25T23:00:00.000Z")
  })

  it("keeps Monday 00:00 Prague when shifting ±1 across the autumn DST change", () => {
    const dstWeek = getWeekRange(new Date("2026-10-22T12:00:00Z"))
    const next = shiftWeekRange(dstWeek, 1)
    expect(next.from.toISOString()).toBe("2026-10-25T23:00:00.000Z")
    expect(next.to.toISOString()).toBe("2026-11-01T23:00:00.000Z")

    const prev = shiftWeekRange(dstWeek, -1)
    expect(prev.from.toISOString()).toBe("2026-10-11T22:00:00.000Z")
    expect(prev.to.toISOString()).toBe("2026-10-18T22:00:00.000Z")
  })

  it("keeps Monday 00:00 Prague when shifting ±1 across the spring DST change", () => {
    const dstWeek = getWeekRange(new Date("2027-03-25T12:00:00Z"))
    const next = shiftWeekRange(dstWeek, 1)
    expect(next.from.toISOString()).toBe("2027-03-28T22:00:00.000Z")
    expect(next.to.toISOString()).toBe("2027-04-04T22:00:00.000Z")

    const prev = shiftWeekRange(dstWeek, -1)
    expect(prev.from.toISOString()).toBe("2027-03-14T23:00:00.000Z")
    expect(prev.to.toISOString()).toBe("2027-03-21T23:00:00.000Z")
  })
})

describe("toPragueDateKey / pragueDayStart", () => {
  it("uses the Prague calendar day", () => {
    expect(toPragueDateKey("2026-09-24T21:30:00Z")).toBe("2026-09-24")
    expect(toPragueDateKey("2026-09-24T22:30:00Z")).toBe("2026-09-25")
  })
  it("returns Prague midnight for a date key", () => {
    expect(pragueDayStart("2026-09-24")?.toISOString()).toBe("2026-09-23T22:00:00.000Z")
    expect(pragueDayStart("2026-12-24")?.toISOString()).toBe("2026-12-23T23:00:00.000Z")
  })
  it("rejects invalid keys", () => {
    expect(pragueDayStart("2026-02-30")).toBeNull()
    expect(pragueDayStart("nope")).toBeNull()
  })

  it("resolves the calendar day across the spring-forward gap (2027-03-28 02:00->03:00, wall time 02:30 never occurs)", () => {
    // 00:59 UTC = 01:59 CET (just before the jump), 01:00 UTC = 03:00 CEST (just after)
    expect(toPragueDateKey("2027-03-28T00:59:00Z")).toBe("2027-03-28")
    expect(toPragueDateKey("2027-03-28T01:00:00Z")).toBe("2027-03-28")
  })

  it("resolves the calendar day across the fall-back overlap (2026-10-25 03:00->02:00, wall time 02:30 occurs twice)", () => {
    // 00:30 UTC = 02:30 CEST (first occurrence), 01:30 UTC = 02:30 CET (second occurrence)
    expect(toPragueDateKey("2026-10-25T00:30:00Z")).toBe("2026-10-25")
    expect(toPragueDateKey("2026-10-25T01:30:00Z")).toBe("2026-10-25")
  })

  it("returns the correct midnight instant either side of a DST change", () => {
    expect(pragueDayStart("2027-03-28")?.toISOString()).toBe("2027-03-27T23:00:00.000Z")
    expect(pragueDayStart("2027-03-29")?.toISOString()).toBe("2027-03-28T22:00:00.000Z")
    expect(pragueDayStart("2026-10-25")?.toISOString()).toBe("2026-10-24T22:00:00.000Z")
    expect(pragueDayStart("2026-10-26")?.toISOString()).toBe("2026-10-25T23:00:00.000Z")
  })
})

describe("groupEntriesByDay", () => {
  it("orders days newest first and entries newest first, running timer on top", () => {
    const mondayMorning = entry({ started_at: "2026-09-21T06:00:00Z", ended_at: "2026-09-21T07:00:00Z" })
    const thursdayEarly = entry({ started_at: "2026-09-24T06:00:00Z", ended_at: "2026-09-24T07:00:00Z" })
    const thursdayLate = entry({ started_at: "2026-09-24T12:00:00Z", ended_at: "2026-09-24T13:00:00Z" })
    const running = entry({ started_at: "2026-09-24T08:00:00Z", ended_at: null })

    const groups = groupEntriesByDay([mondayMorning, thursdayEarly, running, thursdayLate])

    expect(groups.map((g) => g.dateKey)).toEqual(["2026-09-24", "2026-09-21"])
    expect(groups[0]?.entries.map((e) => e.id)).toEqual([running.id, thursdayLate.id, thursdayEarly.id])
    expect(groups[1]?.entries.map((e) => e.id)).toEqual([mondayMorning.id])
  })

  it("groups by the Prague start day", () => {
    const lateNight = entry({ started_at: "2026-09-24T22:30:00Z", ended_at: "2026-09-24T23:00:00Z" })
    expect(groupEntriesByDay([lateNight])[0]?.dateKey).toBe("2026-09-25")
  })

  it("returns no groups for no entries", () => {
    expect(groupEntriesByDay([])).toEqual([])
  })

  it("puts an entry that crosses midnight under its start day only", () => {
    // Starts 23:00 Prague on the 24th, ends 01:00 Prague on the 25th.
    const crossing = entry({ started_at: "2026-09-24T21:00:00Z", ended_at: "2026-09-24T23:00:00Z" })
    const groups = groupEntriesByDay([crossing])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.dateKey).toBe("2026-09-24")
  })

  it("keeps a stable relative order for entries with identical started_at", () => {
    const first = entry({ started_at: "2026-09-24T06:00:00Z", ended_at: "2026-09-24T07:00:00Z" })
    const second = entry({ started_at: "2026-09-24T06:00:00Z", ended_at: "2026-09-24T07:30:00Z" })
    const third = entry({ started_at: "2026-09-24T06:00:00Z", ended_at: "2026-09-24T08:00:00Z" })
    const groups = groupEntriesByDay([first, second, third])
    expect(groups[0]?.entries.map((e) => e.id)).toEqual([first.id, second.id, third.id])
  })
})

describe("splitEntryAcrossDays", () => {
  it("splits 23:00–01:00 Prague into two segments", () => {
    const segments = splitEntryAcrossDays({ started_at: "2026-09-24T21:00:00Z", ended_at: "2026-09-24T23:00:00Z" })
    expect(segments).toHaveLength(2)
    expect(segments[0]).toMatchObject({
      dateKey: "2026-09-24",
      durationMs: HOUR,
      continuesNextDay: true,
      continuedFromPreviousDay: false,
    })
    expect(segments[0]?.end.toISOString()).toBe("2026-09-24T22:00:00.000Z")
    expect(segments[1]).toMatchObject({
      dateKey: "2026-09-25",
      durationMs: HOUR,
      continuesNextDay: false,
      continuedFromPreviousDay: true,
    })
  })

  it("keeps a single-day entry as one segment", () => {
    const segments = splitEntryAcrossDays({ started_at: "2026-09-24T08:00:00Z", ended_at: "2026-09-24T09:30:00Z" })
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({ dateKey: "2026-09-24", durationMs: 90 * MINUTE, continuesNextDay: false })
  })

  it("measures a running entry up to now", () => {
    const segments = splitEntryAcrossDays(
      { started_at: "2026-09-24T21:30:00Z", ended_at: null },
      new Date("2026-09-24T22:15:00Z"),
    )
    expect(segments.map((s) => s.durationMs)).toEqual([30 * MINUTE, 15 * MINUTE])
  })

  it("splits a 3-day entry into three segments whose durations sum to the whole", () => {
    // Starts Thu 10:00 Prague, ends Sat 10:00 Prague (2026-09-24 08:00Z .. 2026-09-26 08:00Z)
    const started_at = "2026-09-24T08:00:00Z"
    const ended_at = "2026-09-26T08:00:00Z"
    const segments = splitEntryAcrossDays({ started_at, ended_at })
    expect(segments.map((s) => s.dateKey)).toEqual(["2026-09-24", "2026-09-25", "2026-09-26"])
    expect(segments[0]).toMatchObject({ continuedFromPreviousDay: false, continuesNextDay: true })
    expect(segments[1]).toMatchObject({ continuedFromPreviousDay: true, continuesNextDay: true })
    expect(segments[2]).toMatchObject({ continuedFromPreviousDay: true, continuesNextDay: false })
    const total = segments.reduce((sum, s) => sum + s.durationMs, 0)
    expect(total).toBe(Date.parse(ended_at) - Date.parse(started_at))
  })

  it("keeps a single segment when the entry ends exactly at Prague midnight", () => {
    // Starts 22:00 Prague, ends exactly at the next midnight (00:00 Prague).
    const segments = splitEntryAcrossDays({ started_at: "2026-09-24T20:00:00Z", ended_at: "2026-09-24T22:00:00Z" })
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({ dateKey: "2026-09-24", durationMs: 2 * HOUR, continuesNextDay: false })
  })

  it("returns a zero-duration segment when the entry is empty (end <= start)", () => {
    const segments = splitEntryAcrossDays({ started_at: "2026-09-24T08:00:00Z", ended_at: "2026-09-24T08:00:00Z" })
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({ durationMs: 0, continuesNextDay: false, continuedFromPreviousDay: false })
  })
})

describe("summarize", () => {
  const training = entry({ direction: "training", started_at: "2026-09-21T06:00:00Z", ended_at: "2026-09-21T08:00:00Z" })
  const reading = entry({
    direction: "reading",
    tag_id: "tag-a",
    started_at: "2026-09-22T06:00:00Z",
    ended_at: "2026-09-22T07:00:00Z",
  })
  const practise = entry({
    direction: "practise",
    tag_id: "tag-a",
    started_at: "2026-09-23T06:00:00Z",
    ended_at: "2026-09-23T06:30:00Z",
  })
  const running = entry({ direction: "practise", started_at: "2026-09-24T06:00:00Z", ended_at: null })

  it("sums totals per direction and per tag, ignoring running timers by default", () => {
    const summary = summarize([training, reading, practise, running])
    expect(summary.totalMs).toBe(3.5 * HOUR)
    expect(summary.byDirection).toEqual({ training: 2 * HOUR, reading: HOUR, practise: 30 * MINUTE })
    expect(summary.byTag.get("tag-a")).toBe(90 * MINUTE)
    expect(summary.byTag.get(null)).toBe(2 * HOUR)
  })

  it("includes running timers up to now when asked", () => {
    const summary = summarize([running], { includeRunning: true, now: new Date("2026-09-24T06:45:00Z") })
    expect(summary.totalMs).toBe(45 * MINUTE)
    expect(summary.byDirection.practise).toBe(45 * MINUTE)
  })

  it("clips entries to the given range", () => {
    const crossingWeekStart = entry({
      direction: "training",
      started_at: "2026-09-20T21:00:00Z",
      ended_at: "2026-09-20T23:00:00Z",
    })
    const range = getWeekRange(new Date("2026-09-24T10:00:00Z"))
    expect(summarize([crossingWeekStart], { range }).totalMs).toBe(HOUR)
  })

  it("clips an entry straddling range.to to the part inside the range", () => {
    const range = getWeekRange(new Date("2026-09-24T10:00:00Z")) // ends 2026-09-27T22:00:00Z
    const crossingWeekEnd = entry({
      direction: "reading",
      started_at: "2026-09-27T21:00:00Z",
      ended_at: "2026-09-27T23:00:00Z",
    })
    const summary = summarize([crossingWeekEnd], { range })
    expect(summary.totalMs).toBe(HOUR)
    expect(summary.byDirection.reading).toBe(HOUR)
  })

  it("counts an entry fully outside the range as zero and excludes it from byTag", () => {
    const range = getWeekRange(new Date("2026-09-24T10:00:00Z"))
    const before = entry({
      tag_id: "tag-a",
      started_at: "2026-09-10T06:00:00Z",
      ended_at: "2026-09-10T07:00:00Z",
    })
    const after = entry({
      tag_id: "tag-b",
      started_at: "2026-10-10T06:00:00Z",
      ended_at: "2026-10-10T07:00:00Z",
    })
    const summary = summarize([before, after], { range })
    expect(summary.totalMs).toBe(0)
    expect(summary.byTag.size).toBe(0)
  })

  it("clips a running timer to range.to when now is after the range end", () => {
    const range = getWeekRange(new Date("2026-09-24T10:00:00Z")) // ends 2026-09-27T22:00:00Z
    const stillRunning = entry({ started_at: "2026-09-27T20:00:00Z", ended_at: null })
    const summary = summarize([stillRunning], {
      range,
      includeRunning: true,
      now: new Date("2026-09-28T05:00:00Z"), // well after range.to
    })
    expect(summary.totalMs).toBe(2 * HOUR) // 20:00 -> 22:00 (range.to)
  })

  it("clips a running timer to now when now is before range.to", () => {
    const range = getWeekRange(new Date("2026-09-24T10:00:00Z")) // ends 2026-09-27T22:00:00Z
    const stillRunning = entry({ started_at: "2026-09-27T20:00:00Z", ended_at: null })
    const summary = summarize([stillRunning], {
      range,
      includeRunning: true,
      now: new Date("2026-09-27T20:45:00Z"),
    })
    expect(summary.totalMs).toBe(45 * MINUTE)
  })

  it("ignores a running timer within range when includeRunning is false", () => {
    const range = getWeekRange(new Date("2026-09-24T10:00:00Z"))
    const stillRunning = entry({ started_at: "2026-09-27T20:00:00Z", ended_at: null })
    const summary = summarize([stillRunning], { range, includeRunning: false })
    expect(summary.totalMs).toBe(0)
  })

  it("keeps byDirection and byTag sums equal to the total", () => {
    const summary = summarize([training, reading, practise])
    const directionSum = Object.values(summary.byDirection).reduce((a, b) => a + b, 0)
    const tagSum = [...summary.byTag.values()].reduce((a, b) => a + b, 0)
    expect(directionSum).toBe(summary.totalMs)
    expect(tagSum).toBe(summary.totalMs)
  })

  it("returns zeros for no entries", () => {
    const summary = summarize([])
    expect(summary.totalMs).toBe(0)
    expect(summary.byDirection).toEqual({ training: 0, reading: 0, practise: 0 })
    expect(summary.byTag.size).toBe(0)
  })
})
