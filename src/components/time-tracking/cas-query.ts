import { format } from "date-fns"
import { cs } from "date-fns/locale"

import type { TimeRange } from "@/lib/time-tracking/types"
import { getWeekRange, pragueDayStart, toPragueDateKey } from "@/lib/time-tracking/week"

/** Query param selecting the team on `/cas/tym` (coach / admin only). */
export const TEAM_PARAM = "team"

/** Query param holding any `YYYY-MM-DD` day inside the displayed week. */
export const WEEK_PARAM = "w"

const DATE_KEY_PARTS_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Week to display for a `?w=` value. Invalid or missing values fall back to the week
 * containing `now`. Safe for server and client (no `"use client"`).
 */
export function resolveWeekParam(value: string | string[] | undefined, now: Date): TimeRange {
  const raw = Array.isArray(value) ? value[0] : value
  const dayStart = raw ? pragueDayStart(raw) : null
  return getWeekRange(dayStart ?? now)
}

/** `?w=` value for a week: its Monday as `YYYY-MM-DD` (Prague). */
export function toWeekParam(week: TimeRange): string {
  return toPragueDateKey(week.from)
}

/** Local-midnight Date for a `YYYY-MM-DD` key, used only for date-fns formatting. */
function dateFromKey(dateKey: string): Date {
  const match = DATE_KEY_PARTS_RE.exec(dateKey)
  if (!match) return new Date(Number.NaN)
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/**
 * Compact Czech week label: `21.–27. 9. 2026`, `29. 9. – 5. 10. 2026`
 * or `29. 12. 2025 – 4. 1. 2026` across a year boundary.
 */
export function formatWeekLabel(week: TimeRange): string {
  const first = dateFromKey(toPragueDateKey(week.from))
  // `to` is exclusive — the last displayed day is the one just before it.
  const last = dateFromKey(toPragueDateKey(new Date(week.to.getTime() - 1)))

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
