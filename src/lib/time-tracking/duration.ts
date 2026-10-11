import { MS_PER_HOUR, MS_PER_MINUTE, MS_PER_SECOND } from "./constants"

const MINUTES_PER_HOUR = 60
const SECONDS_PER_MINUTE = 60
const TIME_PART_WIDTH = 2

/** `h:mm` (e.g. `1:30`). */
const CLOCK_INPUT_RE = /^(\d+):([0-5]\d)$/
/** Bare number = minutes (e.g. `90`). */
const MINUTES_INPUT_RE = /^\d+$/
/** `1h 30m`, `1h`, `45m`, `1 h 30 min`, `1,5h`. */
const UNIT_INPUT_RE = /^(?:(\d+(?:[.,]\d+)?)\s*h(?:od)?)?\s*(?:(\d+)\s*m(?:in)?)?$/

function pad(value: number): string {
  return String(value).padStart(TIME_PART_WIDTH, "0")
}

function clampNonNegative(ms: number): number {
  return Number.isFinite(ms) && ms > 0 ? ms : 0
}

/** `5400000` → `"01:30:00"`. Hours are not capped at 24. */
export function formatDurationHms(ms: number): string {
  const totalSeconds = Math.floor(clampNonNegative(ms) / MS_PER_SECOND)
  const hours = Math.floor(totalSeconds / (SECONDS_PER_MINUTE * MINUTES_PER_HOUR))
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE) % MINUTES_PER_HOUR
  const seconds = totalSeconds % SECONDS_PER_MINUTE
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

/** `5400000` → `"1 h 30 min"`, `60000` → `"1 min"`, `7200000` → `"2 h"`, `< 1 min` → `"< 1 min"`. */
export function formatDurationShort(ms: number): string {
  const safe = clampNonNegative(ms)
  if (safe === 0) return "0 min"
  if (safe < MS_PER_MINUTE) return "< 1 min"

  const totalMinutes = Math.floor(safe / MS_PER_MINUTE)
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR)
  const minutes = totalMinutes % MINUTES_PER_HOUR

  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${minutes} min`
}

/**
 * Parses a free-form duration. Accepts `"1h 30m"`, `"1h30m"`, `"1 h 30 min"`, `"1,5h"`,
 * `"45m"`, `"1:30"` and a bare number of minutes (`"90"`). Returns ms, or `null`
 * for empty, zero or unparseable input.
 */
export function parseDurationInput(input: string): number | null {
  const value = input.trim().toLowerCase()
  if (value === "") return null

  let ms: number | null = null

  const clock = CLOCK_INPUT_RE.exec(value)
  if (clock) {
    ms = Number(clock[1]) * MS_PER_HOUR + Number(clock[2]) * MS_PER_MINUTE
  } else if (MINUTES_INPUT_RE.test(value)) {
    ms = Number(value) * MS_PER_MINUTE
  } else {
    const units = UNIT_INPUT_RE.exec(value)
    if (units && (units[1] !== undefined || units[2] !== undefined)) {
      const hours = units[1] === undefined ? 0 : Number(units[1].replace(",", "."))
      const minutes = units[2] === undefined ? 0 : Number(units[2])
      ms = Math.round(hours * MS_PER_HOUR) + minutes * MS_PER_MINUTE
    }
  }

  if (ms === null || !Number.isFinite(ms) || ms <= 0) return null
  return ms
}

/**
 * Duration between two ISO timestamps in ms, matching the DB check
 * `(extract(epoch from ended_at - started_at) * 1000)::bigint`.
 */
export function computeDurationMs(startedAt: string, endedAt: string): number {
  return Math.round(Date.parse(endedAt) - Date.parse(startedAt))
}

/** Elapsed ms of an entry; running entries (no `ended_at`) are measured against `now`. */
export function entryDurationMs(
  entry: { started_at: string; ended_at: string | null; duration_ms: number | null },
  now: Date = new Date(),
): number {
  if (entry.ended_at !== null) {
    return entry.duration_ms ?? computeDurationMs(entry.started_at, entry.ended_at)
  }
  return Math.max(0, now.getTime() - Date.parse(entry.started_at))
}
