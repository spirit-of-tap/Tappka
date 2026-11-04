import { describe, expect, it } from "vitest"

import { summarizeAttendance, type AttendanceRecordInput, type AttendanceSessionInput } from "./attendance"

const NOW = new Date("2026-11-04T12:00:00.000Z")

function session(
  id: string,
  endsAt: string,
  cancelledAt: string | null = null,
): AttendanceSessionInput {
  return {
    id,
    startsAt: new Date(new Date(endsAt).getTime() - 4 * 60 * 60 * 1000).toISOString(),
    endsAt,
    cancelledAt,
  }
}

function record(sessionId: string, status: AttendanceRecordInput["status"]): AttendanceRecordInput {
  return { trainingSessionId: sessionId, status }
}

describe("summarizeAttendance", () => {
  it("returns an empty summary when no session has ended yet", () => {
    const summary = summarizeAttendance([session("future", "2026-11-05T10:00:00.000Z")], [], NOW)

    expect(summary).toEqual({
      heldCount: 0,
      attendedCount: 0,
      percent: 0,
    })
  })

  it("counts only ended, non-cancelled sessions", () => {
    const sessions = [
      session("held-1", "2026-10-06T10:00:00.000Z"),
      session("held-2", "2026-10-13T10:00:00.000Z"),
      session("cancelled", "2026-10-20T10:00:00.000Z", "2026-10-19T10:00:00.000Z"),
      session("future", "2026-11-10T10:00:00.000Z"),
    ]
    const records = [
      record("held-1", "present"),
      record("held-2", "present"),
      record("cancelled", "present"),
    ]

    const summary = summarizeAttendance(sessions, records, NOW)

    expect(summary.heldCount).toBe(2)
    expect(summary.attendedCount).toBe(2)
    expect(summary.percent).toBe(100)
  })

  it("counts present and late as attended, but not excused or absent", () => {
    const sessions = ["a", "b", "c", "d"].map((id, index) =>
      session(id, `2026-10-${String(6 + index).padStart(2, "0")}T10:00:00.000Z`),
    )
    const records = [record("a", "present"), record("b", "late"), record("c", "excused"), record("d", "absent")]

    const summary = summarizeAttendance(sessions, records, NOW)

    expect(summary.attendedCount).toBe(2)
    expect(summary.heldCount).toBe(4)
    expect(summary.percent).toBe(50)
  })

  it("treats a missing attendance record as not attended", () => {
    const sessions = [
      session("recorded", "2026-10-06T10:00:00.000Z"),
      session("unrecorded", "2026-10-13T10:00:00.000Z"),
    ]

    const summary = summarizeAttendance(sessions, [record("recorded", "present")], NOW)

    expect(summary.attendedCount).toBe(1)
    expect(summary.heldCount).toBe(2)
    expect(summary.percent).toBe(50)
  })

  it("reports exactly 80 % on the boundary", () => {
    const sessions = Array.from({ length: 10 }, (_, index) =>
      session(`s-${index}`, `2026-10-${String(6 + index).padStart(2, "0")}T10:00:00.000Z`),
    )
    const records = sessions.slice(0, 8).map((item) => record(item.id, "present"))

    expect(summarizeAttendance(sessions, records, NOW).percent).toBe(80)
  })

  it("rounds down so a value just below the target does not look met", () => {
    const sessions = Array.from({ length: 12 }, (_, index) =>
      session(`s-${index}`, `2026-10-${String(6 + index).padStart(2, "0")}T10:00:00.000Z`),
    )
    const records = sessions.slice(0, 9).map((item) => record(item.id, "present"))

    expect(summarizeAttendance(sessions, records, NOW).percent).toBe(75)
  })
})
