import { TIME_DIRECTION_VALUES } from "./constants"
import { addDaysToKey, type DateKeyRange, rangeDayCount } from "./date-range"
import type { TimeDirection, TimeEntry } from "./types"
import { splitEntryAcrossDays } from "./week"

export interface DayBreakdown {
  /** Prague calendar day, `YYYY-MM-DD`. */
  dateKey: string
  totalMs: number
  byDirection: Record<TimeDirection, number>
}

function emptyByDirection(): Record<TimeDirection, number> {
  const result = {} as Record<TimeDirection, number>
  for (const direction of TIME_DIRECTION_VALUES) result[direction] = 0
  return result
}

/**
 * One bucket per day of the inclusive range with the time per direction. Entries are split at
 * Prague midnights; running entries are measured up to `now`; time outside the range is dropped.
 */
export function breakdownByDay(
  entries: readonly Pick<TimeEntry, "started_at" | "ended_at" | "direction">[],
  range: DateKeyRange,
  now: Date,
): DayBreakdown[] {
  const days = new Map<string, DayBreakdown>()
  for (let offset = 0; offset < rangeDayCount(range); offset++) {
    const dateKey = addDaysToKey(range.from, offset)
    days.set(dateKey, { dateKey, totalMs: 0, byDirection: emptyByDirection() })
  }

  for (const entry of entries) {
    for (const segment of splitEntryAcrossDays(entry, now)) {
      const day = days.get(segment.dateKey)
      if (!day) continue
      day.totalMs += segment.durationMs
      day.byDirection[entry.direction] += segment.durationMs
    }
  }
  return [...days.values()]
}

/** Direction with the most time (first in declaration order on a tie), `null` when there is none. */
export function topDirection(byDirection: Record<TimeDirection, number>): TimeDirection | null {
  let top: TimeDirection | null = null
  let topMs = 0
  for (const direction of TIME_DIRECTION_VALUES) {
    if (byDirection[direction] > topMs) {
      top = direction
      topMs = byDirection[direction]
    }
  }
  return top
}

/** Hours still missing to the target, never negative. */
export function remainingHours(current: number, target: number): number {
  return Math.max(0, target - current)
}
