import { describe, expect, it } from "vitest"

import {
  countFacilitations,
  formatLeadTime,
  startedSessions,
  summarizeTeamAttendance,
  summarizePreparation,
  type StatsPerson,
  type StatsSession,
} from "./stats"

const A: StatsPerson = { id: "a", name: "Adéla" }
const B: StatsPerson = { id: "b", name: "Bára" }
const C: StatsPerson = { id: "c", name: "Cyril" }
const X: StatsPerson = { id: "x", name: "Xaver" }

const START = "2026-11-10T10:00:00.000Z"
const HOUR_MS = 60 * 60 * 1000

let seq = 0
function session(overrides: Partial<StatsSession> = {}): StatsSession {
  seq += 1
  return {
    id: `s${seq}`,
    topic: `TS ${seq}`,
    startsAt: START,
    facilitators: [],
    preparationPublishedAt: null,
    attendance: [],
    ...overrides,
  }
}

function hoursBefore(hours: number): string {
  return new Date(new Date(START).getTime() - hours * HOUR_MS).toISOString()
}

describe("startedSessions", () => {
  it("keeps only sessions that already started", () => {
    const past = session({ startsAt: "2026-11-01T10:00:00Z" })
    const future = session({ startsAt: "2026-12-01T10:00:00Z" })
    expect(startedSessions([past, future], new Date("2026-11-08T10:00:00Z"))).toEqual([past])
  })
})

describe("countFacilitations", () => {
  it("counts facilitations including members with zero, highest first", () => {
    const rows = countFacilitations([session({ facilitators: [A, B] }), session({ facilitators: [A] })], [A, B, C])
    expect(rows.map((r) => [r.person.id, r.count])).toEqual([
      ["a", 2],
      ["b", 1],
      ["c", 0],
    ])
  })

  it("keeps a former member who facilitated, after current members", () => {
    const rows = countFacilitations([session({ facilitators: [X] })], [A])
    expect(rows.map((r) => [r.person.id, r.isFormerMember])).toEqual([
      ["a", false],
      ["x", true],
    ])
  })
})

describe("summarizePreparation", () => {
  it("buckets příprava lead time and averages published ones", () => {
    const { buckets, averageLeadHours } = summarizePreparation([
      session({ preparationPublishedAt: hoursBefore(96) }),
      session({ preparationPublishedAt: hoursBefore(48) }),
      session({ preparationPublishedAt: hoursBefore(5) }),
      session({ preparationPublishedAt: hoursBefore(-1) }),
      session({ preparationPublishedAt: null }),
    ])
    expect(buckets).toEqual({ "3plus": 1, "1to3": 1, under1: 1, late: 1, missing: 1 })
    expect(averageLeadHours).toBeCloseTo((96 + 48 + 5 - 1) / 4)
  })

  it("puts exactly 72 h and 24 h into the higher bucket", () => {
    const { buckets } = summarizePreparation([
      session({ preparationPublishedAt: hoursBefore(72) }),
      session({ preparationPublishedAt: hoursBefore(24) }),
    ])
    expect(buckets["3plus"]).toBe(1)
    expect(buckets["1to3"]).toBe(1)
  })

  it("returns a null average when nothing was published", () => {
    expect(summarizePreparation([session({ preparationPublishedAt: null })]).averageLeadHours).toBeNull()
  })
})

describe("summarizeTeamAttendance", () => {
  it("counts a current member without a row in a recorded TS as absent", () => {
    const { perMember } = summarizeTeamAttendance(
      [session({ attendance: [{ profileId: "a", status: "present" }] })],
      [A, B],
    )
    const b = perMember.find((r) => r.person.id === "b")
    expect(b?.counts.absent).toBe(1)
    expect(b?.rate).toBe(0)
  })

  it("ignores unrecorded TS and guests, and reports the gap", () => {
    const summary = summarizeTeamAttendance(
      [
        session({ attendance: [] }),
        session({
          attendance: [
            { profileId: "a", status: "late" },
            { profileId: "guest", status: "present" },
          ],
        }),
      ],
      [A, B],
    )
    expect(summary.unrecordedCount).toBe(1)
    expect(summary.overTime.map((p) => p.rate)).toEqual([0.5])
    expect(summary.perMember[0].person.id).toBe("b")
  })

  it("counts excused as not attending", () => {
    const { perMember } = summarizeTeamAttendance([session({ attendance: [{ profileId: "a", status: "excused" }] })], [A])
    expect(perMember[0].counts.excused).toBe(1)
    expect(perMember[0].rate).toBe(0)
  })

  it("handles no sessions without NaN", () => {
    const summary = summarizeTeamAttendance([], [A])
    expect(summary.perMember[0].rate).toBeNull()
    expect(summary.overTime).toEqual([])
    expect(summary.unrecordedCount).toBe(0)
  })
})

describe("formatLeadTime", () => {
  it("formats lead time in Czech", () => {
    expect(formatLeadTime(5)).toBe("5 h")
    expect(formatLeadTime(24)).toBe("1 den")
    expect(formatLeadTime(48)).toBe("2 dny")
    expect(formatLeadTime(57.6)).toBe("2,4 dne")
    expect(formatLeadTime(120)).toBe("5 dní")
  })

  it("formats negative lead time by its size", () => {
    expect(formatLeadTime(-3)).toBe("3 h")
  })
})
