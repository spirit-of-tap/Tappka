import { describe, expect, it } from "vitest"

import { breakdownByDay, remainingHours, topDirection } from "./day-breakdown"
import type { TimeDirection } from "./types"

const WEEK = { from: "2026-09-21", to: "2026-09-27" }
const NOW = new Date("2026-09-25T12:00:00Z")
const MS_PER_HOUR = 3_600_000

function byDirection(overrides: Partial<Record<TimeDirection, number>>): Record<TimeDirection, number> {
  return { training: 0, reading: 0, practise: 0, project: 0, ...overrides }
}

describe("breakdownByDay", () => {
  it("returns one bucket per day of the range, empty when nothing was tracked", () => {
    const days = breakdownByDay([], WEEK, NOW)

    expect(days).toHaveLength(7)
    expect(days[0].dateKey).toBe("2026-09-21")
    expect(days[6].dateKey).toBe("2026-09-27")
    expect(days.every((day) => day.totalMs === 0)).toBe(true)
  })

  it("sums time per direction on the Prague day an entry falls in", () => {
    const days = breakdownByDay(
      [
        { direction: "training", started_at: "2026-09-21T07:00:00Z", ended_at: "2026-09-21T09:00:00Z" },
        { direction: "reading", started_at: "2026-09-21T10:00:00Z", ended_at: "2026-09-21T11:30:00Z" },
        { direction: "reading", started_at: "2026-09-23T10:00:00Z", ended_at: "2026-09-23T11:00:00Z" },
      ],
      WEEK,
      NOW,
    )

    expect(days[0].totalMs).toBe(3.5 * MS_PER_HOUR)
    expect(days[0].byDirection).toEqual(byDirection({ training: 2 * MS_PER_HOUR, reading: 1.5 * MS_PER_HOUR }))
    expect(days[2].byDirection.reading).toBe(MS_PER_HOUR)
  })

  it("splits an entry across midnight and drops time outside the range", () => {
    const days = breakdownByDay(
      [{ direction: "practise", started_at: "2026-09-20T21:00:00Z", ended_at: "2026-09-20T23:00:00Z" }],
      WEEK,
      NOW,
    )

    // 23:00–01:00 Prague: only the hour after midnight falls into Monday.
    expect(days[0].byDirection.practise).toBe(MS_PER_HOUR)
  })

  it("measures a running entry up to now", () => {
    const days = breakdownByDay(
      [{ direction: "project", started_at: "2026-09-25T11:30:00Z", ended_at: null }],
      WEEK,
      NOW,
    )

    expect(days[4].byDirection.project).toBe(30 * 60_000)
  })
})

describe("topDirection", () => {
  it("picks the direction with the most time", () => {
    expect(topDirection(byDirection({ training: 1, practise: 5, project: 2 }))).toBe("practise")
  })

  it("prefers the earlier direction on a tie", () => {
    expect(topDirection(byDirection({ reading: 3, project: 3 }))).toBe("reading")
  })

  it("returns null when nothing was tracked", () => {
    expect(topDirection(byDirection({}))).toBeNull()
  })
})

describe("remainingHours", () => {
  it("returns the missing hours", () => {
    expect(remainingHours(16.5, 40)).toBe(23.5)
  })

  it("never goes negative", () => {
    expect(remainingHours(45, 40)).toBe(0)
  })
})
