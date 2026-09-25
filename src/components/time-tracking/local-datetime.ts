import { PRAGUE_TIME_ZONE } from "@/lib/time-tracking/constants"

/**
 * Converts between native `type="date"` / `type="time"` input values
 * (Europe/Prague wall clock) and ISO instants with an explicit offset.
 * Independent of the runtime time zone. Safe for server and client.
 */

const DATE_INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_INPUT_RE = /^([01]\d|2[0-3]):([0-5]\d)$/
/** Two passes settle the offset around DST transitions. */
const OFFSET_RESOLVE_PASSES = 2
const MS_PER_MINUTE = 60_000
const MINUTES_PER_HOUR = 60
const PAD_WIDTH = 2

const pragueFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PRAGUE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

interface PragueParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

export interface LocalDateTimeInputs {
  /** `YYYY-MM-DD` */
  date: string
  /** `HH:mm` */
  time: string
}

function pad(value: number): string {
  return String(value).padStart(PAD_WIDTH, "0")
}

function pragueParts(instantMs: number): PragueParts {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {}
  for (const part of pragueFormatter.formatToParts(new Date(instantMs))) {
    if (part.type !== "literal") parts[part.type] = Number(part.value)
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
  }
}

/** Prague UTC offset in minutes at the given instant (e.g. `120` in summer). */
function pragueOffsetMinutes(instantMs: number): number {
  const p = pragueParts(instantMs)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  const wholeMinute = Math.floor(instantMs / MS_PER_MINUTE) * MS_PER_MINUTE
  return Math.round((asUtc - wholeMinute) / MS_PER_MINUTE)
}

function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+"
  const abs = Math.abs(offsetMinutes)
  return `${sign}${pad(Math.floor(abs / MINUTES_PER_HOUR))}:${pad(abs % MINUTES_PER_HOUR)}`
}

/**
 * `("2026-09-25", "14:30")` → `"2026-09-25T14:30:00+02:00"` (Prague wall clock).
 * Returns `null` for empty or invalid input (including non-existent days).
 */
export function localInputsToIso(date: string, time: string): string | null {
  const dateMatch = DATE_INPUT_RE.exec(date)
  const timeMatch = TIME_INPUT_RE.exec(time)
  if (!dateMatch || !timeMatch) return null

  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])
  const hour = Number(timeMatch[1])
  const minute = Number(timeMatch[2])

  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute)
  const check = new Date(naiveUtc)
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null
  }

  let offset = pragueOffsetMinutes(naiveUtc)
  for (let pass = 0; pass < OFFSET_RESOLVE_PASSES; pass++) {
    offset = pragueOffsetMinutes(naiveUtc - offset * MS_PER_MINUTE)
  }
  return `${date}T${time}:00${formatOffset(offset)}`
}

/** Prague wall-clock `date` / `time` input values for an instant. */
export function isoToLocalInputs(instant: string | Date): LocalDateTimeInputs {
  const ms = typeof instant === "string" ? Date.parse(instant) : instant.getTime()
  const p = pragueParts(ms)
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
  }
}
