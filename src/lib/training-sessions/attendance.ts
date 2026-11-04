import { getMetric } from "@/lib/metrics/config"
import type { AttendanceStatus } from "@/lib/tymovy-denik/types"

const TRAINING_SESSION_METRIC = getMetric("training-session")

/** Attendance target shared with the metrics registry (80 %). */
export const TS_ATTENDANCE_TARGET_PERCENT = TRAINING_SESSION_METRIC.target ?? 80

const ATTENDED_STATUSES = new Set<AttendanceStatus>(["present", "late"])

export interface AttendanceSessionInput {
  id: string
  startsAt: string
  endsAt: string
  cancelledAt: string | null
}

export interface AttendanceRecordInput {
  trainingSessionId: string
  status: AttendanceStatus
}

export interface AttendanceSummary {
  /** Sessions that already ended this semester and were not cancelled. */
  heldCount: number
  /** Held sessions where the person was present (or arrived late). */
  attendedCount: number
  /**
   * Whole percent for display. Rounded down so a value just below the target
   * never renders as met.
   */
  percent: number
}

/**
 * Summarises one person's own-team TS attendance for a semester.
 *
 * Only ended, non-cancelled sessions count. Arriving late still means the person
 * came, so `present` and `late` both count; `excused`, `absent`, and an
 * unrecorded session count as not attended (the module treats unrecorded as
 * absent).
 */
export function summarizeAttendance(
  sessions: readonly AttendanceSessionInput[],
  records: readonly AttendanceRecordInput[],
  now: Date,
): AttendanceSummary {
  const heldSessions = sessions.filter(
    (session) =>
      session.cancelledAt === null && new Date(session.endsAt).getTime() <= now.getTime(),
  )
  const heldIds = new Set(heldSessions.map((session) => session.id))
  const attendedIds = new Set(
    records
      .filter(
        (record) => heldIds.has(record.trainingSessionId) && ATTENDED_STATUSES.has(record.status),
      )
      .map((record) => record.trainingSessionId),
  )

  const heldCount = heldSessions.length
  const attendedCount = attendedIds.size

  return {
    heldCount,
    attendedCount,
    percent: heldCount === 0 ? 0 : Math.floor((attendedCount / heldCount) * 100),
  }
}
