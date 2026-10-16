import { describe, expect, it } from "vitest"

import { getUpcomingTeamSlots } from "./slots"

const tuesday = { dayOfWeek: 2, startTime: "08:00:00", endTime: "12:00:00", validFrom: "2026-09-01", validUntil: "2026-12-31", roomId: "room-1" }

describe("getUpcomingTeamSlots", () => {
  const now = new Date("2026-10-02T08:00:00Z") // Friday

  it("returns the next weekly slots in UTC for Prague local time", () => {
    const slots = getUpcomingTeamSlots({ schedules: [tuesday], breaks: [], takenDateKeys: [], now, limit: 2 })
    expect(slots).toEqual([
      { dateKey: "2026-10-06", startsAt: "2026-10-06T06:00:00.000Z", endsAt: "2026-10-06T10:00:00.000Z", roomId: "room-1" },
      { dateKey: "2026-10-13", startsAt: "2026-10-13T06:00:00.000Z", endsAt: "2026-10-13T10:00:00.000Z", roomId: "room-1" },
    ])
  })
  it("handles the DST switch (CET after 25 Oct)", () => {
    const slots = getUpcomingTeamSlots({ schedules: [tuesday], breaks: [], takenDateKeys: [], now: new Date("2026-10-21T08:00:00Z"), limit: 1 })
    expect(slots[0].startsAt).toBe("2026-10-27T07:00:00.000Z")
  })
  it("skips breaks and dates that already have a TS", () => {
    const slots = getUpcomingTeamSlots({
      schedules: [tuesday],
      breaks: [{ startDate: "2026-10-12", endDate: "2026-10-16" }],
      takenDateKeys: ["2026-10-06"],
      now,
      limit: 1,
    })
    expect(slots[0].dateKey).toBe("2026-10-20")
  })
  it("respects validUntil and skips slots that already started today", () => {
    const slots = getUpcomingTeamSlots({
      schedules: [{ ...tuesday, validUntil: "2026-10-06" }],
      breaks: [],
      takenDateKeys: [],
      now: new Date("2026-10-06T07:00:00Z"),
    })
    expect(slots).toEqual([])
  })
  it("merges and sorts multiple schedules", () => {
    const thursday = { ...tuesday, dayOfWeek: 4, startTime: "13:00:00", endTime: "17:00:00", roomId: "room-2" }
    const slots = getUpcomingTeamSlots({ schedules: [thursday, tuesday], breaks: [], takenDateKeys: [], now, limit: 2 })
    expect(slots.map((s) => s.dateKey)).toEqual(["2026-10-06", "2026-10-08"])
  })
})
