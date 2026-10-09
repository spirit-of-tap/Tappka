import { format } from "date-fns"
import { cs } from "date-fns/locale"

import {
  type DateKeyRange,
  parseRangeParams,
  presetRange,
  isSameRange,
  rangeToInstants,
  todayKeyOf,
} from "@/lib/time-tracking/date-range"
import type { TimeRange } from "@/lib/time-tracking/types"

/** Query param selecting the team on `/cas/tym` (coach / admin only). */
export const TEAM_PARAM = "team"

/** Query params holding the displayed range as inclusive `YYYY-MM-DD` Prague days. */
export const FROM_PARAM = "from"
export const TO_PARAM = "to"

const DATE_KEY_PARTS_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export interface ResolvedRange {
  /** Inclusive Prague days shown in the picker. */
  range: DateKeyRange
  /** Same range as instants (`to` exclusive), for queries and summaries. */
  instants: TimeRange
  /** Prague „today" for the given `now`. */
  todayKey: string
}

/**
 * Range to display for `?from=&to=`. Invalid or missing values fall back to the week
 * containing `now`. Safe for server and client (no `"use client"`).
 */
export function resolveRangeParams(
  params: Record<string, string | string[] | undefined>,
  now: Date,
): ResolvedRange {
  const todayKey = todayKeyOf(now)
  const range = parseRangeParams(params[FROM_PARAM], params[TO_PARAM], todayKey)
  return { range, instants: rangeToInstants(range), todayKey }
}

/**
 * Query string for a range, keeping every other param (e.g. `?team=`). The current
 * week is the default, so it drops `from` / `to` entirely.
 */
export function withRangeParams(current: URLSearchParams, range: DateKeyRange, todayKey: string): URLSearchParams {
  const params = new URLSearchParams(current.toString())
  if (isSameRange(range, presetRange("this-week", todayKey))) {
    params.delete(FROM_PARAM)
    params.delete(TO_PARAM)
  } else {
    params.set(FROM_PARAM, range.from)
    params.set(TO_PARAM, range.to)
  }
  return params
}

/** Local-midnight Date for a `YYYY-MM-DD` key, used only for date-fns formatting and the calendar. */
export function dateFromKey(dateKey: string): Date {
  const match = DATE_KEY_PARTS_RE.exec(dateKey)
  if (!match) return new Date(Number.NaN)
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/** `YYYY-MM-DD` of a local Date's calendar fields (inverse of `dateFromKey`). */
export function keyFromDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * Compact Czech range label: `9. 10. 2026`, `21.–27. 9. 2026`, `29. 9. – 5. 10. 2026`
 * or `29. 12. 2025 – 4. 1. 2026` across a year boundary.
 */
export function formatRangeLabel(range: DateKeyRange): string {
  const first = dateFromKey(range.from)
  const last = dateFromKey(range.to)

  if (range.from === range.to) return format(first, "d. M. yyyy", { locale: cs })
  if (first.getFullYear() !== last.getFullYear()) {
    return `${format(first, "d. M. yyyy", { locale: cs })} – ${format(last, "d. M. yyyy", { locale: cs })}`
  }
  if (first.getMonth() !== last.getMonth()) {
    return `${format(first, "d. M.", { locale: cs })} – ${format(last, "d. M. yyyy", { locale: cs })}`
  }
  return `${format(first, "d.", { locale: cs })}–${format(last, "d. M. yyyy", { locale: cs })}`
}

/** Czech day heading for a Prague `YYYY-MM-DD` key, e.g. `pondělí 22. 9.`. */
export function formatDayHeading(dateKey: string): string {
  return format(dateFromKey(dateKey), "EEEE d. M.", { locale: cs })
}
