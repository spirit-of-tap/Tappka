import { pragueDayStart, toPragueDateKey } from "./week"
import type { TimeRange } from "./types"

/**
 * Inclusive range of Prague calendar days as `YYYY-MM-DD` keys (`from <= to`).
 * Keys compare correctly as strings, so `<` / `>` work for ordering.
 */
export interface DateKeyRange {
  from: string
  to: string
}

export const DATE_RANGE_PRESETS = [
  { id: "today", label: "Dnes" },
  { id: "yesterday", label: "Včera" },
  { id: "this-week", label: "Tento týden" },
  { id: "last-week", label: "Minulý týden" },
  { id: "past-two-weeks", label: "Poslední 2 týdny" },
  { id: "this-month", label: "Tento měsíc" },
  { id: "last-month", label: "Minulý měsíc" },
  { id: "this-year", label: "Tento rok" },
  { id: "last-year", label: "Minulý rok" },
] as const

export type DateRangePresetId = (typeof DATE_RANGE_PRESETS)[number]["id"]

/** Longest range accepted from the URL (two leap years) — guards against huge queries. */
export const MAX_RANGE_DAYS = 732

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000
const DAYS_PER_WEEK = 7
/** `getUTCDay()` → days since Monday (Monday-first weeks). */
const MONDAY_OFFSET = [6, 0, 1, 2, 3, 4, 5] as const

interface DateParts {
  year: number
  month: number
  day: number
}

function parseKey(key: string): DateParts | null {
  const match = DATE_KEY_RE.exec(key)
  if (!match) return null
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
  // Reject impossible days such as 2026-02-30 (Date.UTC would roll them over).
  return toKey(Date.UTC(parts.year, parts.month - 1, parts.day)) === key ? parts : null
}

function toKey(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10)
}

function keyToUtc(key: string): number {
  const parts = parseKey(key)
  if (!parts) throw new Error(`Invalid date key: ${key}`)
  return Date.UTC(parts.year, parts.month - 1, parts.day)
}

/** `true` for a real calendar day in `YYYY-MM-DD` form. */
export function isDateKey(value: string): boolean {
  return parseKey(value) !== null
}

/** Calendar arithmetic on day keys (no time zones involved). */
export function addDaysToKey(key: string, days: number): string {
  return toKey(keyToUtc(key) + days * MS_PER_DAY)
}

/** Number of days in the inclusive range (1 for a single day). */
export function rangeDayCount(range: DateKeyRange): number {
  return Math.round((keyToUtc(range.to) - keyToUtc(range.from)) / MS_PER_DAY) + 1
}

function mondayOf(key: string): string {
  return addDaysToKey(key, -MONDAY_OFFSET[new Date(keyToUtc(key)).getUTCDay()])
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function monthRange(year: number, month: number): DateKeyRange {
  // Normalise month overflow (0 → December of the previous year, 13 → January next year).
  const first = new Date(Date.UTC(year, month - 1, 1))
  const y = first.getUTCFullYear()
  const m = first.getUTCMonth() + 1
  return { from: toKey(first.getTime()), to: toKey(Date.UTC(y, m - 1, lastDayOfMonth(y, m))) }
}

function yearRange(year: number): DateKeyRange {
  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

/** Monday–Sunday week containing `key`. */
export function weekRangeOf(key: string): DateKeyRange {
  const from = mondayOf(key)
  return { from, to: addDaysToKey(from, DAYS_PER_WEEK - 1) }
}

/** Range for a preset relative to `todayKey` (Prague „today"). */
export function presetRange(id: DateRangePresetId, todayKey: string): DateKeyRange {
  const today = parseKey(todayKey)
  if (!today) throw new Error(`Invalid date key: ${todayKey}`)

  switch (id) {
    case "today":
      return { from: todayKey, to: todayKey }
    case "yesterday": {
      const yesterday = addDaysToKey(todayKey, -1)
      return { from: yesterday, to: yesterday }
    }
    case "this-week":
      return weekRangeOf(todayKey)
    case "last-week":
      return weekRangeOf(addDaysToKey(todayKey, -DAYS_PER_WEEK))
    case "past-two-weeks": {
      const thisWeek = weekRangeOf(todayKey)
      return { from: addDaysToKey(thisWeek.from, -DAYS_PER_WEEK), to: thisWeek.to }
    }
    case "this-month":
      return monthRange(today.year, today.month)
    case "last-month":
      return monthRange(today.year, today.month - 1)
    case "this-year":
      return yearRange(today.year)
    case "last-year":
      return yearRange(today.year - 1)
  }
}

export function isSameRange(a: DateKeyRange, b: DateKeyRange): boolean {
  return a.from === b.from && a.to === b.to
}

/** Preset whose range equals `range` today, or `null` for a custom range. */
export function matchPreset(range: DateKeyRange, todayKey: string): DateRangePresetId | null {
  return DATE_RANGE_PRESETS.find((preset) => isSameRange(presetRange(preset.id, todayKey), range))?.id ?? null
}

export function presetLabel(id: DateRangePresetId): string {
  return DATE_RANGE_PRESETS.find((preset) => preset.id === id)?.label ?? ""
}

function isWholeMonths(range: DateKeyRange): boolean {
  const from = parseKey(range.from)
  const to = parseKey(range.to)
  return from !== null && to !== null && from.day === 1 && to.day === lastDayOfMonth(to.year, to.month)
}

/**
 * Range moved one „period" back (`-1`) or forward (`1`), like Clockify's ‹ › arrows:
 * whole calendar months (incl. years) move by their month count so month lengths stay
 * right; anything else (day, week, custom) moves by its own length in days.
 */
export function shiftRange(range: DateKeyRange, direction: -1 | 1): DateKeyRange {
  if (isWholeMonths(range)) {
    const from = parseKey(range.from)
    const to = parseKey(range.to)
    if (from && to) {
      const months = (to.year - from.year) * 12 + (to.month - from.month) + 1
      const start = monthRange(from.year, from.month + direction * months)
      const startParts = parseKey(start.from)
      if (startParts) {
        const end = monthRange(startParts.year, startParts.month + months - 1)
        return { from: start.from, to: end.to }
      }
    }
  }
  const days = rangeDayCount(range) * direction
  return { from: addDaysToKey(range.from, days), to: addDaysToKey(range.to, days) }
}

/** Range cut to at most `MAX_RANGE_DAYS`, keeping its start. */
export function clampRange(range: DateKeyRange): DateKeyRange {
  return rangeDayCount(range) > MAX_RANGE_DAYS
    ? { from: range.from, to: addDaysToKey(range.from, MAX_RANGE_DAYS - 1) }
    : range
}

/** Half-open instant range `[from 00:00, day after to 00:00)` in Europe/Prague. */
export function rangeToInstants(range: DateKeyRange): TimeRange {
  const from = pragueDayStart(range.from)
  const to = pragueDayStart(addDaysToKey(range.to, 1))
  if (!from || !to) throw new Error(`Invalid range: ${range.from} – ${range.to}`)
  return { from, to }
}

/** Prague calendar day of `now`. */
export function todayKeyOf(now: Date): string {
  return toPragueDateKey(now)
}

/**
 * Range from `?from=&to=` query values. Missing or invalid values fall back to the
 * current week; a reversed pair is swapped; overly long ranges are cut to
 * `MAX_RANGE_DAYS` from their start.
 */
export function parseRangeParams(
  fromValue: string | string[] | undefined,
  toValue: string | string[] | undefined,
  todayKey: string,
): DateKeyRange {
  const fromRaw = Array.isArray(fromValue) ? fromValue[0] : fromValue
  const toRaw = Array.isArray(toValue) ? toValue[0] : toValue
  const fallback = presetRange("this-week", todayKey)
  if (!fromRaw || !toRaw || !isDateKey(fromRaw) || !isDateKey(toRaw)) return fallback

  const range = fromRaw <= toRaw ? { from: fromRaw, to: toRaw } : { from: toRaw, to: fromRaw }
  return rangeDayCount(range) > MAX_RANGE_DAYS ? clampRange(range) : range
}

/**
 * Click-to-select state for the calendar, mirroring Clockify: the first click sets an
 * anchor (start); a click on the same or a later day completes the range; a click on
 * an earlier day moves the anchor there instead of producing a reversed range.
 */
export interface RangeSelection {
  /** Start picked by the first click, waiting for the end click. */
  anchor: string | null
}

export interface RangeClickResult {
  selection: RangeSelection
  /** Set when the click completed a range — apply it and close the picker. */
  completed: DateKeyRange | null
}

export const EMPTY_SELECTION: RangeSelection = { anchor: null }

export function clickDay(selection: RangeSelection, dayKey: string): RangeClickResult {
  const { anchor } = selection
  if (anchor === null || dayKey < anchor) {
    return { selection: { anchor: dayKey }, completed: null }
  }
  return { selection: EMPTY_SELECTION, completed: { from: anchor, to: dayKey } }
}

/**
 * Range to highlight in the calendar: the pending anchor up to the hovered day while
 * picking (just the anchor when hovering before it), otherwise the applied range.
 */
export function highlightedRange(
  selection: RangeSelection,
  hoveredKey: string | null,
  applied: DateKeyRange,
): DateKeyRange {
  const { anchor } = selection
  if (anchor === null) return applied
  if (hoveredKey === null || hoveredKey < anchor) return { from: anchor, to: anchor }
  return { from: anchor, to: hoveredKey }
}

/**
 * Goal for a range scaled from a weekly goal: `weekly × days / 7`, rounded to one
 * decimal (a month ≈ 171,4 h, a single day ≈ 5,7 h for 40 h a week).
 */
export function scaleWeeklyTarget(weeklyTarget: number, range: DateKeyRange): number {
  return Math.round(((weeklyTarget * rangeDayCount(range)) / DAYS_PER_WEEK) * 10) / 10
}
