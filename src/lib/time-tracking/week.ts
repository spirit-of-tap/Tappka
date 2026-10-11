import { addDays, addWeeks, startOfDay, startOfWeek } from "date-fns"

import { PRAGUE_TIME_ZONE, TIME_DIRECTION_VALUES } from "./constants"
import { entryDurationMs } from "./duration"
import type { DayGroup, DaySegment, TimeDirection, TimeEntry, TimeRange, TimeSummary } from "./types"

const WEEK_STARTS_ON_MONDAY = 1
const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
/** Two passes are enough to settle the offset around DST transitions. */
const OFFSET_RESOLVE_PASSES = 2
const MS_PER_WHOLE_SECOND = 1_000

const pragueFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PRAGUE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

interface WallClockParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function pragueParts(instant: Date): WallClockParts {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {}
  for (const part of pragueFormatter.formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value)
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  }
}

/** Prague UTC offset (ms) at the given instant, e.g. +2 h in summer. */
function pragueOffsetMs(instant: Date): number {
  const p = pragueParts(instant)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  const ms = instant.getTime()
  const wholeSeconds = ms - (((ms % MS_PER_WHOLE_SECOND) + MS_PER_WHOLE_SECOND) % MS_PER_WHOLE_SECOND)
  return asUtc - wholeSeconds
}

/**
 * Returns a Date whose *runtime-local* fields equal the Prague wall clock of `instant`,
 * so date-fns local-time helpers (`startOfWeek`, `startOfDay`) operate in Prague time
 * regardless of the server time zone.
 */
function toPragueWallClock(instant: Date): Date {
  const p = pragueParts(instant)
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, instant.getMilliseconds())
}

/** Inverse of `toPragueWallClock`: the real instant for a Prague wall-clock Date. */
function fromPragueWallClock(wall: Date): Date {
  const naiveUtc = Date.UTC(
    wall.getFullYear(),
    wall.getMonth(),
    wall.getDate(),
    wall.getHours(),
    wall.getMinutes(),
    wall.getSeconds(),
    wall.getMilliseconds(),
  )
  let guess = naiveUtc
  for (let pass = 0; pass < OFFSET_RESOLVE_PASSES; pass++) {
    guess = naiveUtc - pragueOffsetMs(new Date(guess))
  }
  return new Date(guess)
}

function toLocalDateKey(wall: Date): string {
  const month = String(wall.getMonth() + 1).padStart(2, "0")
  const day = String(wall.getDate()).padStart(2, "0")
  return `${wall.getFullYear()}-${month}-${day}`
}

/** Prague calendar day of an instant as `YYYY-MM-DD`. */
export function toPragueDateKey(instant: Date | string): string {
  return toLocalDateKey(toPragueWallClock(typeof instant === "string" ? new Date(instant) : instant))
}

/** Instant of Prague midnight at the start of the given `YYYY-MM-DD` day, or `null` if invalid. */
export function pragueDayStart(dateKey: string): Date | null {
  const match = DATE_KEY_RE.exec(dateKey)
  if (!match) return null
  const wall = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (toLocalDateKey(wall) !== dateKey) return null
  return fromPragueWallClock(wall)
}

/**
 * Monday-first week containing `now`, in Europe/Prague local time.
 * `to` is exclusive (next Monday 00:00 Prague).
 */
export function getWeekRange(now: Date): TimeRange {
  const weekStartWall = startOfWeek(toPragueWallClock(now), { weekStartsOn: WEEK_STARTS_ON_MONDAY })
  return {
    from: fromPragueWallClock(weekStartWall),
    to: fromPragueWallClock(addWeeks(weekStartWall, 1)),
  }
}

/** Week range shifted by `offset` weeks (negative = past). */
export function shiftWeekRange(range: TimeRange, offset: number): TimeRange {
  const startWall = addWeeks(toPragueWallClock(range.from), offset)
  return getWeekRange(fromPragueWallClock(startWall))
}

function compareEntriesNewestFirst(a: TimeEntry, b: TimeEntry): number {
  const aRunning = a.ended_at === null
  const bRunning = b.ended_at === null
  if (aRunning !== bRunning) return aRunning ? -1 : 1
  return Date.parse(b.started_at) - Date.parse(a.started_at)
}

/**
 * Groups entries by the Prague day they start in. Days are newest first; within a day
 * the running timer comes first, then entries by `started_at` descending.
 */
export function groupEntriesByDay<T extends TimeEntry>(entries: readonly T[]): DayGroup<T>[] {
  const byDay = new Map<string, T[]>()
  for (const entry of entries) {
    const key = toPragueDateKey(entry.started_at)
    const bucket = byDay.get(key)
    if (bucket) bucket.push(entry)
    else byDay.set(key, [entry])
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, dayEntries]) => ({ dateKey, entries: [...dayEntries].sort(compareEntriesNewestFirst) }))
}

/**
 * Splits an entry at Prague midnights into per-day display segments.
 * Running entries are measured up to `now`.
 */
export function splitEntryAcrossDays(
  entry: Pick<TimeEntry, "started_at" | "ended_at">,
  now: Date = new Date(),
): DaySegment[] {
  const start = new Date(entry.started_at)
  const end = entry.ended_at === null ? now : new Date(entry.ended_at)
  if (end.getTime() <= start.getTime()) {
    return [
      {
        dateKey: toPragueDateKey(start),
        start,
        end: start,
        durationMs: 0,
        continuesNextDay: false,
        continuedFromPreviousDay: false,
      },
    ]
  }

  const segments: DaySegment[] = []
  let cursor = start
  while (cursor.getTime() < end.getTime()) {
    const nextMidnight = fromPragueWallClock(addDays(startOfDay(toPragueWallClock(cursor)), 1))
    const segmentEnd = nextMidnight.getTime() < end.getTime() ? nextMidnight : end
    segments.push({
      dateKey: toPragueDateKey(cursor),
      start: cursor,
      end: segmentEnd,
      durationMs: segmentEnd.getTime() - cursor.getTime(),
      continuesNextDay: segmentEnd.getTime() < end.getTime(),
      continuedFromPreviousDay: segments.length > 0,
    })
    cursor = segmentEnd
  }
  return segments
}

export interface SummarizeOptions {
  /** Count running timers up to `now`. Default `false`. */
  includeRunning?: boolean
  now?: Date
  /** Clip each entry to this range (e.g. the displayed week). */
  range?: TimeRange
}

function emptyByDirection(): Record<TimeDirection, number> {
  const result = {} as Record<TimeDirection, number>
  for (const direction of TIME_DIRECTION_VALUES) result[direction] = 0
  return result
}

/** Totals in ms: overall, per direction and per tag (`null` = untagged). */
export function summarize(entries: readonly TimeEntry[], options: SummarizeOptions = {}): TimeSummary {
  const { includeRunning = false, range } = options
  const now = options.now ?? new Date()
  const summary: TimeSummary = { totalMs: 0, byDirection: emptyByDirection(), byTag: new Map() }

  for (const entry of entries) {
    const running = entry.ended_at === null
    if (running && !includeRunning) continue

    let ms: number
    if (range) {
      const start = Math.max(Date.parse(entry.started_at), range.from.getTime())
      const endMs = entry.ended_at === null ? now.getTime() : Date.parse(entry.ended_at)
      const end = Math.min(endMs, range.to.getTime())
      ms = Math.max(0, end - start)
    } else {
      ms = entryDurationMs(entry, now)
    }
    if (ms === 0) continue

    summary.totalMs += ms
    summary.byDirection[entry.direction] += ms
    summary.byTag.set(entry.tag_id, (summary.byTag.get(entry.tag_id) ?? 0) + ms)
  }
  return summary
}
