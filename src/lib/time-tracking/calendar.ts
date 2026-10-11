import { isoToLocalInputs, localInputsToIso } from "@/components/time-tracking/local-datetime"

import { addDaysToKey } from "./date-range"
import { splitEntryAcrossDays } from "./week"
import type { TimeEntry } from "./types"

/** Grid geometry and snapping of the Kalendář tab. */
export const CALENDAR_HOUR_HEIGHT = 48
export const CALENDAR_SNAP_MINUTES = 15
export const MINUTES_PER_DAY = 24 * 60
/** Clicking an empty slot creates a block this long. */
export const CALENDAR_DEFAULT_BLOCK_MINUTES = 60
/** The grid opens scrolled to this hour. */
export const CALENDAR_SCROLL_TO_HOUR = 7
export const DAYS_PER_WEEK = 7

const MS_PER_MINUTE = 60_000
const MINUTES_PER_HOUR = 60

const PRAGUE_CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Prague",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

/** Minutes since Prague midnight of the instant's own Prague day (0–1439). */
export function pragueMinuteOfDay(instant: Date): number {
  const [hour = "0", minute = "0"] = PRAGUE_CLOCK.format(instant).split(":")
  return Number(hour) * MINUTES_PER_HOUR + Number(minute)
}

export function minutesToPx(minutes: number): number {
  return (minutes / MINUTES_PER_HOUR) * CALENDAR_HOUR_HEIGHT
}

export function pxToMinutes(px: number): number {
  return (px / CALENDAR_HOUR_HEIGHT) * MINUTES_PER_HOUR
}

/** Rounds to the 15-minute grid and keeps the value inside one day. */
export function snapMinutes(minutes: number, max = MINUTES_PER_DAY): number {
  const snapped = Math.round(minutes / CALENDAR_SNAP_MINUTES) * CALENDAR_SNAP_MINUTES
  return Math.min(Math.max(snapped, 0), max)
}

/** Monday-first day keys of the week starting at `weekStartKey`. */
export function weekDayKeys(weekStartKey: string): string[] {
  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => addDaysToKey(weekStartKey, index))
}

/** `"HH:mm"` for a minute of the day (for labels; 1440 shows as `"24:00"`). */
export function minutesToClock(minutes: number): string {
  const capped = Math.min(Math.max(Math.round(minutes), 0), MINUTES_PER_DAY)
  const hour = Math.floor(capped / MINUTES_PER_HOUR)
  const minute = capped % MINUTES_PER_HOUR
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

export interface CalendarSegment {
  entryId: string
  dateKey: string
  /** Minutes from the day's midnight. */
  startMinute: number
  endMinute: number
  /** The entry starts in this segment (its top edge is the real start). */
  isFirst: boolean
  /** The entry ends in this segment (the resize handle lives here). */
  isLast: boolean
}

/** Per-day segments of entries that fall into the given days (entries over midnight split). */
export function calendarSegments(
  entries: readonly Pick<TimeEntry, "id" | "started_at" | "ended_at">[],
  dayKeys: readonly string[],
  now: Date,
): CalendarSegment[] {
  const days = new Set(dayKeys)
  const segments: CalendarSegment[] = []
  for (const entry of entries) {
    const parts = splitEntryAcrossDays(entry, now)
    parts.forEach((part, index) => {
      if (!days.has(part.dateKey)) return
      const startMinute = pragueMinuteOfDay(part.start)
      const endsAtMidnight = part.continuesNextDay
      const endMinute = endsAtMidnight ? MINUTES_PER_DAY : startMinute + Math.round(part.durationMs / MS_PER_MINUTE)
      segments.push({
        entryId: entry.id,
        dateKey: part.dateKey,
        startMinute,
        endMinute: Math.min(endMinute, MINUTES_PER_DAY),
        isFirst: index === 0,
        isLast: index === parts.length - 1,
      })
    })
  }
  return segments
}

/** Day offset between two `YYYY-MM-DD` keys (DST-safe: counts calendar days). */
export function dayDifference(fromKey: string, toKey: string): number {
  const from = Date.UTC(Number(fromKey.slice(0, 4)), Number(fromKey.slice(5, 7)) - 1, Number(fromKey.slice(8, 10)))
  const to = Date.UTC(Number(toKey.slice(0, 4)), Number(toKey.slice(5, 7)) - 1, Number(toKey.slice(8, 10)))
  return Math.round((to - from) / (24 * 60 * MS_PER_MINUTE))
}

/**
 * New start / end after dragging an entry by whole days and snapped minutes; the length is
 * kept exactly (also over midnight).
 */
export function movedRange(
  entry: Pick<TimeEntry, "started_at" | "ended_at">,
  dayDelta: number,
  minuteDelta: number,
): { startedAt: string; endedAt: string } | null {
  if (entry.ended_at === null) return null
  const lengthMs = Date.parse(entry.ended_at) - Date.parse(entry.started_at)
  // Shift the day on the Prague wall clock, so across a DST change the block keeps its clock time.
  const start = isoToLocalInputs(entry.started_at)
  const shiftedDay = localInputsToIso(addDaysToKey(start.date, dayDelta), start.time)
  if (shiftedDay === null) return null
  const newStart = Date.parse(shiftedDay) + minuteDelta * MS_PER_MINUTE
  return { startedAt: new Date(newStart).toISOString(), endedAt: new Date(newStart + lengthMs).toISOString() }
}

/** New end after dragging the bottom edge; never shorter than one snap step. */
export function resizedEnd(entry: Pick<TimeEntry, "started_at" | "ended_at">, minuteDelta: number): string | null {
  if (entry.ended_at === null) return null
  const minEnd = Date.parse(entry.started_at) + CALENDAR_SNAP_MINUTES * MS_PER_MINUTE
  const end = Math.max(Date.parse(entry.ended_at) + minuteDelta * MS_PER_MINUTE, minEnd)
  return new Date(end).toISOString()
}
